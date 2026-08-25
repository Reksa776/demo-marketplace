import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueAffiliateCode } from "@/lib/affiliate/short-code";
import { createAuditLog } from "@/lib/admin/audit-log";

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

/* ==========================================
 * GET /api/admin/affiliate/applications/[id]
 * ==========================================
 *
 * Admin endpoint to view a single affiliate
 * application with full KYC details.
 */

export async function GET(
    req: Request,
    { params }: RouteContext
) {
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

        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Forbidden.",
                },
                { status: 403 }
            );
        }

        const { id } = await params;

        const applicationId = Number(id);

        if (
            !Number.isInteger(applicationId) ||
            applicationId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "ID pengajuan tidak valid.",
                },
                { status: 400 }
            );
        }

        const application =
            await prisma.affiliateProfile.findUnique(
                {
                    where: {
                        id: applicationId,
                    },
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                            },
                        },
                        kyc: true,
                    },
                }
            );

        if (!application) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Pengajuan tidak ditemukan.",
                },
                { status: 404 }
            );
        }

        /* ==========================================
         * RESPONSE WITH FULL KYC DATA
         * ==========================================
         *
         * Admin sees full data including
         * bank account number (needed for review).
         */

        const data = {
            id: application.id,
            userId: application.userId,
            status: application.status,
            affiliateCode: application.affiliateCode,
            rejectionReason:
                application.rejectionReason,
            approvedAt: application.approvedAt
                ? application.approvedAt.toISOString()
                : null,
            createdAt:
                application.createdAt.toISOString(),
            updatedAt:
                application.updatedAt.toISOString(),

            user: application.user
                ? {
                      id: application.user.id,
                      name: application.user.name,
                      email: application.user.email,
                      phone: application.user.phone,
                  }
                : null,

            kyc: application.kyc
                ? {
                      ktpImageUrl:
                          application.kyc
                              .ktpImageUrl,
                      ktpName:
                          application.kyc.ktpName,
                      ktpNumber:
                          application.kyc
                              .ktpNumber,
                      bankName:
                          application.kyc.bankName,
                      bankAccountName:
                          application.kyc
                              .bankAccountName,
                      bankAccountNumber:
                          application.kyc
                              .bankAccountNumber,
                      socialMediaPlatform:
                          application.kyc
                              .socialMediaPlatform,
                      socialMediaUsername:
                          application.kyc
                              .socialMediaUsername,
                      socialMediaUrl:
                          application.kyc
                              .socialMediaUrl,
                  }
                : null,
        };

        return NextResponse.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error(
            "ADMIN AFFILIATE DETAIL ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil detail pengajuan.",
            },
            { status: 500 }
        );
    }
}

/* ==========================================
 * PATCH /api/admin/affiliate/applications/[id]
 * ==========================================
 *
 * Admin endpoint to approve or reject
 * an affiliate application.
 *
 * Body:
 *   - action: "APPROVE" | "REJECT"
 *   - rejectionReason?: string (required if REJECT)
 */

