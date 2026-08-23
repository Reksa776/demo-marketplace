import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/* ==========================================
 * GET /api/admin/vouchers
 * ==========================================
 *
 * Query params:
 *   page   — page number (default 1)
 *   limit  — items per page (default 20, max 100)
 *   search — optional search by code
 *   isActive — optional boolean filter
 */

export async function GET(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Silakan login terlebih dahulu.",
                },
                { status: 401 }
            );
        }

        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Akses ditolak.",
                },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(
            request.url
        );

        // ==========================================
        // PARSE & VALIDATE PAGINATION
        // ==========================================

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

        // ==========================================
        // PARSE FILTERS
        // ==========================================

        const search =
            searchParams
                .get("search")
                ?.trim() || undefined;

        const isActiveParam =
            searchParams.get("isActive");

        const where: any = {};

        if (search) {
            where.code = {
                contains: search,
            };
        }

        if (
            isActiveParam === "true" ||
            isActiveParam === "false"
        ) {
            where.isActive =
                isActiveParam === "true";
        }

        // ==========================================
        // FETCH WITH PAGINATION
        // ==========================================

        const [vouchers, total] =
            await Promise.all([
                prisma.voucher.findMany({
                    where,
                    orderBy: {
                        createdAt: "desc",
                    },
                    take: limit,
                    skip: offset,
                }),
                prisma.voucher.count({
                    where,
                }),
            ]);

        return NextResponse.json({
            success: true,
            data: {
                items: vouchers,
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
            "LIST VOUCHERS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil data voucher.",
            },
            { status: 500 }
        );
    }
}

/* ==========================================
 * POST /api/admin/vouchers
 * ==========================================
 */

export async function POST(
    request: Request
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Silakan login terlebih dahulu.",
                },
                { status: 401 }
            );
        }

        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Akses ditolak.",
                },
                { status: 403 }
            );
        }

        const body = await request.json();

        const {
            code,
            description,
            type,
            value,
            maxDiscount,
            minPurchase,
            quota,
            isActive,
            startDate,
            endDate,
        } = body;

        /* ==========================================
         * VALIDASI
         * ========================================== */

        if (
            typeof code !== "string" ||
            !code.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Kode voucher wajib diisi.",
                },
                { status: 400 }
            );
        }

        const normalizedCode =
            code.trim().toUpperCase();

        if (
            type !== "PERCENTAGE" &&
            type !== "FIXED"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Tipe voucher tidak valid.",
                },
                { status: 400 }
            );
        }

        const numericValue = Number(value);

        if (
            !Number.isFinite(numericValue) ||
            numericValue <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nilai voucher tidak valid.",
                },
                { status: 400 }
            );
        }

        if (
            type === "PERCENTAGE" &&
            numericValue > 100
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Persentase voucher tidak boleh lebih dari 100%.",
                },
                { status: 400 }
            );
        }

        /* ==========================================
         * CEK DUPLIKAT KODE
         * ========================================== */

        const existing =
            await prisma.voucher.findUnique({
                where: {
                    code: normalizedCode,
                },
            });

        if (existing) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Kode voucher sudah digunakan.",
                },
                { status: 409 }
            );
        }

        /* ==========================================
         * CAMPAIGN ASSIGNMENT (OPTIONAL)
         * ==========================================
         */
        let campaignId: number | null = null;

        if (body.campaignId !== undefined && body.campaignId !== null) {
            const cid = Number(body.campaignId);
            if (!Number.isInteger(cid) || cid <= 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "ID kampanye tidak valid.",
                    },
                    { status: 400 }
                );
            }

            const campaign = await prisma.campaign.findUnique({
                where: { id: cid },
                select: { id: true, status: true, startAt: true, endAt: true },
            });

            if (!campaign) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Kampanye tidak ditemukan.",
                    },
                    { status: 404 }
                );
            }

            const now = new Date();
            const isActive =
                campaign.status === "ACTIVE" &&
                now >= campaign.startAt &&
                now <= campaign.endAt;

            if (!isActive) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Hanya bisa mengaitkan voucher dengan kampanye yang sedang aktif.",
                    },
                    { status: 400 }
                );
            }

            campaignId = cid;
        }

        const voucher =
            await prisma.voucher.create({
                data: {
                    code: normalizedCode,
                    description:
                        description || null,
                    type,
                    value: numericValue,
                    maxDiscount:
                        type === "PERCENTAGE" &&
                        maxDiscount
                            ? Number(maxDiscount)
                            : null,
                    minPurchase: minPurchase
                        ? Number(minPurchase)
                        : null,
                    quota: quota
                        ? Number(quota)
                        : null,
                    isActive: isActive ?? true,
                    startDate: startDate
                        ? new Date(startDate)
                        : null,
                    endDate: endDate
                        ? new Date(endDate)
                        : null,
                    ...(campaignId !== null ? { campaignId } : {}),
                },
            });

        return NextResponse.json({
            success: true,
            data: voucher,
        });
    } catch (error) {
        console.error(
            "CREATE VOUCHER ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal membuat voucher.",
            },
            { status: 500 }
        );
    }
}
