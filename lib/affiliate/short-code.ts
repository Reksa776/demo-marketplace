import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/* ==========================================
 * SHORT AFFILIATE CODE GENERATOR
 * ==========================================
 *
 * Generates short, memorable, secure codes:
 *   - 6-8 characters
 *   - Uppercase alphanumeric
 *   - No ambiguous characters (0/O, 1/I/L)
 *   - Collision-safe with retry
 *   - Server-side only
 *
 * Examples: RAKA7X, BUDI92, SHOP8A, DINA5K
 */

/**
 * Characters used in code generation.
 * Excludes ambiguous characters:
 * - 0 (looks like O)
 * - O (looks like 0)
 * - 1 (looks like I/l)
 * - I (looks like 1/l)
 * - L (looks like 1/I)
 */
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const CODE_LENGTH = 6;
const MAX_RETRIES = 10;

/**
 * Generate a random short code using crypto.
 */
function randomCode(length: number = CODE_LENGTH): string {
    const bytes = crypto.randomBytes(length);
    let code = "";
    for (let i = 0; i < length; i++) {
        code += CHARSET[bytes[i] % CHARSET.length];
    }
    return code;
}

/**
 * Generate a unique affiliate code.
 * Retries on collision (unique constraint).
 *
 * Called when an affiliate is APPROVED.
 * Existing affiliates keep their old code.
 */
export async function generateUniqueAffiliateCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const code = randomCode();

        // Check if code already exists
        const existing =
            await prisma.affiliateProfile.findFirst({
                where: { affiliateCode: code },
                select: { id: true },
            });

        if (!existing) {
            return code;
        }

        // Collision — retry
        console.warn(
            `AFFILIATE_CODE: Collision on attempt ${attempt + 1}: ${code}`
        );
    }

    throw new Error(
        "Gagal generate kode affiliate unik. Silakan coba lagi."
    );
}

/**
 * Validate that an affiliate code exists and is APPROVED.
 * Used by referral resolver.
 */
export async function validateAffiliateCode(
    code: string
): Promise<{
    id: number;
    affiliateCode: string;
    commissionRate: number;
} | null> {
    const affiliate =
        await prisma.affiliateProfile.findFirst({
            where: {
                affiliateCode: code,
                status: "APPROVED",
            },
            select: {
                id: true,
                affiliateCode: true,
                commissionRate: true,
            },
        });

    if (!affiliate) return null;

    return {
        id: affiliate.id,
        affiliateCode: affiliate.affiliateCode,
        commissionRate: Number(
            affiliate.commissionRate
        ),
    };
}
