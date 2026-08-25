import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ==========================================
 * GET /api/affiliate/referral?ref=CODE
 * ==========================================
 *
 * Validates an affiliate referral code and
 * sets an HTTP-only cookie for tracking.
 *
 * Flow:
 *   1. Validate affiliateCode exists
 *   2. Check affiliate status = APPROVED
 *   3. Set referral cookie (30 days)
 *   4. Return success
 *
 * Used by homepage when user visits:
 *   /?ref=AFF12345
 *
 * Security:
 *   - No userId from client
 *   - Server validates affiliateCode
 *   - Only APPROVED affiliates count
 *   - Cookie is HTTP-only (not JS accessible)
 */

const COOKIE_NAME = "aff_ref";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(
            request.url
        );

        const code = searchParams
            .get("ref")
            ?.trim();

        if (!code) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Referral code tidak valid.",
                },
                { status: 400 }
            );
        }

        /* ==========================================
         * VALIDATE AFFILIATE CODE
         * ========================================== */

        const affiliate =
            await prisma.affiliateProfile.findFirst(
                {
                    where: {
                        affiliateCode: code,
                        status: "APPROVED",
                    },
                    select: {
                        id: true,
                        affiliateCode: true,
                        userId: true,
                    },
                }
            );

        if (!affiliate) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Referral tidak valid atau sudah tidak aktif.",
                },
                { status: 404 }
            );
        }

        /* ==========================================
         * RECORD CLICK
         * ========================================== */

        try {
            await prisma.affiliateClick.create({
                data: {
                    affiliateId: affiliate.id,
                    code: affiliate.affiliateCode,
                    landingUrl:
                        request.headers.get(
                            "referer"
                        ) || "/",
                },
            });
        } catch {
            // Click recording is non-critical
            console.warn(
                "AFFILIATE_CLICK: Failed to record click for",
                affiliate.affiliateCode
            );
        }

        /* ==========================================
         * SET REFERRAL COOKIE
         * ==========================================
         *
         * HTTP-only, SameSite=Lax, Path=/
         * Not accessible via JavaScript.
         */

        const response = NextResponse.json({
            success: true,
            message: "Referral tercatat.",
            data: {
                affiliateCode:
                    affiliate.affiliateCode,
            },
        });

        response.cookies.set(
            COOKIE_NAME,
            affiliate.affiliateCode,
            {
                httpOnly: true,
                secure:
                    process.env.NODE_ENV ===
                    "production",
                sameSite: "lax",
                path: "/",
                maxAge: COOKIE_MAX_AGE,
            }
        );

        console.log(
            `AFFILIATE_REFERRAL: Cookie set for code ${affiliate.affiliateCode}`
        );

        return response;
    } catch (error) {
        console.error(
            "AFFILIATE REFERRAL ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal memproses referral.",
            },
            { status: 500 }
        );
    }
}
