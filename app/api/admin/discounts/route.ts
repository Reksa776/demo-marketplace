import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createProductDiscount } from "@/lib/marketing/discount";
import { MarketingError } from "@/lib/marketing/errors";

// ==========================================
// AUTH HELPER
// ==========================================

async function requireAdmin() {
    const session = await auth();

    if (!session?.user?.id) {
        return {
            error: NextResponse.json(
                { success: false, message: "Silakan login terlebih dahulu." },
                { status: 401 }
            ),
        };
    }

    if (session.user.role !== "ADMIN") {
        return {
            error: NextResponse.json(
                { success: false, message: "Akses ditolak." },
                { status: 403 }
            ),
        };
    }

    return { session };
}

// ==========================================
// VALID TYPES
// ==========================================

const VALID_DISCOUNT_TYPES = ["PERCENTAGE", "FIXED"] as const;

type ValidDiscountType = (typeof VALID_DISCOUNT_TYPES)[number];

function isValidDiscountType(v: string): v is ValidDiscountType {
    return (VALID_DISCOUNT_TYPES as readonly string[]).includes(v);
}

// ==========================================
// GET /api/admin/discounts
// ==========================================

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAdmin();
        if (authResult.error) return authResult.error;

        const { searchParams } = new URL(request.url);

        // --- Pagination ---
        const rawPage = Number(searchParams.get("page") ?? "1");
        const rawLimit = Number(searchParams.get("limit") ?? "20");

        const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
        const limit =
            Number.isInteger(rawLimit) && rawLimit > 0 && rawLimit <= 100
                ? rawLimit
                : 20;
        const offset = (page - 1) * limit;

        // --- Filters ---
        const where: any = {};

        const rawProductId = searchParams.get("productId");
        if (rawProductId) {
            const pid = Number(rawProductId);
            if (Number.isInteger(pid) && pid > 0) {
                where.productId = pid;
            }
        }

        const rawVariantId = searchParams.get("variantId");
        if (rawVariantId) {
            const vid = Number(rawVariantId);
            if (Number.isInteger(vid) && vid > 0) {
                where.variantId = vid;
            }
        }

        const rawIsActive = searchParams.get("isActive");
        if (rawIsActive === "true") {
            where.isActive = true;
        } else if (rawIsActive === "false") {
            where.isActive = false;
        }

        // --- Query ---
        const [discounts, total] = await Promise.all([
            prisma.productDiscount.findMany({
                where,
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            image: true,
                        },
                    },
                    variant: {
                        select: {
                            id: true,
                            name: true,
                            price: true,
                            stock: true,
                            image: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset,
            }),
            prisma.productDiscount.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            success: true,
            data: {
                items: discounts.map((d) => ({
                    id: d.id,
                    productId: d.productId,
                    variantId: d.variantId,
                    type: d.type,
                    value: Number(d.value),
                    maxDiscount: d.maxDiscount ? Number(d.maxDiscount) : null,
                    startAt: d.startAt.toISOString(),
                    endAt: d.endAt.toISOString(),
                    isActive: d.isActive,
                    createdAt: d.createdAt.toISOString(),
                    updatedAt: d.updatedAt.toISOString(),
                    product: d.product,
                    variant: d.variant
                        ? {
                              ...d.variant,
                              price: Number(d.variant.price),
                          }
                        : null,
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                },
            },
        });
    } catch (error) {
        console.error("LIST DISCOUNTS ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal mengambil data diskon." },
            { status: 500 }
        );
    }
}

// ==========================================
// POST /api/admin/discounts
// ==========================================

