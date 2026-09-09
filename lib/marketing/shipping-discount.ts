import { prisma } from "@/lib/prisma";
import { Prisma, Voucher_type } from "@prisma/client";

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
    quota: number | null;
    usedCount: number;
    maxUsagePerUser: number | null;
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
    quota?: number | null;
    maxUsagePerUser?: number | null;
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
    if (data.quota !== undefined && data.quota !== null && data.quota < 1) {
        throw new Error("Kuota harus minimal 1.");
    }
    if (
        data.maxUsagePerUser !== undefined &&
        data.maxUsagePerUser !== null &&
        data.maxUsagePerUser < 1
    ) {
        throw new Error("Batas pemakaian per user harus minimal 1.");
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
            quota: data.quota ?? null,
            maxUsagePerUser: data.maxUsagePerUser ?? null,
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
        quota?: number | null;
        maxUsagePerUser?: number | null;
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
    if (data.quota !== undefined && data.quota !== null && data.quota < 1) {
        throw new Error("Kuota harus minimal 1.");
    }
    if (
        data.maxUsagePerUser !== undefined &&
        data.maxUsagePerUser !== null &&
        data.maxUsagePerUser < 1
    ) {
        throw new Error("Batas pemakaian per user harus minimal 1.");
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

    // F9: quota exhausted → not applicable, even if still active.
    // (Could not be expressed as a Prisma filter because it compares
    // two columns, so it is enforced here and atomically re-checked
    // by reserveShippingDiscountUsage at order time.)
    if (discount.quota !== null && discount.usedCount >= discount.quota) {
        return null;
    }

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
        quota: discount.quota,
        usedCount: discount.usedCount,
        maxUsagePerUser: discount.maxUsagePerUser,
    };
}

// ==========================================
// ATOMIC QUOTA RESERVATION (F9)
// ==========================================
//
// MUST be called inside the SAME transaction that creates the
// order. Uses a conditional UPDATE (CAS) so two concurrent
// checkouts can never both consume the last quota slot.
//
// Returns true when the slot was reserved and the discount can
// be applied.

export async function reserveShippingDiscountUsage(
    tx: Prisma.TransactionClient,
    discountId: number
): Promise<boolean> {
    const updated = await tx.$executeRaw`
        UPDATE shippingdiscount
        SET usedCount = usedCount + 1
        WHERE id = ${discountId}
          AND isActive = true
          AND (quota IS NULL OR usedCount < quota)
    `;

    return updated === 1;
}

/**
 * Release one quota slot for a cancelled order (F9).
 * MUST be called inside the SAME transaction that flips the
 * order to CANCELLED. Only decrements when a slot exists.
 */
export async function releaseShippingDiscountUsage(
    tx: Prisma.TransactionClient,
    discountId: number
): Promise<void> {
    await tx.$executeRaw`
        UPDATE shippingdiscount
        SET usedCount = CASE
            WHEN usedCount > 0 THEN usedCount - 1
            ELSE usedCount
        END
        WHERE id = ${discountId}
    `;
}

/**
 * Convenience: release quota for an order when it is cancelled,
 * based on the stored shippingDiscountId. Safe no-op when the
 * order never used one.
 */
export async function releaseShippingDiscountForOrder(
    tx: Prisma.TransactionClient,
    order: {
        id: number;
        shippingDiscountId: number | null;
    } | null
): Promise<void> {
    if (!order?.shippingDiscountId) return;
    await releaseShippingDiscountUsage(
        tx,
        order.shippingDiscountId
    );
}
