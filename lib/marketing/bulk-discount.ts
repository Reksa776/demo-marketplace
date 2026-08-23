import { prisma } from "@/lib/prisma";
import { Voucher_type } from "@prisma/client";

/**
 * ==========================================
 * BULK DISCOUNT SERVICE
 * ==========================================
 *
 * "Beli Banyak Lebih Hemat" — quantity-based pricing.
 *
 * When a customer purchases N+ items of the same
 * product/variant, a tiered discount applies.
 *
 * Rules:
 * - Higher minQuantity tiers win (e.g. buy 5 beats buy 3)
 * - Only active discounts within startAt/endAt apply
 * - ProductDiscount/FlashSale take priority (via batch-pricing)
 * - Bulk discount is applied AFTER product-level pricing
 */

// ==========================================
// TYPES
// ==========================================

export type BulkDiscountCalculation = {
    bulkDiscountId: number;
    name: string;
    minQuantity: number;
    type: Voucher_type;
    value: number;
    maxDiscount: number | null;
    discountAmount: number;
    finalPricePerItem: number;
};

// ==========================================
// CRUD OPERATIONS
// ==========================================

export async function createBulkDiscount(data: {
    name: string;
    productId: number;
    variantId?: number | null;
    minQuantity: number;
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
    if (data.minQuantity < 2) {
        throw new Error("Minimal quantity untuk bulk discount adalah 2.");
    }
    if (data.value <= 0) {
        throw new Error("Nilai diskon harus lebih dari 0.");
    }
    if (data.type === "PERCENTAGE" && data.value > 100) {
        throw new Error("Persentase diskon tidak boleh lebih dari 100%.");
    }

    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new Error("Produk tidak ditemukan.");

    if (data.variantId) {
        const variant = await prisma.productVariant.findFirst({
            where: { id: data.variantId, productId: data.productId },
        });
        if (!variant) throw new Error("Variant tidak ditemukan untuk produk ini.");
    }

    return prisma.bulkDiscount.create({
        data: {
            name: data.name,
            productId: data.productId,
            variantId: data.variantId ?? null,
            minQuantity: data.minQuantity,
            type: data.type,
            value: data.value,
            maxDiscount: data.maxDiscount ?? null,
            startAt: data.startAt,
            endAt: data.endAt,
            isActive: data.isActive ?? true,
        },
    });
}

export async function updateBulkDiscount(
    id: number,
    data: {
        name?: string;
        minQuantity?: number;
        type?: Voucher_type;
        value?: number;
        maxDiscount?: number | null;
        startAt?: Date;
        endAt?: Date;
        isActive?: boolean;
    }
) {
    const existing = await prisma.bulkDiscount.findUnique({ where: { id } });
    if (!existing) throw new Error("Bulk discount tidak ditemukan.");

    if (data.startAt && data.endAt && data.endAt <= data.startAt) {
        throw new Error("Tanggal berakhir harus setelah tanggal mulai.");
    }
    if (data.minQuantity !== undefined && data.minQuantity < 2) {
        throw new Error("Minimal quantity adalah 2.");
    }
    if (data.value !== undefined && data.value <= 0) {
        throw new Error("Nilai diskon harus lebih dari 0.");
    }

    return prisma.bulkDiscount.update({ where: { id }, data });
}

export async function deleteBulkDiscount(id: number) {
    const existing = await prisma.bulkDiscount.findUnique({ where: { id } });
    if (!existing) throw new Error("Bulk discount tidak ditemukan.");
    return prisma.bulkDiscount.delete({ where: { id } });
}

export async function getBulkDiscount(id: number) {
    const discount = await prisma.bulkDiscount.findUnique({
        where: { id },
        include: { product: true, variant: true },
    });
    if (!discount) throw new Error("Bulk discount tidak ditemukan.");
    return discount;
}

export async function listBulkDiscounts(options?: {
    isActive?: boolean;
    productId?: number;
    search?: string;
    limit?: number;
    offset?: number;
}) {
    const where: any = {};
    if (options?.isActive !== undefined) where.isActive = options.isActive;
    if (options?.productId) where.productId = options.productId;
    if (options?.search && options.search.trim()) {
        where.name = { contains: options.search.trim() };
    }

    const [items, total] = await Promise.all([
        prisma.bulkDiscount.findMany({
            where,
            include: { product: true, variant: true },
            orderBy: [{ minQuantity: "asc" }, { createdAt: "desc" }],
            take: options?.limit ?? 50,
            skip: options?.offset ?? 0,
        }),
        prisma.bulkDiscount.count({ where }),
    ]);

    return { items, total };
}

// ==========================================
// ACTIVE QUERY
// ==========================================

export async function getActiveBulkDiscounts(now: Date = new Date()) {
    return prisma.bulkDiscount.findMany({
        where: {
            isActive: true,
            startAt: { lte: now },
            endAt: { gte: now },
        },
        orderBy: { minQuantity: "asc" },
    });
}

/**
 * Find the best applicable bulk discount for a product/variant at a given quantity.
 * Returns the highest minQuantity tier that is <= the actual quantity.
 */
export async function resolveBulkDiscount(
    productId: number,
    variantId: number | null,
    quantity: number,
    originalPrice: number,
    now: Date = new Date()
): Promise<BulkDiscountCalculation | null> {
    const discounts = await prisma.bulkDiscount.findMany({
        where: {
            productId,
            OR: [
                { variantId },
                { variantId: null },
            ],
            isActive: true,
            startAt: { lte: now },
            endAt: { gte: now },
            minQuantity: { lte: quantity },
        },
        orderBy: { minQuantity: "desc" },
        take: 1,
    });

    if (!discounts[0]) return null;

    const d = discounts[0];
    const discountValue = Number(d.value);
    let discountAmount = 0;

    if (d.type === "PERCENTAGE") {
        // Calculate per-item discount, apply maxDiscount cap per-item,
        // then multiply by quantity for total discount.
        let perItemDiscount = (originalPrice * discountValue) / 100;
        if (d.maxDiscount) {
            perItemDiscount = Math.min(perItemDiscount, Number(d.maxDiscount));
        }
        discountAmount = perItemDiscount * quantity;
    } else {
        discountAmount = discountValue * quantity;
    }

    discountAmount = Math.round(discountAmount);
    const totalDiscount = Math.min(discountAmount, originalPrice * quantity);
    const finalPricePerItem = Math.round((originalPrice * quantity - totalDiscount) / quantity);

    return {
        bulkDiscountId: d.id,
        name: d.name,
        minQuantity: d.minQuantity,
        type: d.type,
        value: discountValue,
        maxDiscount: d.maxDiscount ? Number(d.maxDiscount) : null,
        discountAmount: totalDiscount,
        finalPricePerItem,
    };
}
