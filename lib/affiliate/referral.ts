import { prisma } from "@/lib/prisma";

/* ==========================================
 * AFFILIATE REFERRAL HELPER
 * ==========================================
 *
 * Centralized logic for reading referral
 * cookie and resolving affiliate for checkout.
 *
 * Used by:
 *   - Cart checkout
 *   - Buy Now checkout
 *   - Order creation
 */

const COOKIE_NAME = "aff_ref";

/* ==========================================
 * READ REFERRAL COOKIE
 * ==========================================
 *
 * Extracts affiliateCode from HTTP-only cookie.
 * Returns null if not present.
 */

export function getReferralCode(
    cookieHeader: string | null
): string | null {
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(";");
    for (const cookie of cookies) {
        const [name, value] = cookie
            .trim()
            .split("=");
        if (name === COOKIE_NAME && value) {
            return decodeURIComponent(value);
        }
    }

    return null;
}

/* ==========================================
 * RESOLVE AFFILIATE FOR CHECKOUT
 * ==========================================
 *
 * Given a referral code, validates and returns
 * the affiliate profile if APPROVED.
 *
 * Returns null if:
 *   - code is null/empty
 *   - affiliate not found
 *   - affiliate not APPROVED
 */

export async function resolveAffiliate(
    referralCode: string | null
): Promise<{
    affiliateId: number;
    affiliateCode: string;
    commissionRate: number;
} | null> {
    if (!referralCode) return null;

    const affiliate =
        await prisma.affiliateProfile.findFirst({
            where: {
                affiliateCode: referralCode,
                status: "APPROVED",
            },
            select: {
                id: true,
                affiliateCode: true,
                commissionRate: true,
            },
            cacheStrategy: {
                ttl: 60, // cache 60 seconds
            },
        } as any);

    if (!affiliate) return null;

    return {
        affiliateId: affiliate.id,
        affiliateCode: affiliate.affiliateCode,
        commissionRate: Number(
            affiliate.commissionRate
        ),
    };
}

/* ==========================================
 * CREATE AFFILIATE CONVERSION
 * ==========================================
 *
 * DEPRECATED: This function is not used.
 * Commission creation happens in lib/checkout.ts
 * inside the Prisma transaction.
 *
 * Kept for reference only. Do not use —
 * it uses floating point math.
 */
