import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/* ==========================================
 * REPAYMENT ELIGIBILITY
 * ==========================================
 *
 * Determines if an order is eligible for repayment.
 *
 * Rules:
 * - Order must exist and belong to the user
 * - Order must be in a repayable state:
 *   - paymentStatus = FAILED (auto-cancelled after failure)
 *   - paymentStatus = EXPIRED (auto-cancelled after expiry)
 *   - paymentStatus = PENDING + status = PENDING (still awaiting payment)
 * - Order status must not be COMPLETED/SHIPPED/REFUNDED
 *
 * Server-authoritative: all values from DB.
 */

export type RepayEligibility =
    | {
          eligible: true;
          needsStockRestore: boolean;
          orderTotal: Prisma.Decimal;
      }
    | { eligible: false; reason: string };

const REPAYABLE_PAYMENT_STATUSES = ["FAILED", "EXPIRED", "PENDING"];
const REPAYABLE_ORDER_STATUSES = [
    "PENDING",
    "CANCELLED", // auto-cancelled after payment failure/expiry
];

export function checkRepayEligibility(
    orderStatus: string,
    paymentStatus: string
): RepayEligibility {
    // Already paid
    if (paymentStatus === "PAID") {
        return {
            eligible: false,
            reason: "Pesanan sudah dibayar.",
        };
    }

    // Already refunded
    if (paymentStatus === "REFUNDED") {
        return {
            eligible: false,
            reason: "Pesanan sudah direfund.",
        };
    }

    // Must be in a repayable payment status
    if (!REPAYABLE_PAYMENT_STATUSES.includes(paymentStatus)) {
        return {
            eligible: false,
            reason: `Pesanan dengan status pembayaran ${paymentStatus} tidak dapat dibayar ulang.`,
        };
    }

    // Order must be in a repayable state
    if (!REPAYABLE_ORDER_STATUSES.includes(orderStatus)) {
        return {
            eligible: false,
            reason: `Pesanan dengan status ${orderStatus} tidak dapat dibayar ulang.`,
        };
    }

    // For PENDING payment status, order must also be PENDING
    if (paymentStatus === "PENDING" && orderStatus !== "PENDING") {
        return {
            eligible: false,
            reason: "Pesanan tidak dalam status yang memungkinkan pembayaran ulang.",
        };
    }

    // Stock was released if order was auto-cancelled
    const needsStockRestore =
        orderStatus === "CANCELLED" &&
        (paymentStatus === "FAILED" || paymentStatus === "EXPIRED");

    return {
        eligible: true,
        needsStockRestore,
        orderTotal: new Prisma.Decimal(0),
    };
}

/* ==========================================
 * RE-RESERVE STOCK FOR REPAYMENT
 * ==========================================
 *
 * When an order was auto-cancelled due to payment
 * failure/expiry, stock was already released.
 * Before creating a new payment attempt, we need
 * to re-reserve the stock.
 *
 * This is the INVERSE of releaseStockAndVoucherForOrder.
 *
 * Must be called INSIDE a Prisma transaction.
 */

async function reReserveStockForOrder(
    tx: Prisma.TransactionClient,
    orderId: number
): Promise<void> {
    const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
    });

    if (!order) return;

    for (const item of order.items) {
        if (item.variantId === null) continue;

        // Check if flash sale item
        const flashSale = await tx.flashSale.findFirst({
            where: { variantId: item.variantId },
            select: { id: true, isActive: true, saleStock: true },
        });

        if (flashSale && flashSale.isActive) {
            // Flash sale: re-reserve flash sale stock
            const affectedRows = await tx.$executeRaw`
                UPDATE FlashSale
                SET saleStock = saleStock - ${item.quantity},
                    soldCount = soldCount + ${item.quantity}
                WHERE id = ${flashSale.id}
                  AND isActive = true
                  AND saleStock >= ${item.quantity}
            `;

            if (affectedRows === 0) {
                throw new Error(
                    `Stok flash sale ${item.productName} tidak mencukupi untuk pembayaran ulang.`
                );
            }

            // Re-create purchase record
            await tx.flashSalePurchase.upsert({
                where: {
                    flashSaleId_userId: {
                        flashSaleId: flashSale.id,
                        userId: order.userId,
                    },
                },
                create: {
                    flashSaleId: flashSale.id,
                    userId: order.userId,
                    quantity: item.quantity,
                },
                update: {
                    quantity: { increment: item.quantity },
                },
            });
        } else {
            // Regular item: re-reserve variant stock
            const stockUpdate = await tx.productVariant.updateMany({
                where: {
                    id: item.variantId,
                    stock: { gte: item.quantity },
                },
                data: {
                    stock: { decrement: item.quantity },
                },
            });

            if (stockUpdate.count !== 1) {
                throw new Error(
                    `Stok ${item.productName} - ${item.variantName} tidak mencukupi untuk pembayaran ulang.`
                );
            }

            // Restore sold count
            if (item.productId !== null) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { sold: { increment: item.quantity } },
                });
            }
        }
    }

    // Re-reserve voucher usage
    if (typeof order.voucherId === "number") {
        const { incrementVoucherUsage } = await import("@/lib/voucher");
        const voucherReserved = await incrementVoucherUsage(tx, order.voucherId);

        if (!voucherReserved) {
            throw new Error(
                "Kuota voucher tidak mencukupi untuk pembayaran ulang."
            );
        }

        await tx.voucherUserUsage.upsert({
            where: {
                voucherId_userId: {
                    voucherId: order.voucherId,
                    userId: order.userId,
                },
            },
            create: {
                voucherId: order.voucherId,
                userId: order.userId,
                usageCount: 1,
            },
            update: { usageCount: { increment: 1 } },
        });
    }

    // Re-reserve spin wheel reward
    const spinRecord = await tx.spinWheelSpin.findFirst({
        where: {
            userId: order.userId,
            status: "AVAILABLE",
            orderId: null,
        },
        orderBy: { createdAt: "desc" },
    });

    if (spinRecord) {
        await tx.spinWheelSpin.update({
            where: { id: spinRecord.id },
            data: {
                status: "USED",
                usedAt: new Date(),
                orderId: order.id,
            },
        });
    }
}

