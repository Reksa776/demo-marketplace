import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/* ==========================================
 * GET /api/affiliate/application
 * ==========================================
 *
 * Returns the current customer's affiliate
 * application status.
 */

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unauthorized.",
                },
                { status: 401 }
            );
        }

        const application =
            await prisma.affiliateProfile.findFirst({
                where: {
                    userId: session.user.id,
                },
                orderBy: {
                    createdAt: "desc",
                },
                select: {
                    id: true,
                    status: true,
                    affiliateCode: true,
                    rejectionReason: true,
                    approvedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    kyc: {
                        select: {
                            bankName: true,
                            bankAccountName: true,
                            socialMediaPlatform: true,
                            socialMediaUsername: true,
                        },
                    },
                },
            });

        if (!application) {
            return NextResponse.json({
                success: true,
                data: null,
            });
        }

        const data = {
            ...application,
            kyc: application.kyc
                ? {
                      ...application.kyc,
                      bankAccountNumber: null,
                      ktpNumber: null,
                  }
                : null,
        };

        return NextResponse.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error(
            "GET AFFILIATE APPLICATION ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil data pengajuan.",
            },
            { status: 500 }
        );
    }
}

/* ==========================================
 * POST /api/affiliate/application
 * ==========================================
 *
 * Submit or resubmit an affiliate application.
 *
 * Flow:
 *   - No existing profile → CREATE new (PENDING)
 *   - Existing REJECTED → UPDATE to PENDING, replace KYC
 *   - Existing PENDING → reject (409)
 *   - Existing APPROVED → reject (409)
 *   - Existing SUSPENDED → reject (409)
 *
 * Handles P2002 race condition gracefully.
 */

