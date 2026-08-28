import {
    NextRequest,
    NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";
import { releaseStockAndVoucherForOrder } from "@/lib/order-stock";
import { executeRefundCompletion } from "@/lib/refund";

import {
    isSuccessNotification,
    isPendingNotification,
    isFailedNotification,
    verifyNotificationAmount,
    type IpaymuNotification,
} from "@/lib/payment/ipaymu";

export const dynamic = "force-dynamic";

function json(
    data: unknown,
    status = 200
) {
    return NextResponse.json(data, {
        status,
    });
}

export async function POST(
    request: NextRequest
) {
    try {
        /* ==========================================
         * PARSE URL-ENCODED BODY
         * ==========================================
         *
         * iPaymu webhook sends:
         *   Content-Type: application/x-www-form-urlencoded
         *
         * Fields use snake_case:
         *   reference_id, trx_id, sid, status,
         *   status_code, sub_total, total, amount, etc.
         */
        const text = await request.text();
        const params = new URLSearchParams(text);
        const raw: Record<string, string> = {};
        params.forEach((value, key) => {
            raw[key] = value;
        });

        /* ==========================================
         * MAP SNAKE_CASE → PASCALCASE
         * ==========================================
         *
         * Normalize iPaymu webhook fields to our
         * internal IpaymuNotification model so all
         * existing helpers (isSuccessNotification,
         * verifyNotificationAmount, etc.) work.
         */
        const body: IpaymuNotification = {
            ...raw,
            ReferenceId:
                raw.reference_id ||
                raw.ReferenceId,
            SessionId:
                raw.sid || raw.SessionId,
            TransactionId:
                raw.trx_id ||
                raw.TransactionId,
            Amount:
                raw.amount || raw.Amount,
            Status:
                raw.status_code !== undefined
                    ?
                      /* iPaymu status_code: 1 = success.
                       * Map to 200 for isSuccessNotification. */
                      Number(raw.status_code) === 1
                        ? 200
                        : Number(raw.status_code) === 0
                          ? 150
                          :
                            Number(
                                raw.status_code
                            ) >= 4
                              ? 400
                              : Number(
                                  raw.status_code
                                )
                    : raw.Status !== undefined
                      ? raw.Status
                      : undefined,
            PaymentMethod:
                raw.via ||
                raw.PaymentMethod,
            PaymentChannel:
                raw.channel ||
                raw.PaymentChannel,
            /* Keep lowercase status for
             * isSuccessNotification "berhasil" check */
            status:
                raw.status ||
                raw.status,
        };

        /* ==========================================
         * SECURITY: LOG WEBHOOK (safe fields only)
         * ==========================================
         *
         * Never log full payload to avoid leaking
         * buyer PII or sensitive payment data.
         */
        console.log(
            "IPAYMU WEBHOOK:",
            {
                reference_id:
                    raw.reference_id,
                trx_id: raw.trx_id,
                status_code:
                    raw.status_code,
                has_sid: !!raw.sid,
            }
        );

        /* ==========================================
         * FIND ORDER
         * ==========================================
         *
         * iPaymu sends ReferenceId which maps to
         * our orderNumber.
         */

        const orderNumber =
            body.ReferenceId ||
            body.SessionId;

        if (!orderNumber) {
            console.error(
                "IPAYMU SECURITY: Missing ReferenceId/Sid in webhook"
            );
            return json(
                {
                    success: false,
                    message:
                        "ReferenceId tidak ditemukan.",
                },
                400
            );
        }

        const existingOrder =
            await prisma.order.findUnique({
                where: {
                    orderNumber,
                },

                include: {
                    items: true,
                },
            });

        if (!existingOrder) {
            console.error(
                "IPAYMU SECURITY: ORDER NOT FOUND — " +
                "webhook for non-existent order",
                orderNumber
            );

            /* Return 200 so iPaymu doesn't retry
             * indefinitely for non-existent orders.
             */
            return json({
                success: false,
                message:
                    "Order tidak ditemukan.",
            });
        }        /* ==========================================
         * SECURITY: AMOUNT VALIDATION
         * ==========================================
         *
         * iPaymu sends:
         * - sub_total = product total (matches order.total)
         * - amount/total = product total + fee (does NOT match)
         *
         * verifyNotificationAmount prefers sub_total.
         * Fee iPaymu/escrow is excluded from comparison.
         *
         * This is a critical security check: attacker
         * cannot forge a webhook with wrong amount.
         */

        if (
            body.Amount !== undefined &&
            body.Amount !== null
        ) {
            const orderAmount = Number(
                existingOrder.total.toString()
            );

            if (
                !verifyNotificationAmount(
                    body,
                    orderAmount
                )
            ) {
                console.error(
                    "IPAYMU SECURITY: AMOUNT MISMATCH — " +
                    "potential webhook spoofing attempt",
                    {
                        orderNumber,
                        notificationAmount:
                            body.Amount,
                        orderAmount,
                        referenceId:
                            body.ReferenceId,
                        sessionId:
                            body.SessionId,
                    }
                );

                return json(
                    {
                        success: false,
                        message: "Amount tidak sesuai.",
                    },
                    400
                );
            }
        }

        /* ==========================================
         * STATUS MAPPING
         * ==========================================
         *
         * iPaymu status mapping:
         * - Status 200 = payment success (berhasil)
         * - Status 100-199 = pending
         * - Status >= 400 = failed/expired
         *
         * Also handles string-based status:
         * - "berhasil" = success
         * - "pending" = pending
         * - "gagal"/"failed"/"expired" = failed
         */

        const isSuccess =
            isSuccessNotification(body);

        const isPending =
            isPendingNotification(body);

        const isFailed =
            isFailedNotification(body);

        /* ==========================================
         * SUCCESS
         * ========================================== */

        if (isSuccess) {
            /* ==========================================
             * ATOMIC CAS SETTLEMENT GUARD
             * ==========================================
             *
             * State machine policy:
             *
             *   PENDING / PROCESSING → PAID   (allowed)
             *   PAID                  → PAID  (idempotent no-op)
             *   CANCELLED / EXPIRED / FAILED → final, NEVER resurrected
             *   REFUNDED              → final, never overwritten
             *
             * The conditional UPDATE makes transition,
             * idempotency and resurrection-prevention
             * a single atomic operation.
             */
            const paymentRef =
                body.TransactionId ||
                body.PaymentId ||
                body.payment_id ||
                body.trx_id ||
                null;

            let settled = false;

            await prisma.$transaction(
                async (tx) => {
                    const affectedRows =
                        await tx.$executeRaw`
                        UPDATE \`order\`
                        SET status = 'PAID',
                            paymentStatus = 'PAID',
                            paidAt = IFNULL(paidAt, CURRENT_TIMESTAMP),
                            paymentReference = COALESCE(${paymentRef}, paymentReference)
                        WHERE id = ${existingOrder.id}
                          AND status IN ('PENDING', 'PROCESSING')
                          AND paymentStatus NOT IN ('PAID', 'REFUNDED')
                    `;

                    if (
                        affectedRows === 0
                    ) {
                        /* Either already PAID (duplicate → idempotent)
                         * or CANCELLED/EXPIRED/REFUNDED (final state) */
                        return;
                    }

                    settled = true;                    /* Clear cart ONLY for cart checkout orders */
                    if (
                        existingOrder.orderNumber.startsWith(
                            "PAY-CART-"
                        )
                    ) {
                        const cart =
                            await tx.cart.findUnique(
                                {
                                    where: {
                                        userId:
                                            existingOrder.userId,
                                    },
                                }
                            );

                        if (cart) {
                            // ==========================================
                            // SELECTIVE CART CLEANUP
                            // ==========================================
                            // Only remove cart items that became
                            // OrderItems. Unselected items stay.
                            const orderItems = await tx.orderItem.findMany({
                                where: { orderId: existingOrder.id },
                                select: { variantId: true },
                            });
                            const orderedVariantIds = orderItems
                                .map((oi) => oi.variantId)
                                .filter((v): v is number => v !== null);

                            if (orderedVariantIds.length > 0) {
                                await tx.cartItem.deleteMany({
                                    where: {
                                        cartId: cart.id,
                                        variantId: { in: orderedVariantIds },
                                    },
                                });
                            }
                        }
                    }
                }
            );

            /* ==========================================
             * NOTIFICATION TRIGGER
             * ========================================== */
            if (settled) {
                const {
                    onOrderStatusChanged,
                } = await import(
                    "@/lib/notification/order-status-handler"
                );

                onOrderStatusChanged(
                    existingOrder.id,
                    existingOrder.status,
                    "PAID"
                ).catch((err: any) =>
                    console.error(
                        "NOTIFICATION TRIGGER ERROR:",
                        err
                    )
                );
            }

            return json({
                success: true,
                message: settled
                    ? "Payment settlement processed."
                    : "Settlement ignored: order already processed or cancelled/expired.",
            });
        }

        /* ==========================================
         * PENDING
         * ========================================== */

        if (isPending) {
            const pendingRef =
                body.TransactionId ||
                body.PaymentId ||
                body.payment_id ||
                body.trx_id ||
                existingOrder.paymentReference;

            const pendingAffected =
                await prisma.$executeRaw`
                UPDATE \`order\`
                SET status = 'PENDING',
                    paymentStatus = 'PENDING',
                    paymentReference = ${pendingRef}
                WHERE id = ${existingOrder.id}
                  AND status IN ('PENDING', 'PROCESSING')
                  AND paymentStatus != 'PAID'
            `;

            return json({
                success: true,
                message:
                    pendingAffected > 0
                        ? "Payment pending processed."
                        : "Order already paid, pending ignored.",
            });
        }

        /* ==========================================
         * FAILED / EXPIRED
         * ========================================== */

        if (isFailed) {
            await prisma.$transaction(
                async (tx) => {
                    const failedRef =
                        body.TransactionId ||
                        body.PaymentId ||
                        body.payment_id ||
                        body.trx_id ||
                        existingOrder.paymentReference;

                    const affectedRows =
                        await tx.$executeRaw`
                        UPDATE \`order\`
                        SET status = 'CANCELLED',
                            paymentStatus = 'FAILED',
                            paymentReference = ${failedRef}
                        WHERE id = ${existingOrder.id}
                          AND status IN ('PENDING', 'PROCESSING')
                          AND paymentStatus != 'PAID'
                    `;

                    if (
                        affectedRows === 0
                    ) {
                        return;
                    }

                    await releaseStockAndVoucherForOrder(
                        tx,
                        existingOrder.id
                    );

                    /* AFFILIATE COMMISSION CANCELLATION */
                    const {
                        cancelCommissionForOrder,
                    } = await import(
                        "@/lib/affiliate/cancel-commission"
                    );
                    await cancelCommissionForOrder(
                        tx,
                        existingOrder.id,
                        "ORDER_PAYMENT_FAILED"
                    );
                }
            );

            /* NOTIFICATION TRIGGER */
            if (
                existingOrder.status !==
                "CANCELLED"
            ) {
                const {
                    onOrderStatusChanged,
                } = await import(
                    "@/lib/notification/order-status-handler"
                );

                onOrderStatusChanged(
                    existingOrder.id,
                    existingOrder.status,
                    "CANCELLED"
                ).catch((err: any) =>
                    console.error(
                        "NOTIFICATION TRIGGER ERROR:",
                        err
                    )
                );
            }

            return json({
                success: true,
                message:
                    "Payment failure processed.",
            });
        }        /* ==========================================
         * REFUND
         * ==========================================
         *
         * iPaymu refund notification handling.
         * Mirrors Midtrans refund handler.
         */

        const isRefunded =
            body.Status === "refund" ||
            (typeof body.status === "string" &&
                body.status.toLowerCase() === "refund") ||
            (typeof body.status_code === "string" &&
                body.status_code.toLowerCase() === "refund") ||
            (typeof body.settlement_status === "string" &&
                body.settlement_status.toLowerCase() === "refunded");

        if (isRefunded) {
            const refundedRef =
                body.TransactionId ||
                body.PaymentId ||
                body.payment_id ||
                body.trx_id ||
                null;

            /*
             * FIND OR CREATE REFUND RECORD:
             * - If user-initiated refund exists → use it
             * - If provider-initiated (no existing record) → create one
             */
            let existingRefund = await prisma.refund.findUnique({
                where: { orderId: existingOrder.id },
                select: { id: true, status: true },
            });

            if (!existingRefund) {
                /*
                 * Provider-initiated refund (not user-requested).
                 * Create a Refund record for tracking.
                 * Amount is SERVER-AUTHORITATIVE: order.total from DB.
                 */
                const newRefund = await prisma.refund.create({
                    data: {
                        orderId: existingOrder.id,
                        amount: existingOrder.total,
                        status: "PROCESSING",
                        requestedBy: "PROVIDER",
                        providerRef: refundedRef || undefined,
                    },
                });
                existingRefund = { id: newRefund.id, status: "PROCESSING" };
            }

            /*
             * CAS-PROTECTED TRANSITION + COMPLETION:
             * transitionRefundForWebhook handles:
             * 1. CAS: PENDING → PROCESSING (prevents resurrection)
             * 2. Re-read on CAS failure (handles concurrent admin actions)
             * 3. Returns shouldComplete flag for safe delegation
             */
            const { transitionRefundForWebhook } = await import(
                "@/lib/refund"
            );
            const transition = await transitionRefundForWebhook(
                existingRefund.id,
                refundedRef || undefined
            );

            if (!transition.shouldComplete) {
                return json({
                    success: true,
                    message: `Refund already ${transition.status} (idempotent).`
                });
            }

            /*
             * EXECUTE REFUND COMPLETION:
             * Shared function handles CAS, stock, voucher,
             * affiliate, spin-wheel, and audit logging.
             * Idempotent: duplicate webhooks return safe no-op.
             */
            const result = await executeRefundCompletion(
                existingRefund.id,
                refundedRef || undefined,
                "IPAYMU_WEBHOOK"
            );

            return json({
                success: true,
                message: result.ok
                    ? "Refund processed, stock and voucher restored."
                    : "Refund already processed (idempotent)."
            });
        }

        /* ==========================================
         * UNHANDLED STATUS
         * ==========================================
         */

        console.log(
            "IPAYMU UNHANDLED STATUS:",
            body.Status
        );

        return json({
            success: true,
            message: `Status ${body.Status} diterima tetapi belum membutuhkan perubahan order.`,
        });
    } catch (error) {
        console.error(
            "IPAYMU WEBHOOK ERROR:",
            error
        );

        /* 500 makes iPaymu retry.
         * Good if database is temporarily down. */
        return json(
            {
                success: false,
                message:
                    "Webhook processing failed.",
            },
            500
        );
    }
}