export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAdmin();
        if (authResult.error) return authResult.error;

        const body = await request.json();

        // --- productId ---
        if (!body.productId) {
            return NextResponse.json(
                { success: false, message: "ID produk wajib diisi." },
                { status: 400 }
            );
        }
        const productId = Number(body.productId);
        if (!Number.isInteger(productId) || productId <= 0) {
            return NextResponse.json(
                { success: false, message: "ID produk tidak valid." },
                { status: 400 }
            );
        }

        // --- variantId ---
        let variantId: number | null = null;
        if (body.variantId !== undefined && body.variantId !== null && body.variantId !== "") {
            variantId = Number(body.variantId);
            if (!Number.isInteger(variantId) || variantId <= 0) {
                return NextResponse.json(
                    { success: false, message: "ID variant tidak valid." },
                    { status: 400 }
                );
            }
        }

        // --- type ---
        if (!body.type || !isValidDiscountType(body.type)) {
            return NextResponse.json(
                { success: false, message: "Tipe diskon wajib diisi dan harus PERCENTAGE atau FIXED." },
                { status: 400 }
            );
        }
        const type: ValidDiscountType = body.type;

        // --- value ---
        if (body.value === undefined || body.value === null) {
            return NextResponse.json(
                { success: false, message: "Nilai diskon wajib diisi." },
                { status: 400 }
            );
        }
        const value = Number(body.value);
        if (!Number.isFinite(value) || value <= 0) {
            return NextResponse.json(
                { success: false, message: "Nilai diskon harus lebih dari 0." },
                { status: 400 }
            );
        }
        if (type === "PERCENTAGE" && value > 100) {
            return NextResponse.json(
                { success: false, message: "Persentase diskon tidak boleh lebih dari 100%." },
                { status: 400 }
            );
        }

        // --- maxDiscount ---
        let maxDiscount: number | null = null;
        if (body.maxDiscount !== undefined && body.maxDiscount !== null && body.maxDiscount !== "") {
            if (type !== "PERCENTAGE") {
                return NextResponse.json(
                    { success: false, message: "Diskon maksimal hanya berlaku untuk tipe PERCENTAGE." },
                    { status: 400 }
                );
            }
            maxDiscount = Number(body.maxDiscount);
            if (!Number.isFinite(maxDiscount) || maxDiscount <= 0) {
                return NextResponse.json(
                    { success: false, message: "Diskon maksimal harus lebih dari 0." },
                    { status: 400 }
                );
            }
        }

        // --- startAt ---
        if (!body.startAt) {
            return NextResponse.json(
                { success: false, message: "Tanggal mulai wajib diisi." },
                { status: 400 }
            );
        }
        const startAt = new Date(body.startAt);
        if (isNaN(startAt.getTime())) {
            return NextResponse.json(
                { success: false, message: "Tanggal mulai tidak valid." },
                { status: 400 }
            );
        }

        // --- endAt ---
        if (!body.endAt) {
            return NextResponse.json(
                { success: false, message: "Tanggal berakhir wajib diisi." },
                { status: 400 }
            );
        }
        const endAt = new Date(body.endAt);
        if (isNaN(endAt.getTime())) {
            return NextResponse.json(
                { success: false, message: "Tanggal berakhir tidak valid." },
                { status: 400 }
            );
        }
        if (endAt <= startAt) {
            return NextResponse.json(
                { success: false, message: "Tanggal berakhir harus setelah tanggal mulai." },
                { status: 400 }
            );
        }

        // --- isActive ---
        const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

        // --- Create ---
        const discount = await createProductDiscount({
            productId,
            variantId,
            type,
            value,
            maxDiscount,
            startAt,
            endAt,
            isActive,
        });

        return NextResponse.json(
            {
                success: true,
                data: {
                    id: discount.id,
                    productId: discount.productId,
                    variantId: discount.variantId,
                    type: discount.type,
                    value: Number(discount.value),
                    maxDiscount: discount.maxDiscount ? Number(discount.maxDiscount) : null,
                    startAt: discount.startAt.toISOString(),
                    endAt: discount.endAt.toISOString(),
                    isActive: discount.isActive,
                    createdAt: discount.createdAt.toISOString(),
                    updatedAt: discount.updatedAt.toISOString(),
                },
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("CREATE DISCOUNT ERROR:", error);

        if (error instanceof MarketingError) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: error.statusCode }
            );
        }

        // Map known service errors
        const msg = error?.message ?? "";
        if (msg.includes("Produk tidak ditemukan")) {
            return NextResponse.json(
                { success: false, message: "Produk tidak ditemukan." },
                { status: 400 }
            );
        }
        if (msg.includes("Variant tidak ditemukan")) {
            return NextResponse.json(
                { success: false, message: "Variant tidak ditemukan untuk produk ini." },
                { status: 400 }
            );
        }
        if (msg.includes("Tanggal berakhir harus setelah")) {
            return NextResponse.json(
                { success: false, message: "Tanggal berakhir harus setelah tanggal mulai." },
                { status: 400 }
            );
        }
        if (msg.includes("Nilai diskon harus lebih dari 0")) {
            return NextResponse.json(
                { success: false, message: "Nilai diskon harus lebih dari 0." },
                { status: 400 }
            );
        }
        if (msg.includes("Persentase diskon tidak boleh lebih dari 100%")) {
            return NextResponse.json(
                { success: false, message: "Persentase diskon tidak boleh lebih dari 100%." },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Gagal membuat diskon." },
            { status: 500 }
        );
    }
}
