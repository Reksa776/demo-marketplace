import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { registerSchema } from "@/lib/validations/register";
import { rateLimiters, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
    try {
        // Rate limiting
        const clientIp = getClientIp(req);
        const rateLimit = rateLimiters.register(clientIp);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, message: "Terlalu banyak permintaan. Coba lagi nanti." },
                { status: 429 }
            );
        }

        const body = await req.json();

        const data = registerSchema.parse(body);

        if (!data.email && !data.phone) {
            return NextResponse.json(
                {
                    message:
                        "Email atau nomor HP wajib diisi.",
                },
                { status: 400 }
            );
        }

        const existing = await prisma.user.findFirst({
            where: {
                OR: [
                    ...(data.email
                        ? [{ email: data.email }]
                        : []),

                    ...(data.phone
                        ? [{ phone: data.phone }]
                        : []),
                ],
            },
        });

        if (existing) {
            return NextResponse.json(
                {
                    message:
                        "Email atau nomor HP sudah digunakan.",
                },
                { status: 400 }
            );
        }

        const hashedPassword =
            await hashPassword(data.password);

        const referralCode = `REF${Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()}`;

        /* ==========================================
         * SERVER-SIDE REFERRAL VALIDATION
         * ==========================================
         *
         * Only store referredBy if the code is a valid,
         * APPROVED affiliate. Never trust client input
         * for attribution — validate server-side.
         *
         * Security:
         *   - Client cannot submit affiliateId
         *   - Client cannot submit commissionRate
         *   - Client cannot submit commissionAmount
         *   - Only affiliateCode is accepted
         *   - Server resolves the affiliate profile
         */
        let validatedReferredBy: string | null = null;

        if (data.referralCode && data.referralCode.trim()) {
            const trimmedCode = data.referralCode.trim();

            // Validate against AffiliateProfile
            const affiliate =
                await prisma.affiliateProfile.findFirst({
                    where: {
                        affiliateCode: trimmedCode,
                        status: "APPROVED",
                    },
                    select: {
                        affiliateCode: true,
                    },
                });

            // Only store if affiliate is valid and APPROVED
            if (affiliate) {
                validatedReferredBy = affiliate.affiliateCode;
            } else {
                // Invalid or non-APPROVED code — store null
                // Don't reveal to client that the code was invalid
                console.log(
                    `REGISTER_REFERRAL: Code "${trimmedCode}" is invalid or not APPROVED. Storing null.`
                );
            }
        }

        const user = await prisma.user.create({
            data: {
                name: data.name,
                email: data.email || null,
                phone: data.phone || null,
                password: hashedPassword,
                referralCode,
                referredBy: validatedReferredBy,
            },
        });

        return NextResponse.json(
            {
                message: "Register berhasil",

                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                },
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("REGISTER ERROR:", error);

        return NextResponse.json(
            {
                message: "Terjadi kesalahan saat registrasi.",
            },
            { status: 500 }
        );
    }
}
