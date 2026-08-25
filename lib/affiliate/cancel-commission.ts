import { prisma } from "@/lib/prisma";

/* ==========================================
 * CANCEL AFFILIATE COMMISSION ON ORDER CHANGE
 * ==========================================
 *
 * When an order is cancelled, refunded, or failed,
 * cancel the associated AffiliateConversion if it
 * is in a cancellable state (PENDING or APPROVED).
 *
 * PAID conversions are NOT silently reversed —
 * that requires manual admin review.
 *
 * This function is idempotent:
 * - If no conversion exists → no-op
 * - If conversion is already CANCELLED → no-op
 * - If conversion is PAID → no-op (log only)
 *
 * Must be called INSIDE the same Prisma transaction
 * as the order status change for atomicity.
 */

export type CancelReason =
    | "ORDER_CANCELLED"
    | "ORDER_EXPIRED"
    | "ORDER_PAYMENT_FAILED"
    | "ORDER_REFUNDED"
    | "ORDER_RETURNED"
    | "ADMIN_CANCELLED";

/**
 * Cancel affiliate commission for an order.
 * Must be called inside a Prisma transaction.
 *
 * @param tx - Prisma transaction client
 * @param orderId - The order ID
 * @param reason - Why the commission is being cancelled
 * @returns true if a conversion was cancelled, false otherwise
 */
export async function cancelCommissionForOrder(
    tx: { affiliateConversion: any },
    orderId: number,
    reason: CancelReason
): Promise<boolean> {
    try {
        const conversion =
            await tx.affiliateConversion.findUnique({
                where: { orderId },
                select: {
                    id: true,
                    status: true,
                    affiliateId: true,
                    commissionAmount: true,
                },
            });

        // No conversion for this order — nothing to do
        if (!conversion) {
            return false;
        }

        // Already cancelled/reversed — idempotent
        if (
            conversion.status === "CANCELLED" ||
            conversion.status === "REVERSED"
        ) {
            return false;
        }

        // PAID — do NOT silently reverse
        if (conversion.status === "PAID") {
            console.warn(
                `AFFILIATE_COMMISSION: PAID conversion ${conversion.id} for order ${orderId} cannot be auto-cancelled (${reason}). Requires manual admin review.`
            );
            return false;
        }

        // PENDING or APPROVED → CANCELLED
        await tx.affiliateConversion.update({
            where: { id: conversion.id },
            data: {
                status: "CANCELLED",
            },
        });

        console.log(
            `AFFILIATE_COMMISSION_CANCELLED: Conversion ${conversion.id} (order ${orderId}) cancelled. Reason: ${reason}. Previous status: ${conversion.status}`
        );

        // Audit log (fire-and-forget)
        try {
            const { createAuditLog } = await import("@/lib/admin/audit-log");
            await createAuditLog({
                adminId: "SYSTEM",
                action: "AFFILIATE_COMMISSION_AUTO_CANCELLED",
                entityType: "AffiliateConversion",
                entityId: conversion.id,
                description: `Komisi auto-cancelled: ${reason}. Previous: ${conversion.status}`,
                metadata: { orderId, reason, previousStatus: conversion.status },
            });
        } catch { /* audit log failure is non-critical */ }

        return true;
    } catch (error) {
        // Don't let commission cancellation failure
        // block the order status change
        console.error(
            `AFFILIATE_COMMISSION_CANCEL_ERROR: Order ${orderId}, reason ${reason}:`,
            error
        );
        return false;
    }
}