/* ==========================================
 * PROCESS REPAYMENT
 * ==========================================
 *
 * Creates a new payment attempt for an existing order.
 *
 * Security:
 * - Ownership check (userId matches)
 * - Server-side amount (order.total from DB)
 * - CAS on order status (reset to PENDING)
 * - Idempotent (status check prevents double processing)
 * - Rate limited by caller
 */

export type RepayOrderResult =
    | {
          ok: true;
          orderId: number;
          orderNumber: string;
          grossAmount: number;
          paymentMethod: string;
          needsStockRestore: boolean;
      }
    | { ok: false; reason: string };

export async function processRepayment(
    userId: string,
    orderId: number,
    paymentMethod: string
): Promise<RepayOrderResult> {
    // ==========================================
    // VALIDATE PAYMENT METHOD
    // ==========================================

    const validMethods = ["BANK_TRANSFER", "E_WALLET", "QRIS"];
    if (!validMethods.includes(paymentMethod)) {
        return {
            ok: false,
            reason: "Metode pembayaran tidak valid.",
        };
    }

    return prisma.$transaction(
        async (tx) => {
            // ==========================================
            // 1. FIND ORDER + OWNERSHIP CHECK
            // ==========================================

            const order = await tx.order.findFirst({
                where: {
                    id: orderId,
                    userId,
                },
                select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    paymentStatus: true,
                    paymentMethod: true,
                    total: true,
                },
            });

            if (!order) {
                return {
                    ok: false,
                    reason: "Order tidak ditemukan.",
                };
            }

            // ==========================================
            // 2. ELIGIBILITY CHECK
            // ==========================================

            const eligibility = checkRepayEligibility(
                order.status,
                order.paymentStatus
            );

            if (!eligibility.eligible) {
                return {
                    ok: false,
                    reason: eligibility.reason,
                };
            }

            // ==========================================
            // 3. RE-RESERVE STOCK IF NEEDED
            // ==========================================
            //
            // If order was auto-cancelled (FAILED/EXPIRED),
            // stock was already released. Re-reserve before
            // creating new payment attempt.

            if (eligibility.needsStockRestore) {
                try {
                    await reReserveStockForOrder(tx, orderId);
                } catch (error: any) {
                    return {
                        ok: false,
                        reason:
                            error.message ||
                            "Gagal mengembalikan stok untuk pembayaran ulang.",
                    };
                }
            }

            // ==========================================
            // 4. CAS: RESET ORDER TO PENDING
            // ==========================================
            //
            // Only if order was cancelled/failed/expired.
            // Prevents:
            // - Resurrecting a PAID/COMPLETED order
            // - Race with concurrent webhook

            const affectedRows = await tx.$executeRaw`
                UPDATE \`Order\`
                SET status = 'PENDING',
                    paymentStatus = 'PENDING',
                    paymentMethod = ${paymentMethod}
                WHERE id = ${orderId}
                  AND status IN ('PENDING', 'CANCELLED')
                  AND paymentStatus IN ('PENDING', 'FAILED', 'EXPIRED')
            `;

            if (affectedRows === 0) {
                return {
                    ok: false,
                    reason:
                        "Status order berubah saat pemrosesan. Silakan coba lagi.",
                };
            }

            // ==========================================
            // 5. AUDIT LOG
            // ==========================================

            try {
                const { createAuditLog } = await import(
                    "@/lib/admin/audit-log"
                );
                await createAuditLog({
                    adminId: userId,
                    action: "REPAYMENT_INITIATED",
                    entityType: "Order",
                    entityId: orderId,
                    description: `Repayment initiated: Rp ${order.total.toString()} via ${paymentMethod}`,
                    metadata: {
                        orderId,
                        orderNumber: order.orderNumber,
                        amount: order.total.toString(),
                        paymentMethod,
                        previousPaymentStatus: order.paymentStatus,
                    },
                });
            } catch {
                /* non-critical */
            }

            return {
                ok: true,
                orderId: order.id,
                orderNumber: order.orderNumber,
                grossAmount: Number(order.total.toString()),
                paymentMethod,
                needsStockRestore: eligibility.needsStockRestore,
            };
        },
        {
            timeout: 15000,
            maxWait: 10000,
        }
    );
}
