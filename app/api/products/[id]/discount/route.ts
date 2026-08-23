/**
 * ==========================================
 * PUBLIC PRODUCT DISCOUNT
 * ==========================================
 *
 * GET /api/products/[id]/discount
 *
 * Returns the active discount for a product/variant.
 * No ADMIN auth required.
 *
 * Query params:
 *   variantId — optional variant ID
 *
 * Only returns discounts that are:
 *   - isActive = true
 *   - startAt <= now
 *   - endAt >= now
 *
 * 404 when no active discount exists.
 *
 * IMPORTANT:
 *   - ProductVariant.price is NEVER modified
 *   - ProductVariant.stock is NEVER modified
 *   - This is READ-ONLY
 */

import { NextResponse } from "next/server";
import {
    getActiveProductDiscount,
    calculateDiscountedPrice,
} from "@/lib/marketing/discount";

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
        const { id: productIdStr } = await params;

        // ==========================================
        // VALIDATE PRODUCT ID
        // ==========================================

        const productId = Number(productIdStr);

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "ID produk tidak valid.",
                },
                { status: 400 }
            );
        }

        // ==========================================
        // PARSE VARIANT ID (OPTIONAL)
        // ==========================================

        const { searchParams } = new URL(
            _request.url
        );

        const variantIdParam =
            searchParams.get("variantId");

        let variantId: number | null = null;

        if (variantIdParam) {
            variantId = Number(variantIdParam);

            if (
                !Number.isInteger(variantId) ||
                variantId <= 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "ID variant tidak valid.",
                    },
                    { status: 400 }
                );
            }
        }

        // ==========================================
        // FETCH ACTIVE DISCOUNT
        // ==========================================

        const now = new Date();

        const discount =
            await getActiveProductDiscount(
                productId,
                variantId,
                now
            );

        if (!discount) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Tidak ada diskon aktif untuk produk ini.",
                },
                { status: 404 }
            );
        }

        // ==========================================
        // CALCULATE DISCOUNTED PRICE
        // ==========================================
        //
        // We need the original price to calculate
        // the final price. Fetch variant.

        const { prisma } = await import(
            "@/lib/prisma"
        );

        const variant =
            await prisma.productVariant.findUnique({
                where: { id: discount.variantId ?? undefined },
                select: {
                    id: true,
                    price: true,
                    productId: true,
                },
            });

        // Fallback: if variantId is null on the
        // discount, fetch any variant for the product
        let originalPrice = 0;

        if (variant) {
            originalPrice = Number(variant.price);
        } else {
            // Discount is product-wide; get first
            // variant price as reference
            const firstVariant =
                await prisma.productVariant.findFirst(
                    {
                        where: {
                            productId,
                        },
                        select: {
                            price: true,
                        },
                        orderBy: { id: "asc" },
                    }
                );

            if (firstVariant) {
                originalPrice = Number(
                    firstVariant.price
                );
            }
        }

        const calculation =
            calculateDiscountedPrice(
                originalPrice,
                discount
            );

        // ==========================================
        // FORMAT RESPONSE
        // ==========================================

        return NextResponse.json({
            success: true,
            data: {
                productDiscountId: discount.id,
                productId: discount.productId,
                variantId: discount.variantId,
                type: discount.type,
                value: Number(discount.value),
                maxDiscount: discount.maxDiscount
                    ? Number(discount.maxDiscount)
                    : null,
                startAt: discount.startAt.toISOString(),
                endAt: discount.endAt.toISOString(),
                originalPrice:
                    calculation.originalPrice,
                discountAmount:
                    calculation.discountAmount,
                finalPrice: calculation.finalPrice,
            },
        });
    } catch (error) {
        console.error(
            "GET PUBLIC PRODUCT DISCOUNT ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil diskon produk.",
            },
            { status: 500 }
        );
    }
}
