import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createFlashSale } from "@/lib/marketing/flash-sale";
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
// GET /api/admin/flash-sales
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

        const rawIsActive = searchParams.get("isActive");
        if (rawIsActive === "true") {
            where.isActive = true;
        } else if (rawIsActive === "false") {
            where.isActive = false;
        }

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

        // Optional: filter by active/time status
        const rawStatus = searchParams.get("status");
        if (rawStatus === "active") {
            const now = new Date();
            where.startAt = { lte: now };
            where.endAt = { gte: now };
            where.isActive = true;
            where.saleStock = { gt: 0 };
        } else if (rawStatus === "upcoming") {
            const now = new Date();
            where.startAt = { gt: now };
            where.isActive = true;
        } else if (rawStatus === "ended") {
            const now = new Date();
            where.endAt = { lt: now };
        } else if (rawStatus === "out_of_stock") {
            where.saleStock = { lte: 0 };
        }

        // --- Query ---
        const [flashSales, total] = await Promise.all([
            prisma.flashSale.findMany({
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
                orderBy: { startAt: "desc" },
                take: limit,
                skip: offset,
            }),
            prisma.flashSale.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            success: true,
            data: {
                items: flashSales.map((fs) => ({
                    id: fs.id,
                    name: fs.name,
                    productId: fs.productId,
                    variantId: fs.variantId,
                    salePrice: Number(fs.salePrice),
                    saleStock: fs.saleStock,
                    soldCount: fs.soldCount,
                    purchaseLimit: fs.purchaseLimit,
                    startAt: fs.startAt.toISOString(),
                    endAt: fs.endAt.toISOString(),
                    isActive: fs.isActive,
                    createdAt: fs.createdAt.toISOString(),
                    updatedAt: fs.updatedAt.toISOString(),
                    product: fs.product,
                    variant: fs.variant
                        ? {
                              ...fs.variant,
                              price: Number(fs.variant.price),
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
        console.error("LIST FLASH SALES ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal mengambil data flash sale." },
            { status: 500 }
        );
    }
}

// ==========================================
// POST /api/admin/flash-sales
// ==========================================

export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAdmin();
        if (authResult.error) return authResult.error;

        const body = await request.json();

        // --- name ---
        if (typeof body.name !== "string" || !body.name.trim()) {
            return NextResponse.json(
                { success: false, message: "Nama flash sale wajib diisi." },
                { status: 400 }
            );
        }
        const name = body.name.trim();

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
        if (!body.variantId) {
            return NextResponse.json(
                { success: false, message: "ID variant wajib diisi." },
                { status: 400 }
            );
        }
        const variantId = Number(body.variantId);
        if (!Number.isInteger(variantId) || variantId <= 0) {
            return NextResponse.json(
                { success: false, message: "ID variant tidak valid." },
                { status: 400 }
            );
        }

        // --- salePrice ---
        if (body.salePrice === undefined || body.salePrice === null) {
            return NextResponse.json(
                { success: false, message: "Harga flash sale wajib diisi." },
                { status: 400 }
            );
        }
        const salePrice = Number(body.salePrice);
        if (!Number.isFinite(salePrice) || salePrice <= 0) {
            return NextResponse.json(
                { success: false, message: "Harga flash sale harus lebih dari 0." },
                { status: 400 }
            );
        }

        // --- saleStock ---
        if (body.saleStock === undefined || body.saleStock === null) {
            return NextResponse.json(
                { success: false, message: "Stok flash sale wajib diisi." },
                { status: 400 }
            );
        }
        const saleStock = Number(body.saleStock);
        if (!Number.isInteger(saleStock) || saleStock <= 0) {
            return NextResponse.json(
                { success: false, message: "Stok flash sale harus berupa bilangan bulat lebih dari 0." },
                { status: 400 }
            );
        }

        // --- purchaseLimit ---
        let purchaseLimit: number | null = null;
        if (body.purchaseLimit !== undefined && body.purchaseLimit !== null && body.purchaseLimit !== "") {
            purchaseLimit = Number(body.purchaseLimit);
            if (!Number.isInteger(purchaseLimit) || purchaseLimit < 1) {
                return NextResponse.json(
                    { success: false, message: "Batas pembelian harus minimal 1." },
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

        // --- Create flash sale ---
        const flashSale = await createFlashSale({
            name,
            productId,
            variantId,
            salePrice,
            saleStock,
            purchaseLimit,
            startAt,
            endAt,
            isActive,
        });

        return NextResponse.json(
            {
                success: true,
                data: {
                    id: flashSale.id,
                    name: flashSale.name,
                    productId: flashSale.productId,
                    variantId: flashSale.variantId,
                    salePrice: Number(flashSale.salePrice),
                    saleStock: flashSale.saleStock,
                    soldCount: flashSale.soldCount,
                    purchaseLimit: flashSale.purchaseLimit,
                    startAt: flashSale.startAt.toISOString(),
                    endAt: flashSale.endAt.toISOString(),
                    isActive: flashSale.isActive,
                    createdAt: flashSale.createdAt.toISOString(),
                    updatedAt: flashSale.updatedAt.toISOString(),
                    product: flashSale.product,
                    variant: flashSale.variant,
                },
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("CREATE FLASH SALE ERROR:", error);

        if (error instanceof MarketingError) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: error.statusCode }
            );
        }

        // Map known service errors
        const msg = error?.message ?? "";
        if (msg.includes("Produk atau variant tidak ditemukan")) {
            return NextResponse.json(
                { success: false, message: "Produk atau variant tidak ditemukan." },
                { status: 400 }
            );
        }
        if (msg.includes("sudah memiliki flash sale")) {
            return NextResponse.json(
                { success: false, message: "Variant ini sudah memiliki flash sale. Hapus yang lama terlebih dahulu." },
                { status: 409 }
            );
        }
        if (msg.includes("Tanggal berakhir harus setelah")) {
            return NextResponse.json(
                { success: false, message: "Tanggal berakhir harus setelah tanggal mulai." },
                { status: 400 }
            );
        }
        if (msg.includes("Harga flash sale harus lebih dari 0")) {
            return NextResponse.json(
                { success: false, message: "Harga flash sale harus lebih dari 0." },
                { status: 400 }
            );
        }
        if (msg.includes("Stok flash sale harus lebih dari 0")) {
            return NextResponse.json(
                { success: false, message: "Stok flash sale harus lebih dari 0." },
                { status: 400 }
            );
        }

        // Handle Prisma unique constraint P2002
        if (error?.code === "P2002") {
            return NextResponse.json(
                { success: false, message: "Variant ini sudah memiliki flash sale." },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Gagal membuat flash sale." },
            { status: 500 }
        );
    }
}
