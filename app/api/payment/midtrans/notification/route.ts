import {
    NextRequest,
    NextResponse,
} from "next/server";

import crypto from "crypto";

import {
    Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const dynamic =
    "force-dynamic";

type MidtransNotification = {
    order_id?: string;
    transaction_id?: string;
    transaction_status?: string;
    fraud_status?: string;
    status_code?: string;
    gross_amount?: string;
    signature_key?: string;
    payment_type?: string;
    transaction_time?: string;
    settlement_time?: string;
};

function verifySignature(
    notification: MidtransNotification
) {
    const serverKey =
        process.env
            .MIDTRANS_SERVER_KEY;

    if (!serverKey) {
        return false;
    }

    if (
        !notification.order_id ||
        !notification.status_code ||
        !notification.gross_amount ||
        !notification.signature_key
    ) {
        return false;
    }

    const raw =
        `${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`;

    const expected =
        crypto
            .createHash(
                "sha512"
            )
            .update(raw)
            .digest("hex");

    return crypto.timingSafeEqual(
        Buffer.from(
            expected,
            "utf8"
        ),
        Buffer.from(
            notification.signature_key,
            "utf8"
        )
    );
}

function json(
    data: unknown,
    status = 200
) {
    return NextResponse.json(
        data,
        { status }
    );
}

async function releaseReservedStock(
    tx: Prisma.TransactionClient,
    orderId: number
) {
    const order =
        await tx.order.findUnique({
            where: {
                id: orderId,
            },

            include: {
                items: true,
            },
        });

    if (!order) {
        return;
    }

    for (const item of order.items) {
        /*
         * variantId/productId di OrderItem sekarang
         * nullable (SetNull ketika produk dihapus).
         * Kalau produknya sudah dihapus, tidak ada
         * lagi row ProductVariant/Product untuk
         * di-restore stock/sold-nya - cukup skip.
         */

        /*
         * Check if this item used a flash sale.
         * FlashSale has @@unique([variantId]).
         * If a FlashSale exists for this variant,
         * the checkout reserved flash-sale stock,
         * NOT regular ProductVariant.stock.
         */
        const flashSale = item.variantId !== null
            ? await tx.flashSale.findFirst({
                  where: { variantId: item.variantId },
              })
            : null;

        if (flashSale) {
            /*
             * FLASH SALE ITEM:
             * Restore flash-sale stock.
             * Do NOT touch ProductVariant.stock.
             *
             * BUG #3 FIX: Conditional update prevents
             * negative soldCount and saleStock inflation.
             */
            await tx.$executeRaw`
                UPDATE FlashSale
                SET saleStock = saleStock + ${item.quantity},
                    soldCount = soldCount - ${item.quantity}
                WHERE id = ${flashSale.id}
                  AND soldCount >= ${item.quantity}
            `;

            /*
             * FLASH SALE PURCHASE CLEANUP (BUG T1-1 FIX):
             * Delete FlashSalePurchase record so the user
             * can re-attempt if they want to.
             * Without this, the user is permanently blocked
             * from buying this flash sale (purchaseLimit
             * already consumed).
             */
            await tx.flashSalePurchase.deleteMany({
                where: {
                    flashSaleId: flashSale.id,
                    userId: order.userId,
                },
            });
        } else if (
            item.variantId !== null
        ) {
            /*
             * REGULAR ITEM:
             * Restore regular product stock.
             */
            await tx.productVariant.update({
                where: {
                    id: item.variantId,
                },
                data: {
                    stock: {
                        increment: item.quantity,
                    },
                },
            });
        }

        if (
            item.productId !== null
        ) {
            await tx.$executeRaw`
                UPDATE Product
                SET sold = GREATEST(0, sold - ${item.quantity})
                WHERE id = ${item.productId}
            `;
        }
    }

    /*
     * Release voucher quota.
     *
     * Hanya dilakukan kalau order sebelumnya
     * belum final paid.
     */
    if (
        order.voucherId
    ) {
        await tx.voucher.updateMany(
            {
                where: {
                    id: order.voucherId,
                    usedCount: { gt: 0 },
                },
                data: {
                    usedCount: { decrement: 1 },
                },
            }
        );

        /*
         * Restore per-user usage count.
         *
         * Mirrors rollbackCheckoutOrder() in lib/checkout.ts.
         * Without this, a user whose payment expired/failed
         * would permanently lose one usage slot for the voucher.
         */
        const userUsage =
            await tx.voucherUserUsage.findUnique({
                where: {
                    voucherId_userId: {
                        voucherId: order.voucherId,
                        userId: order.userId,
                    },
                },
            });

        if (
            userUsage &&
            userUsage.usageCount > 0
        ) {
            await tx.voucherUserUsage.update({
                where: { id: userUsage.id },
                data: {
                    usageCount: {
                        decrement: 1,
                    },
                },
            });
        }
    }
}

export async function POST(
    request: NextRequest
) {
    try {
        const body =
            (await request.json()) as MidtransNotification;

        console.log(
            "MIDTRANS NOTIFICATION:",
            {
                order_id:
                    body.order_id,

                transaction_id:
                    body.transaction_id,

                transaction_status:
                    body.transaction_status,

                payment_type:
                    body.payment_type,
            }
        );

        /*
         * ========================================================
         * VERIFY SIGNATURE
         * ========================================================
         */

        if (
            !verifySignature(
                body
            )
        ) {
            console.error(
                "MIDTRANS INVALID SIGNATURE"
            );

            return json(
                {
                    success:
                        false,
                    message:
                        "Invalid signature.",
                },
                401
            );
        }

        const orderNumber =
            body.order_id;

        if (
            !orderNumber
        ) {
            return json(
                {
                    success:
                        false,
                    message:
                        "order_id tidak ditemukan.",
                },
                400
            );
        }

        const transactionStatus =
            body.transaction_status;

        if (
            !transactionStatus
        ) {
            return json(
                {
                    success:
                        false,
                    message:
                        "transaction_status tidak ditemukan.",
                },
                400
            );
        }

        /*
         * ========================================================
         * FIND ORDER
         * ========================================================
         */

        const existingOrder =
            await prisma.order.findUnique(
                {
                    where: {
                        orderNumber,
                    },

                    include: {
                        items:
                            true,
                    },
                }
            );

        if (
            !existingOrder
        ) {
            console.error(
                "MIDTRANS ORDER NOT FOUND:",
                orderNumber
            );

            /*
             * Tetap 200 supaya Midtrans tidak retry
             * terus-menerus untuk order yang memang
             * tidak ada.
             */
            return json({
                success:
                    false,

                message:
                    "Order tidak ditemukan.",
            });
        }

        /*
         * ========================================================
         * NOMINAL VALIDATION
         * ========================================================
         *
         * Jangan menerima notification dengan nominal
         * berbeda dari Order.
         */

        if (
            body.gross_amount
        ) {
            const notificationAmount =
                Number(
                    body.gross_amount
                );

            const orderAmount =
                Number(
                    existingOrder.total.toString()
                );

            if (
                !Number.isFinite(
                    notificationAmount
                ) ||
                notificationAmount !==
                orderAmount
            ) {
                console.error(
                    "MIDTRANS GROSS AMOUNT MISMATCH:",
                    {
                        orderNumber,
                        notificationAmount,
                        orderAmount,
                    }
                );

                return json(
                    {
                        success:
                            false,
                        message:
                            "Gross amount tidak sesuai.",
                    },
                    400
                );
            }
        }

        /*
         * ========================================================
         * STATUS MAPPING
         * ========================================================
         */

        const isSuccess =
            transactionStatus ===
            "settlement" ||
            (
                transactionStatus ===
                "capture" &&
                (
                    !body.fraud_status ||
                    body.fraud_status ===
                    "accept"
                )
            );

        const isPending =
            transactionStatus ===
            "pending";

        const isFailed =
            transactionStatus ===
            "deny" ||
            transactionStatus ===
            "cancel" ||
            transactionStatus ===
            "failure";

        const isExpired =
            transactionStatus ===
            "expire";

        const isRefunded =
            transactionStatus ===
            "refund";

        /*
         * ========================================================
         * SUCCESS
         * ========================================================
         */

        if (isSuccess) {
            await prisma.$transaction(async (tx) => {
                const order = await tx.order.findUnique({
                    where: { id: existingOrder.id },
                });

                if (!order) {
                    return;
                }

                /*
                 * Idempotent:
                 *
                 * Kalau webhook settlement datang
                 * dua kali, jangan proses ulang.
                 */
                if (
                    order.paymentStatus === "PAID" &&
                    order.status !== "CANCELLED"
                ) {
                    return;
                }

                await tx.order.update({
                    where: { id: order.id },
                    data: {
                        status: "PAID",
                        paymentStatus: "PAID",
                        paidAt: order.paidAt || new Date(),
                        paymentReference:
                            body.transaction_id || order.paymentReference,
                    },
                });

                /*
                 * Kosongkan cart HANYA kalau order ini
                 * berasal dari checkout cart (bukan buy-now,
                 * bukan COD yang sudah dihapus di endpoint lain).
                 */
                if (order.orderNumber.startsWith("PAY-CART-")) {
                    const cart = await tx.cart.findUnique({
                        where: { userId: order.userId },
                    });

                    if (cart) {
                        await tx.cartItem.deleteMany({
                            where: { cartId: cart.id },
                        });
                    }
                }
            });

            /*
             * ==========================================
             * NOTIFICATION TRIGGER
             * ==========================================
             *
             * Fire-and-forget.
             * Notification error tidak boleh
             * mempengaruhi webhook response.
             */
            if (existingOrder.status !== "PAID") {
                const { onOrderStatusChanged } =
                    await import(
                        "@/lib/notification/order-status-handler"
                    );

                onOrderStatusChanged(
                    existingOrder.id,
                    existingOrder.status,
                    "PAID"
                ).catch((err) =>
                    console.error(
                        "NOTIFICATION TRIGGER ERROR:",
                        err
                    )
                );
            }

            return json({
                success: true,
                message: "Payment settlement processed.",
            });
        }

        /*
         * ========================================================
         * PENDING
         * ========================================================
         */

        if (
            isPending
        ) {
            /*
             * BUG #2 FIX: Do NOT revert PAID orders.
             * Atomic CAS prevents delayed pending webhook
             * from overriding a settled payment.
             */
            const pendingRef =
                body.transaction_id ||
                existingOrder.paymentReference;

            const pendingAffected =
                await prisma.$executeRaw`
                UPDATE \`Order\`
                SET status = 'PENDING',
                    paymentStatus = 'PENDING',
                    paymentReference = ${pendingRef}
                WHERE id = ${existingOrder.id}
                  AND status IN ('PENDING', 'PROCESSING')
                  AND paymentStatus != 'PAID'
            `;

            return json({
                success:
                    true,

                message:
                    pendingAffected > 0
                        ? "Payment pending processed."
                        : "Order already paid, pending ignored.",
            });
        }

        /*
         * ========================================================
         * EXPIRED
         * ========================================================
         */

        if (
            isExpired
        ) {
            await prisma.$transaction(
                async (tx) => {
                    /*
                     * ATOMIC CAS (BUG #1/#4 FIX):
                     * Only transition PENDING/PROCESSING -> CANCELLED.
                     * Prevents concurrent webhooks from double-restoring stock.
                     */
                    const expiredRef =
                        body.transaction_id ||
                        existingOrder.paymentReference;

                    const affectedRows =
                        await tx.$executeRaw`
                        UPDATE \`Order\`
                        SET status = 'CANCELLED',
                            paymentStatus = 'EXPIRED',
                            paymentReference = ${expiredRef}
                        WHERE id = ${existingOrder.id}
                          AND status IN ('PENDING', 'PROCESSING')
                          AND paymentStatus != 'PAID'
                    `;

                    if (affectedRows === 0) {
                        return;
                    }

                    await releaseReservedStock(
                        tx,
                        existingOrder.id
                    );
                }
            );

            /*
             * NOTIFICATION TRIGGER
             */
            if (existingOrder.status !== "CANCELLED") {
                const { onOrderStatusChanged } =
                    await import(
                        "@/lib/notification/order-status-handler"
                    );

                onOrderStatusChanged(
                    existingOrder.id,
                    existingOrder.status,
                    "CANCELLED"
                ).catch((err) =>
                    console.error(
                        "NOTIFICATION TRIGGER ERROR:",
                        err
                    )
                );
            }

            return json({
                success:
                    true,

                message:
                    "Payment expired processed.",
            });
        }

        /*
         * ========================================================
         * DENY / CANCEL / FAILURE
         * ========================================================
         */

        if (
            isFailed
        ) {
            await prisma.$transaction(
                async (tx) => {
                    /*
                     * ATOMIC CAS (BUG #1/#4 FIX):
                     * Only transition PENDING/PROCESSING -> CANCELLED.
                     * Prevents concurrent webhooks from double-restoring stock.
                     */
                    const failedRef =
                        body.transaction_id ||
                        existingOrder.paymentReference;

                    const affectedRows =
                        await tx.$executeRaw`
                        UPDATE \`Order\`
                        SET status = 'CANCELLED',
                            paymentStatus = 'FAILED',
                            paymentReference = ${failedRef}
                        WHERE id = ${existingOrder.id}
                          AND status IN ('PENDING', 'PROCESSING')
                          AND paymentStatus != 'PAID'
                    `;

                    if (affectedRows === 0) {
                        return;
                    }

                    await releaseReservedStock(
                        tx,
                        existingOrder.id
                    );
                }
            );

            /*
             * NOTIFICATION TRIGGER
             */
            if (existingOrder.status !== "CANCELLED") {
                const { onOrderStatusChanged } =
                    await import(
                        "@/lib/notification/order-status-handler"
                    );

                onOrderStatusChanged(
                    existingOrder.id,
                    existingOrder.status,
                    "CANCELLED"
                ).catch((err) =>
                    console.error(
                        "NOTIFICATION TRIGGER ERROR:",
                        err
                    )
                );
            }

            return json({
                success:
                    true,

                message:
                    "Payment failure processed.",
            });
        }

        /*
         * ========================================================
         * REFUND
         * ========================================================
         */        if (
            isRefunded
        ) {
            /*
             * REFUND GUARD (T2-2 FIX):
             * Only process refund for orders that are currently PAID.
             * Ignore refund for CANCELLED/PENDING/FAILED orders.
             */
            if (
                existingOrder.paymentStatus === "PAID"
            ) {
                /*
                 * Only process refund if order is currently PAID.
                 * This is inherently idempotent: once REFUNDED,
                 * the PAID check will fail on subsequent calls.
                 */
                await prisma.order.update({
                    where: {
                        id:
                            existingOrder.id,
                    },

                    data: {
                        paymentStatus:
                            "REFUNDED",

                        paymentReference:
                            body.transaction_id || existingOrder.paymentReference,
                    },
                });
            }

            return json({
                success: true,

                message: "Refund processed.",
            });
        }

        /*
         * Status lain yang belum kita mapping.
         */
        console.log(
            "MIDTRANS UNHANDLED STATUS:",
            transactionStatus
        );

        return json({
            success:
                true,

            message:
                `Status ${transactionStatus} diterima tetapi belum membutuhkan perubahan order.`,
        });
    } catch (error) {
        console.error(
            "MIDTRANS WEBHOOK ERROR:",
            error
        );

        /*
         * 500 membuat Midtrans melakukan retry.
         *
         * Ini bagus kalau database sementara error.
         */
        return json(
            {
                success:
                    false,

                message:
                    "Webhook processing failed.",
            },
            500
        );
    }
}