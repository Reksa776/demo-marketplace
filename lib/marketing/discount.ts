import { prisma } from "@/lib/prisma";
import { Voucher_type } from "@prisma/client";
import { DiscountNotFoundError } from "./errors";

/**
 * ==========================================
 * PRODUCT DISCOUNT SERVICE
 * ==========================================
 *
 * Manages per-product and per-variant discounts.
 *
 * IMPORTANT:
 * - ProductDiscount does NOT modify ProductVariant.price
 * - Original price remains untouched
 * - Discount is calculated at query time
 *
 * Priority: variant-specific > product-wide
 * Only active discounts within startAt/endAt apply.
 */

// ==========================================
// TYPES
// ==========================================

export type DiscountCalculationResult = {
    originalPrice: number;
    discountAmount: number;
    finalPrice: number;
    discountType: Voucher_type;
    discountValue: number;
    maxDiscount: number | null;
    productDiscountId: number;
};

// ==========================================
// CRUD OPERATIONS
// ==========================================

/**
 * Create a product discount.
 */
export async function createProductDiscount(data: {
    productId: number;
    variantId?: number | null;
    type: Voucher_type;
    value: number;
    maxDiscount?: number | null;
    startAt: Date;
    endAt: Date;
    isActive?: boolean;
}) {
    if (data.endAt <= data.startAt) {
        throw new Error("Tanggal berakhir harus setelah tanggal mulai.");
    }

    if (data.value <= 0) {
        throw new Error("Nilai diskon harus lebih dari 0.");
    }

    if (data.type === "PERCENTAGE" && data.value > 100) {
        throw new Error("Persentase diskon tidak boleh lebih dari 100%.");
    }

    // Validate product exists
    const product = await prisma.product.findUnique({
        where: { id: data.productId },
    });

    if (!product) {
        throw new Error("Produk tidak ditemukan.");
    }

    // Validate variant exists if provided
    if (data.variantId) {
        const variant = await prisma.productVariant.findFirst({
            where: {
                id: data.variantId,
                productId: data.productId,
            },
        });

        if (!variant) {
            throw new Error("Variant tidak ditemukan untuk produk ini.");
        }
    }

    return prisma.productDiscount.create({
        data: {
            productId: data.productId,
            variantId: data.variantId ?? null,
            type: data.type,
            value: data.value,
            maxDiscount: data.maxDiscount ?? null,
            startAt: data.startAt,
            endAt: data.endAt,
            isActive: data.isActive ?? true,
        },
    });
}

/**
 * Update a product discount.
 */
export async function updateProductDiscount(
    id: number,
    data: {
        type?: Voucher_type;
        value?: number;
        maxDiscount?: number | null;
        startAt?: Date;
        endAt?: Date;
        isActive?: boolean;
    }
) {
    const existing = await prisma.productDiscount.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new DiscountNotFoundError();
    }

    if (data.startAt && data.endAt && data.endAt <= data.startAt) {
        throw new Error("Tanggal berakhir harus setelah tanggal mulai.");
    }

    if (data.value !== undefined && data.value <= 0) {
        throw new Error("Nilai diskon harus lebih dari 0.");
    }

    if (data.type === "PERCENTAGE" && data.value && data.value > 100) {
        throw new Error("Persentase diskon tidak boleh lebih dari 100%.");
    }

    return prisma.productDiscount.update({
        where: { id },
        data,
    });
}

/**
 * Delete a product discount.
 */
export async function deleteProductDiscount(id: number) {
    const existing = await prisma.productDiscount.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new DiscountNotFoundError();
    }

    return prisma.productDiscount.delete({ where: { id } });
}

/**
 * Get a product discount by ID.
 */
export async function getProductDiscount(id: number) {
    const discount = await prisma.productDiscount.findUnique({
        where: { id },
    });

    if (!discount) {
        throw new DiscountNotFoundError();
    }

    return discount;
}

/**
 * Get active discount for a specific variant.
 * Priority: variant-specific > product-wide.
 * Only returns discounts within their active time window.
 */
export async function getActiveProductDiscount(
    productId: number,
    variantId: number | null,
    now: Date = new Date()
) {
    // First, try to find a variant-specific discount
    if (variantId) {
        const variantDiscount = await prisma.productDiscount.findFirst({
            where: {
                productId,
                variantId,
                isActive: true,
                startAt: { lte: now },
                endAt: { gte: now },
            },
            orderBy: { createdAt: "desc" },
        });

        if (variantDiscount) {
            return variantDiscount;
        }
    }

    // Fallback to product-wide discount
    const productDiscount = await prisma.productDiscount.findFirst({
        where: {
            productId,
            isActive: true,
            startAt: { lte: now },
            endAt: { gte: now },
        },
        orderBy: { createdAt: "desc" },
    });

    return productDiscount;
}

// ==========================================
// CALCULATION
// ==========================================

/**
 * Calculate discounted price for a product/variant.
 *
 * Returns detailed breakdown for the pricing engine.
 *
 * Rules:
 * - PERCENTAGE: discount = originalPrice * percentage / 100
 * - FIXED: discount = fixed value
 * - Never allow final price < 0
 * - Respect maxDiscount cap for PERCENTAGE type
 */
export function calculateDiscountedPrice(
    originalPrice: number,
    discount: {
        type: Voucher_type;
        value: import("@prisma/client").Prisma.Decimal;
        maxDiscount: import("@prisma/client").Prisma.Decimal | null;
        id: number;
    }
): DiscountCalculationResult {
    const discountValue = Number(discount.value);
    let discountAmount = 0;

    if (discount.type === "PERCENTAGE") {
        discountAmount = (originalPrice * discountValue) / 100;

        // Apply max discount cap
        if (discount.maxDiscount) {
            const maxDiscount = Number(discount.maxDiscount);
            if (discountAmount > maxDiscount) {
                discountAmount = maxDiscount;
            }
        }
    } else {
        // FIXED
        discountAmount = discountValue;
    }

    // Never allow negative final price
    discountAmount = Math.min(discountAmount, originalPrice);
    discountAmount = Math.round(discountAmount);

    const finalPrice = originalPrice - discountAmount;

    return {
        originalPrice,
        discountAmount,
        finalPrice,
        discountType: discount.type,
        discountValue,
        maxDiscount: discount.maxDiscount
            ? Number(discount.maxDiscount)
            : null,
        productDiscountId: discount.id,
    };
}
