import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ==========================================
 * GET /api/affiliate/resolve
 * ==========================================
 *
 * Reads the aff_ref HTTP-only cookie and
 * returns the affiliate code if valid.
 *
 * Used by the register form to auto-fill
 * the referral code field.
 *
 * Security:
 *   - Reads HTTP-only cookie (server-side)
 *   - Validates affiliate exists and is APPROVED
 *   - Returns only the code string, never userId
 */

const COOKIE_NAME = "aff_ref";

export async function GET(request: Request) {
    try {
        const cookieHeader =
            request.headers.get("cookie");

        if (!cookieHeader) {
            return NextResponse.json({
                success: true,
                data: { code: null },
            });
        }

        /* ==========================================
         * EXTRACT AFFILIATE CODE FROM COOKIE
         * ========================================== */

        const cookies = cookieHeader.split(";");
        let affiliateCode: string | null = null;

        for (const cookie of cookies) {
            const [name, value] = cookie
                .trim()
                .split("=");
            if (
                name === COOKIE_NAME &&
                value
            ) {
                affiliateCode =
                    decodeURIComponent(value);
                break;
            }
        }

        if (!affiliateCode) {
            return NextResponse.json({
                success: true,
                data: { code: null },
            });
        }

        /* ==========================================
         * VALIDATE AFFILIATE
         * ========================================== */

        const affiliate =
            await prisma.affiliateProfile.findFirst({
                where: {
                    affiliateCode,
                    status: "APPROVED",
                },
                select: {
                    affiliateCode: true,
                },
            });

        if (!affiliate) {
            return NextResponse.json({
                success: true,
                data: { code: null },
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                code: affiliate.affiliateCode,
            },
        });
    } catch (error) {
        console.error(
            "AFFILIATE_RESOLVE ERROR:",
            error
        );

        return NextResponse.json({
            success: true,
            data: { code: null },
        });
    }
}