export async function PATCH(
    req: Request,
    { params }: RouteContext
) {
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

        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Forbidden.",
                },
                { status: 403 }
            );
        }

        const { id } = await params;

        const applicationId = Number(id);

        if (
            !Number.isInteger(applicationId) ||
            applicationId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "ID pengajuan tidak valid.",
                },
                { status: 400 }
            );
        }

        /* ==========================================
         * PARSE BODY
         * ========================================== */

        let body: Record<string, unknown>;

        try {
            body = await req.json();
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

        const { action, rejectionReason } = body;

        if (
            !action ||
            (action !== "APPROVE" &&
                action !== "REJECT")
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Action harus APPROVE atau REJECT.",
                },
                { status: 400 }
            );
        }

        /* ==========================================
         * REJECT REQUIRES REASON
         * ========================================== */

        if (action === "REJECT") {
            if (
                !rejectionReason ||
                typeof rejectionReason !==
                    "string" ||
                !rejectionReason.trim()
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Alasan penolakan wajib diisi.",
                    },
                    { status: 400 }
                );
            }
        }

        /* ==========================================
         * FIND APPLICATION
         * ========================================== */

        const application =
            await prisma.affiliateProfile.findUnique(
                {
                    where: {
                        id: applicationId,
                    },
                    select: {
                        id: true,
                        userId: true,
                        status: true,
                        affiliateCode: true,
                    },
                }
            );

        if (!application) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Pengajuan tidak ditemukan.",
                },
                { status: 404 }
            );
        }

        /* ==========================================
         * VALIDATE STATUS
         * ========================================== */

        if (
            application.status !== "PENDING"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Pengajuan sudah ${application.status}. Tidak dapat direview.`,
                },
                { status: 400 }
            );
        }

        /* ==========================================
         * PROCESS ACTION
         * ========================================== */

        if (action === "APPROVE") {
            /* ==========================================
             * MULTI-ACCOUNT SELF-REFERRAL DETECTION
             * ==========================================
             *
             * Defense-in-depth: check if the same bank
             * account is already associated with another
             * APPROVED affiliate before approving.
             */
            const existingKyc = await prisma.affiliateKyc.findUnique({
                where: { affiliateId: applicationId },
                select: { bankAccountNumber: true },
            });

            if (existingKyc?.bankAccountNumber) {
                const normalizedBank = existingKyc.bankAccountNumber.replace(/^0+/, "") || existingKyc.bankAccountNumber;
                const duplicateBank = await prisma.affiliateKyc.findFirst({
                    where: {
                        bankAccountNumber: { contains: normalizedBank },
                        affiliate: {
                            status: "APPROVED",
                            id: { not: applicationId },
                        },
                    },
                    select: { id: true },
                });

                if (duplicateBank) {
                    return NextResponse.json(
                        { success: false, message: "Data rekening ini sudah terdaftar di affiliator lain. Pengajuan tidak dapat disetujui." },
                        { status: 409 }
                    );
                }
            }

            /* ==========================================
             * APPROVE: Generate short affiliate code
             * ==========================================
             *
             * 6-char uppercase alphanumeric.
             * Collision-safe with retry.
             */

            const affiliateCode =
                await generateUniqueAffiliateCode();

            await prisma.affiliateProfile.update({
                where: {
                    id: applicationId,
                },
                data: {
                    status: "APPROVED",
                    affiliateCode,
                    approvedAt: new Date(),
                    approvedBy: session.user.id,
                },
            });

            console.log(
                `AFFILIATE_APPROVE: Admin ${session.user.id} approved application ${applicationId} for user ${application.userId}`
            );

            await createAuditLog({
                adminId: session.user.id,
                action: "AFFILIATE_APPROVED",
                entityType: "AffiliateProfile",
                entityId: applicationId,
                description: `Affiliate disetujui. Kode: ${affiliateCode}`,
                metadata: { affiliateCode, userId: application.userId },
            });

            return NextResponse.json({
                success: true,
                message:
                    "Pengajuan berhasil disetujui.",
                data: {
                    id: applicationId,
                    status: "APPROVED",
                    affiliateCode,
                },
            });
        }

        /* ==========================================
         * REJECT
         * ========================================== */

        await prisma.affiliateProfile.update({
            where: {
                id: applicationId,
            },
            data: {
                status: "REJECTED",
                rejectionReason:
                    String(rejectionReason!).trim(),
            },
        });

        console.log(
            `AFFILIATE_REJECT: Admin ${session.user.id} rejected application ${applicationId}`
        );

        await createAuditLog({
            adminId: session.user.id,
            action: "AFFILIATE_REJECTED",
            entityType: "AffiliateProfile",
            entityId: applicationId,
            description: `Affiliate ditolak: ${String(rejectionReason!).trim()}`,
            metadata: { reason: String(rejectionReason!).trim(), userId: application.userId },
        });

        return NextResponse.json({
            success: true,
            message:
                "Pengajuan berhasil ditolak.",
            data: {
                id: applicationId,
                status: "REJECTED",
            },
        });
    } catch (error) {
        console.error(
            "ADMIN AFFILIATE REVIEW ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal memproses review.",
            },
            { status: 500 }
        );
    }
}


