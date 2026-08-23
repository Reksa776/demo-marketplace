/**
 * ==========================================
 * PUBLIC FLASH SALE LIST
 * ==========================================
 *
 * GET /api/flash-sales
 *
 * Returns active flash sales.
 * No ADMIN auth required.
 *
 * Query params:
 *   page  — page number (default 1)
 *   limit — items per page (default 20, max 50)
 *
 * Only returns flash sales that are:
 *   - isActive = true
 *   - startAt <= now
 *   - endAt >= now
 *   - saleStock > 0
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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(
            request.url
        );

        // ==========================================
        // PARSE & VALIDATE QUERY PARAMS
        // ==========================================

        const page = Math.max(
            1,
            parseInt(
                searchParams.get("page") ?? "1",
                10
            ) || 1
        );

        const limit = Math.min(
            50,
            Math.max(
                1,
                parseInt(
                    searchParams.get("limit") ??
                        "20",
                    10
                ) || 20
            )
        );

        const offset = (page - 1) * limit;

        // ==========================================
        // BUILD WHERE CLAUSE
        // ==========================================

        const now = new Date();

        const where = {
            isActive: true,
            startAt: { lte: now },
            endAt: { gte: now },
            saleStock: { gt: 0 },
        };

        // ==========================================
        // FETCH FLASH SALES
        // ==========================================

        const [flashSales, total] =
            await Promise.all([
                prisma.flashSale.findMany({
                    where,
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                image: true,
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
                    orderBy: {
                        startAt: "asc",
                    },
                    take: limit,
                    skip: offset,
                }),
                prisma.flashSale.count({ where }),
            ]);

        // ==========================================
        // FORMAT RESPONSE
        // ==========================================

        const items = flashSales.map((sale) => ({
            id: sale.id,
            name: sale.name,
            salePrice: Number(sale.salePrice),
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
                category: sale.product.category,
            },
            variant: {
                id: sale.variant.id,
                name: sale.variant.name,
                originalPrice: Number(
                    sale.variant.price
                ),
                image: sale.variant.image,
            },
            discount: Math.max(
                0,
                Number(sale.variant.price) -
                    Number(sale.salePrice)
            ),
        }));

        return NextResponse.json({
            success: true,
            data: {
                items,
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
            "GET PUBLIC FLASH SALES ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil data flash sale.",
            },
            { status: 500 }
        );
    }
}
