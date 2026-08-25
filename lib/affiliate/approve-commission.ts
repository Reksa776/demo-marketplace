import { prisma } from "@/lib/prisma";

/* ==========================================
 * AUTO-APPROVE AFFILIATE COMMISSION
 * ==========================================
 *
 * When an order reaches COMPLETED status, the
 * associated PENDING affiliate commission is
 * automatically transitioned to APPROVED.
 *
 * This is idempotent:
 * - If no conversion exists → no-op
 * - If conversion is already APPROVED → no-op
 * - If conversion is PAID → no-op
 * - If conversion is CANCELLED → no-op
 *
 * Only PENDING → APPROVED is performed.
 *
 * Must be called INSIDE the same Prisma transaction
 * as the order status change for atomicity.
 */

export type ApproveReason =
    | "ORDER_COMPLETED"
    | "ORDER_DELIVERED";

/**
 * Auto-approve affiliate commission when order completes.
 * Must be called inside a Prisma transaction.
 *
 * @param tx - Prisma transaction client
 * @param orderId - The order ID
 * @param reason - Why the commission is being approved
 * @returns true if a conversion was approved, false otherwise
 */
export async function approveCommissionForOrder(
    tx: { affiliateConversion: any },
    orderId: number,
    reason: ApproveReason
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

        // Already approved/paid/cancelled/reversed — idempotent
        if (conversion.status !== "PENDING") {
            return false;
        }

        // PENDING → APPROVED
        await tx.affiliateConversion.update({
            where: { id: conversion.id },
            data: {
                status: "APPROVED",
            },
        });

        console.log(
            `AFFILIATE_COMMISSION_APPROVED: Conversion ${conversion.id} (order ${orderId}) approved. Reason: ${reason}.`
        );

        // Audit log (fire-and-forget)
        try {
            const { createAuditLog } = await import(
                "@/lib/admin/audit-log"
            );
            await createAuditLog({
                adminId: "SYSTEM",
                action: "COMMISSION_APPROVED",
                entityType: "AffiliateConversion",
                entityId: conversion.id,
                description: `Komisi auto-approved: ${reason}`,
                metadata: { orderId, reason },
            });
        } catch {
            /* audit log failure is non-critical */
        }

        return true;
    } catch (error) {
        // Don't let commission approval failure
        // block the order status change
        console.error(
            `AFFILIATE_COMMISSION_APPROVE_ERROR: Order ${orderId}, reason ${reason}:`,
            error
        );
        return false;
    }
}
