/**
 * ==========================================
 * PUBLIC FLASH SALE DETAIL
 * ==========================================
 *
 * GET /api/flash-sales/[id]
 *
 * Returns a single flash sale by ID.
 * No ADMIN auth required.
 *
 * Only returns flash sales that are:
 *   - isActive = true
 *   - startAt <= now
 *   - endAt >= now
 *
 * 404 for:
 *   - nonexistent ID
 *   - inactive/expired flash sale
 *
 * IMPORTANT:
 *   - ProductVariant.price is NEVER modified
 *   - ProductVariant.stock is NEVER modified
 *   - No stock reservation is performed here
 *   - remainingStock = max(0, saleStock - soldCount)
 */

import { NextResponse } from "next/server";
import {
    prisma,
} from "@/lib/prisma";

export async function GET(
    _request: Request,
    {
        params,
    }: {
        params: Promise<{
            id: string;
        }>;
    }
) {
    try {
        const { id: idStr } = await params;

        // ==========================================
        // VALIDATE ID
        // ==========================================

        const id = Number(idStr);

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "ID tidak valid.",
                },
                { status: 400 }
            );
        }

        // ==========================================
        // FETCH FLASH SALE
        // ==========================================

        const sale =
            await prisma.flashSale.findUnique({
                where: { id },
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            image: true,
                            description: true,
                            category: true,
                        },
                    },
                    variant: {
                        select: {
                            id: true,
                            name: true,
                            price: true,
                            image: true,
                            stock: true,
                        },
                    },
                },
            });

        if (!sale) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Flash sale tidak ditemukan.",
                },
                { status: 404 }
            );
        }

        // ==========================================
        // CHECK PUBLIC ELIGIBILITY
        // ==========================================

        const now = new Date();

        if (!sale.isActive) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Flash sale tidak ditemukan.",
                },
                { status: 404 }
            );
        }

        if (sale.startAt > now) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Flash sale belum dimulai.",
                },
                { status: 404 }
            );
        }

        if (sale.endAt < now) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Flash sale sudah berakhir.",
                },
                { status: 404 }
            );
        }

        // ==========================================
        // FORMAT RESPONSE
        // ==========================================

        const originalPrice = Number(
            sale.variant.price
        );
        const salePrice = Number(sale.salePrice);

        return NextResponse.json({
            success: true,
            data: {
                id: sale.id,
                name: sale.name,
                salePrice,
                saleStock: sale.saleStock,
                soldCount: sale.soldCount,
                remainingStock: Math.max(
                    0,
                    sale.saleStock - sale.soldCount
                ),
                purchaseLimit: sale.purchaseLimit,
                startAt: sale.startAt.toISOString(),
                endAt: sale.endAt.toISOString(),
                product: {
                    id: sale.product.id,
                    name: sale.product.name,
                    slug: sale.product.slug,
                    image: sale.product.image,
                    description:
                        sale.product.description,
                    category: sale.product.category,
                },
                variant: {
                    id: sale.variant.id,
                    name: sale.variant.name,
                    originalPrice,
                    image: sale.variant.image,
                },
                discount: Math.max(
                    0,
                    originalPrice - salePrice
                ),
            },
        });
    } catch (error) {
        console.error(
            "GET PUBLIC FLASH SALE DETAIL ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil detail flash sale.",
            },
            { status: 500 }
        );
    }
}