export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unauthorized.",
                },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        /* ==========================================
         * CHECK EXISTING APPLICATION
         * ========================================== */

        const existing =
            await prisma.affiliateProfile.findUnique(
                {
                    where: { userId },
                    select: {
                        id: true,
                        status: true,
                        affiliateCode: true,
                        kyc: {
                            select: { id: true },
                        },
                    },
                }
            );

        // PENDING → block
        if (
            existing &&
            existing.status === "PENDING"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Pengajuan affiliator sedang diproses.",
                },
                { status: 409 }
            );
        }

        // APPROVED → block
        if (
            existing &&
            existing.status === "APPROVED"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Akun Anda sudah menjadi affiliator.",
                },
                { status: 409 }
            );
        }

        // SUSPENDED → block
        if (
            existing &&
            existing.status === "SUSPENDED"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Akun affiliator Anda sedang ditangguhkan.",
                },
                { status: 409 }
            );
        }

        /* ==========================================
         * PARSE & VALIDATE BODY
         * ========================================== */

        let body: Record<string, unknown>;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Gagal membaca request body.",
                },
                { status: 400 }
            );
        }

        const {
            ktpImageUrl,
            socialMediaImageUrl,
            bankName,
            bankAccountName,
            bankAccountNumber,
            socialMediaPlatform,
            socialMediaUsername,
        } = body;

        /* ==========================================
         * VALIDATE REQUIRED FIELDS
         * ========================================== */

        if (
            !ktpImageUrl ||
            typeof ktpImageUrl !== "string" ||
            !ktpImageUrl.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Foto KTP wajib diupload.",
                },
                { status: 400 }
            );
        }

        if (
            !socialMediaImageUrl ||
            typeof socialMediaImageUrl !==
                "string" ||
            !socialMediaImageUrl.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Foto bukti sosial media wajib diupload.",
                },
                { status: 400 }
            );
        }

        if (
            !bankName ||
            typeof bankName !== "string" ||
            !bankName.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nama bank wajib diisi.",
                },
                { status: 400 }
            );
        }

        if (
            !bankAccountName ||
            typeof bankAccountName !== "string" ||
            !bankAccountName.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nama pemilik rekening wajib diisi.",
                },
                { status: 400 }
            );
        }

        if (
            !bankAccountNumber ||
            typeof bankAccountNumber !==
                "string" ||
            !bankAccountNumber.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nomor rekening wajib diisi.",
                },
                { status: 400 }
            );
        }

        /* ==========================================
         * VALIDATE IMAGE URLS
         * ========================================== */

        const imageUrlPattern =
            /^(\/api\/uploads\/affiliate\/(ktp|social)\/[a-zA-Z0-9_-]+\/[^\s]+|https?:\/\/.+\.(jpg|jpeg|png|webp))/i;

        if (
            !imageUrlPattern.test(
                ktpImageUrl.trim()
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "URL foto KTP tidak valid.",
                },
                { status: 400 }
            );
        }

        if (
            !imageUrlPattern.test(
                socialMediaImageUrl.trim()
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "URL foto sosial media tidak valid.",
                },
                { status: 400 }
            );
        }

        /* ==========================================
         * VALIDATE BANK ACCOUNT
         * ========================================== */

        const cleanBankAccountNumber =
            bankAccountNumber
                .trim()
                .replace(/\s/g, "");

        if (
            !/^\d{8,20}$/.test(
                cleanBankAccountNumber
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nomor rekening harus 8-20 digit angka.",
                },
                { status: 400 }
            );
        }

        /* ==========================================
         * SANITIZE INPUTS
         * ========================================== */

        const cleanBankName = bankName
            .trim()
            .substring(0, 100);
        const cleanBankAccountName =
            bankAccountName
                .trim()
                .substring(0, 100);
        const cleanKtpUrl = ktpImageUrl.trim();
        const cleanSocialUrl =
            socialMediaImageUrl.trim();
        const cleanSocialPlatform =
            typeof socialMediaPlatform ===
                "string" &&
            socialMediaPlatform.trim()
                ? socialMediaPlatform
                      .trim()
                      .substring(0, 50)
                : null;
        const cleanSocialUsername =
            typeof socialMediaUsername ===
                "string" &&
            socialMediaUsername.trim()
                ? socialMediaUsername
                      .trim()
                      .substring(0, 100)
                : null;

        /* ==========================================
         * MULTI-ACCOUNT SELF-REFERRAL DETECTION
         * ==========================================
         *
         * Check if the same normalized bank account
         * number is already associated with another
         * APPROVED or PENDING affiliate. If so, reject
         * the application to prevent self-referral abuse.
         *
         * Uses application-level check (not unique
         * constraint) because legitimate affiliates
         * may share a bank account in rare cases.
         */
        const normalizedBank = cleanBankAccountNumber.replace(/^0+/, "") || cleanBankAccountNumber;

        const duplicateBankKyc = await prisma.affiliateKyc.findFirst({
            where: {
                bankAccountNumber: {
                    contains: normalizedBank,
                },
                affiliate: {
                    status: { in: ["APPROVED", "PENDING"] },
                    id: { not: existing?.id ?? -1 },
                },
            },
            select: { id: true },
        });

        if (duplicateBankKyc) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Data rekening ini sudah terdaftar di akun affiliator lain. Silakan hubungi admin jika ini adalah kesalahan.",
                },
                { status: 409 }
            );
        }

        /* ==========================================
         * CREATE OR UPDATE (with P2002 handling)
         * ==========================================
         *
         * If no existing profile → CREATE
         * If existing REJECTED → UPDATE
         * If P2002 race condition → retry as UPDATE
         */

        let application: {
            id: number;
            status: string;
            createdAt: Date;
        };

        try {
            application =
                await prisma.$transaction(
                    async (tx) => {
                        if (
                            existing &&
                            existing.status ===
                                "REJECTED"
                        ) {
                            /* ==========================================
                             * RESUBMIT: UPDATE existing profile
                             * ========================================== */

                            const updated =
                                await tx.affiliateProfile.update(
                                    {
                                        where: {
                                            id: existing.id,
                                        },
                                        data: {
                                            status:
                                                "PENDING",
                                            rejectionReason:
                                                null,
                                            approvedAt:
                                                null,
                                            approvedBy:
                                                null,
                                        },
                                    }
                                );

                            /* ==========================================
                             * UPDATE or CREATE KYC
                             * ========================================== */

                            const kycData = {
                                ktpImageUrl:
                                    cleanKtpUrl,
                                socialMediaUrl:
                                    cleanSocialUrl,
                                bankName:
                                    cleanBankName,
                                bankAccountName:
                                    cleanBankAccountName,
                                bankAccountNumber:
                                    cleanBankAccountNumber,
                                socialMediaPlatform:
                                    cleanSocialPlatform,
                                socialMediaUsername:
                                    cleanSocialUsername,
                            };

                            if (existing.kyc) {
                                // UPDATE existing KYC
                                await tx.affiliateKyc.update(
                                    {
                                        where: {
                                            id: existing
                                                .kyc
                                                .id,
                                        },
                                        data: kycData,
                                    }
                                );
                            } else {
                                // CREATE KYC (shouldn't happen, but safe fallback)
                                await tx.affiliateKyc.create(
                                    {
                                        data: {
                                            affiliateId:
                                                updated.id,
                                            ...kycData,
                                        },
                                    }
                                );
                            }

                            return updated;
                        }

                        /* ==========================================
                         * NEW APPLICATION: CREATE
                         * ========================================== */

                        const profile =
                            await tx.affiliateProfile.create(
                                {
                                    data: {
                                        userId,
                                        status:
                                            "PENDING",
                                        affiliateCode:
                                            "",
                                        commissionRate:
                                            5.0,
                                    },
                                }
                            );                        await tx.affiliateKyc.create(
                            {
                                data: {
                                    affiliateId:
                                        profile.id,
                                    ktpImageUrl:
                                        cleanKtpUrl,
                                    socialMediaUrl:
                                        cleanSocialUrl,
                                    bankName:
                                    cleanBankName,
                                    bankAccountName:
                                    cleanBankAccountName,
                                    bankAccountNumber:
                                    cleanBankAccountNumber,
                                    socialMediaPlatform:
                                    cleanSocialPlatform,
                                    socialMediaUsername:
                                    cleanSocialUsername,
                                },
                            }
                        );

                        return profile;
                    }
                );
        } catch (error: any) {
            /* ==========================================
             * P2002 RACE CONDITION HANDLER
             * ==========================================
             *
             * If two concurrent requests both try to
             * CREATE for the same userId, one will
             * get P2002. We catch it and retry as
             * an UPDATE.
             */

            if (
                error?.code === "P2002" &&
                error?.meta?.target?.includes(
                    "userId"
                )
            ) {
                console.warn(
                    `AFFILIATE_P2002: Race condition for user ${userId}, retrying as update`
                );

                try {
                    application =
                        await prisma.$transaction(
                            async (tx) => {
                                const profile =
                                    await tx.affiliateProfile.update(
                                        {
                                            where: {
                                                userId,
                                            },
                                            data: {
                                                status:
                                                    "PENDING",
                                                rejectionReason:
                                                    null,
                                                approvedAt:
                                                    null,
                                                approvedBy:
                                                    null,
                                            },
                                        }
                                    );

                                // Upsert KYC
                                const existingKyc =
                                    await tx.affiliateKyc.findUnique(
                                        {
                                            where: {
                                                affiliateId:
                                                    profile.id,
                                            },
                                            select: {
                                                id: true,
                                            },
                                        }
                                    );                                const kycData = {
                                    ktpImageUrl:
                                        cleanKtpUrl,
                                    socialMediaUrl:
                                        cleanSocialUrl,
                                    bankName:
                                    cleanBankName,
                                    bankAccountName:
                                    cleanBankAccountName,
                                    bankAccountNumber:
                                    cleanBankAccountNumber,
                                    socialMediaPlatform:
                                    cleanSocialPlatform,
                                    socialMediaUsername:
                                    cleanSocialUsername,
                                };

                                if (existingKyc) {
                                    await tx.affiliateKyc.update(
                                        {
                                            where: {
                                                id: existingKyc.id,
                                            },
                                            data: kycData,
                                        }
                                    );
                                } else {
                                    await tx.affiliateKyc.create(
                                        {
                                            data: {
                                                affiliateId:
                                                    profile.id,
                                                ...kycData,
                                            },
                                        }
                                    );
                                }

                                return profile;
                            }
                        );
                } catch (retryError) {
                    console.error(
                        "AFFILIATE RESUBMIT RETRY FAILED:",
                        retryError
                    );

                    return NextResponse.json(
                        {
                            success: false,
                            message:
                                "Gagal mengirim pengajuan. Silakan cek status pengajuan Anda.",
                        },
                        { status: 409 }
                    );
                }
            } else {
                throw error;
            }
        }

        console.log(
            `AFFILIATE_APPLICATION: User ${userId} submitted application ${application.id} (status: ${application.status})`
        );

        return NextResponse.json(
            {
                success: true,
                message:
                    existing?.status === "REJECTED"
                        ? "Pengajuan ulang berhasil dikirim. Silakan tunggu review dari admin."
                        : "Pengajuan Affiliator berhasil dikirim. Silakan tunggu review dari admin.",
                data: {
                    id: application.id,
                    status: application.status,
                    createdAt:
                        application.createdAt.toISOString(),
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            "SUBMIT AFFILIATE APPLICATION ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengirim pengajuan.",
            },
            { status: 500 }
        );
    }
}
