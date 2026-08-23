import { prisma } from "@/lib/prisma";
import { Voucher_type } from "@prisma/client";

/**
 * ==========================================
 * SHIPPING DISCOUNT SERVICE
 * ==========================================
 *
 * "Diskon Ongkir" — reduces shipping cost.
 *
 * Supports:
 * - PERCENTAGE: reduce shipping by X%
 * - FIXED: reduce shipping by fixed Rp amount
 * - Max discount cap (for percentage)
 * - Minimum purchase threshold
 * - Code-based activation (like a promo code for shipping)
 * - Active period (startAt/endAt)
 *
 * IMPORTANT:
 * - Shipping discount is applied AFTER marketing pricing
 * - Never trust client-provided final shipping cost
 * - Server-authoritative calculation
 */

// ==========================================
// TYPES
// ==========================================

export type ShippingDiscountResult = {
    shippingDiscountId: number;
    name: string;
    originalShippingCost: number;
    discountAmount: number;
    finalShippingCost: number;
};

// ==========================================
// CRUD OPERATIONS
// ==========================================

export async function createShippingDiscount(data: {
    name: string;
    code?: string | null;
    type: Voucher_type;
    value: number;
    maxDiscount?: number | null;
    minPurchase?: number | null;
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

    if (data.code) {
        const existing = await prisma.shippingDiscount.findUnique({
            where: { code: data.code.trim().toUpperCase() },
        });
        if (existing) throw new Error("Kode diskon ongkir sudah digunakan.");
    }

    return prisma.shippingDiscount.create({
        data: {
            name: data.name,
            code: data.code?.trim().toUpperCase() ?? null,
            type: data.type,
            value: data.value,
            maxDiscount: data.maxDiscount ?? null,
            minPurchase: data.minPurchase ?? null,
            startAt: data.startAt,
            endAt: data.endAt,
            isActive: data.isActive ?? true,
        },
    });
}

export async function updateShippingDiscount(
    id: number,
    data: {
        name?: string;
        code?: string | null;
        type?: Voucher_type;
        value?: number;
        maxDiscount?: number | null;
        minPurchase?: number | null;
        startAt?: Date;
        endAt?: Date;
        isActive?: boolean;
    }
) {
    const existing = await prisma.shippingDiscount.findUnique({ where: { id } });
    if (!existing) throw new Error("Diskon ongkir tidak ditemukan.");

    if (data.startAt && data.endAt && data.endAt <= data.startAt) {
        throw new Error("Tanggal berakhir harus setelah tanggal mulai.");
    }

    return prisma.shippingDiscount.update({ where: { id }, data });
}

export async function deleteShippingDiscount(id: number) {
    const existing = await prisma.shippingDiscount.findUnique({ where: { id } });
    if (!existing) throw new Error("Diskon ongkir tidak ditemukan.");
    return prisma.shippingDiscount.delete({ where: { id } });
}

export async function getShippingDiscount(id: number) {
    const discount = await prisma.shippingDiscount.findUnique({ where: { id } });
    if (!discount) throw new Error("Diskon ongkir tidak ditemukan.");
    return discount;
}

export async function listShippingDiscounts(options?: {
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
}) {
    const where: any = {};
    if (options?.isActive !== undefined) where.isActive = options.isActive;
    if (options?.search && options.search.trim()) {
        where.OR = [
            { name: { contains: options.search.trim() } },
            { code: { contains: options.search.trim().toUpperCase() } },
        ];
    }

    const [items, total] = await Promise.all([
        prisma.shippingDiscount.findMany({
            where,
            orderBy: [{ minPurchase: "asc" }, { createdAt: "desc" }],
            take: options?.limit ?? 50,
            skip: options?.offset ?? 0,
        }),
        prisma.shippingDiscount.count({ where }),
    ]);

    return { items, total };
}

// ==========================================
// CALCULATION
// ==========================================

/**
 * Calculate shipping discount for a given shipping cost and purchase subtotal.
 *
 * @param shippingCost - Server-calculated original shipping cost
 * @param subtotal - Order subtotal (after marketing pricing, before voucher)
 * @param code - Optional shipping discount code
 * @param now - Current time for validation
 * @returns ShippingDiscountResult or null if no discount applies
 */
export async function calculateShippingDiscount(
    shippingCost: number,
    subtotal: number,
    code?: string | null,
    now: Date = new Date()
): Promise<ShippingDiscountResult | null> {
    let discount = null;

    if (code) {
        // Code-based: find specific active discount
        discount = await prisma.shippingDiscount.findFirst({
            where: {
                code: code.trim().toUpperCase(),
                isActive: true,
                startAt: { lte: now },
                endAt: { gte: now },
            },
        });
    } else {
        // Auto-apply: find first active discount without code that meets min purchase
        discount = await prisma.shippingDiscount.findFirst({
            where: {
                code: null,
                isActive: true,
                startAt: { lte: now },
                endAt: { gte: now },
                OR: [
                    { minPurchase: null },
                    { minPurchase: { lte: subtotal } },
                ],
            },
            orderBy: { value: "desc" },
        });
    }

    if (!discount) return null;

    // Check minimum purchase
    if (discount.minPurchase && subtotal < Number(discount.minPurchase)) {
        return null;
    }

    let discountAmount = 0;

    if (discount.type === "PERCENTAGE") {
        discountAmount = (shippingCost * Number(discount.value)) / 100;
        if (discount.maxDiscount) {
            discountAmount = Math.min(discountAmount, Number(discount.maxDiscount));
        }
    } else {
        discountAmount = Number(discount.value);
    }

    // Never exceed shipping cost
    discountAmount = Math.min(discountAmount, shippingCost);
    discountAmount = Math.round(discountAmount);

    return {
        shippingDiscountId: discount.id,
        name: discount.name,
        originalShippingCost: shippingCost,
        discountAmount,
        finalShippingCost: shippingCost - discountAmount,
    };
}
