import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/* ==========================================
 * GET /api/admin/affiliate/applications
 * ==========================================
 *
 * Admin endpoint to list all affiliate
 * applications with pagination and status filter.
 *
 * Query params:
 *   - page (default 1)
 *   - limit (default 20, max 100)
 *   - status (PENDING, APPROVED, REJECTED, ALL)
 *   - search (by user name/email)
 */

export async function GET(request: Request) {
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

        const { searchParams } = new URL(
            request.url
        );

        const rawPage = Number(
            searchParams.get("page") ?? "1"
        );
        const rawLimit = Number(
            searchParams.get("limit") ?? "20"
        );

        const page =
            Number.isInteger(rawPage) &&
            rawPage > 0
                ? rawPage
                : 1;

        const limit = Math.min(
            100,
            Math.max(
                1,
                Number.isInteger(rawLimit) &&
                    rawLimit > 0
                    ? rawLimit
                    : 20
            )
        );

        const offset = (page - 1) * limit;

        const statusParam =
            searchParams.get("status");

        const search =
            searchParams
                .get("search")
                ?.trim() || undefined;

        /* ==========================================
         * BUILD WHERE CLAUSE
         * ========================================== */

        const where: any = {};

        if (
            statusParam &&
            statusParam !== "ALL"
        ) {
            where.status = statusParam;
        }

        if (search) {
            where.user = {
                OR: [
                    {
                        name: {
                            contains: search,
                        },
                    },
                    {
                        email: {
                            contains: search,
                        },
                    },
                ],
            };
        }

        /* ==========================================
         * FETCH APPLICATIONS
         * ========================================== */

        const [applications, total] =
            await Promise.all([
                prisma.affiliateProfile.findMany({
                    where,
                    orderBy: {
                        createdAt: "desc",
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
                        kyc: {
                            select: {
                                bankName: true,
                                bankAccountName: true,
                                bankAccountNumber: true,
                                ktpImageUrl: true,
                                socialMediaPlatform: true,
                                socialMediaUsername: true,
                            },
                        },
                    },
                    take: limit,
                    skip: offset,
                }),
                prisma.affiliateProfile.count({
                    where,
                }),
            ]);

        /* ==========================================
         * MASK SENSITIVE DATA IN LIST
         * ==========================================
         *
         * In the list view, mask bank account
         * number. Full data shown in detail view.
         */

        const data = applications.map((app) => ({
            id: app.id,
            userId: app.userId,
            status: app.status,
            affiliateCode: app.affiliateCode,
            rejectionReason: app.rejectionReason,
            approvedAt: app.approvedAt
                ? app.approvedAt.toISOString()
                : null,
            createdAt:
                app.createdAt.toISOString(),
            updatedAt:
                app.updatedAt.toISOString(),

            user: app.user
                ? {
                      id: app.user.id,
                      name: app.user.name,
                      email: app.user.email,
                      phone: app.user.phone,
                  }
                : null,

            kyc: app.kyc
                ? {
                      bankName: app.kyc.bankName,
                      bankAccountName:
                          app.kyc.bankAccountName,
                      bankAccountNumber:
                          maskAccountNumber(
                              app.kyc
                                  .bankAccountNumber
                          ),
                      ktpImageUrl:
                          app.kyc.ktpImageUrl,
                      socialMediaPlatform:
                          app.kyc
                              .socialMediaPlatform,
                      socialMediaUsername:
                          app.kyc
                              .socialMediaUsername,
                  }
                : null,
        }));

        return NextResponse.json({
            success: true,
            data: {
                items: data,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(
                        total / limit
                    ),
                },
            },
        });
    } catch (error) {
        console.error(
            "ADMIN AFFILIATE LIST ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil daftar pengajuan.",
            },
            { status: 500 }
        );
    }
}

/* ==========================================
 * MASK ACCOUNT NUMBER
 * ==========================================
 *
 * Shows only last 4 digits:
 * 1234567890 → ******7890
 */

function maskAccountNumber(
    number: string | null
): string {
    if (!number) return "-";

    if (number.length <= 4) {
        return "*".repeat(number.length);
    }

    const visible = number.slice(-4);
    const masked =
        "*".repeat(number.length - 4);

    return masked + visible;
}
