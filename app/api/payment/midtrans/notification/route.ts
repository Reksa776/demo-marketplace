import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/*
 * ==========================================
 * MIDTRANS NOTIFICATION WEBHOOK
 * ==========================================
 *
 * URL ini WAJIB didaftarkan di:
 * Midtrans Dashboard > Settings > Configuration
 * > Payment Notification URL
 *
 * Contoh:
 * https://demosolusisejalan.my.id/api/payment/midtrans/notification
 *
 * PENTING:
 *
 * Endpoint ini adalah SUMBER KEBENARAN FINAL
 * untuk status pembayaran. Jangan pernah
 * mengandalkan snap.pay() onSuccess di client
 * saja, karena user bisa menutup browser
 * kapan saja.
 */

const SERVER_KEY =
    process.env.MIDTRANS_SERVER_KEY!;
    console.log("DEBUG SERVER_KEY:", JSON.stringify(SERVER_KEY));
console.log("DEBUG SERVER_KEY length:", SERVER_KEY?.length);

export async function POST(
    request: Request
) {
    try {
        const body = await request.json();

        console.log(
            "========== MIDTRANS NOTIFICATION =========="
        );

        console.log(
            JSON.stringify(body, null, 2)
        );

        const {
            order_id,
            status_code,
            gross_amount,
            signature_key,
            transaction_status,
            fraud_status,
        } = body;

        if (
            !order_id ||
            !status_code ||
            !gross_amount ||
            !signature_key
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Payload notifikasi tidak lengkap.",
                },
                { status: 400 }
            );
        }

        /*
         * ==========================================
         * VERIFY SIGNATURE
         * ==========================================
         *
         * signature_key = SHA512(
         *   order_id + status_code +
         *   gross_amount + ServerKey
         * )
         *
         * WAJIB diverifikasi supaya endpoint ini
         * tidak bisa dipanggil sembarangan oleh
         * pihak luar untuk memalsukan status
         * pembayaran.
         */

        const expectedSignature = crypto
            .createHash("sha512")
            .update(
                `${order_id}${status_code}${gross_amount}${SERVER_KEY}`
            )
            .digest("hex");

        if (
            expectedSignature !==
            signature_key
        ) {
            console.error(
                "MIDTRANS NOTIFICATION: SIGNATURE TIDAK VALID.",
                { order_id }
            );

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Signature tidak valid.",
                },
                { status: 403 }
            );
        }

        /*
         * ==========================================
         * FIND ORDER
         * ==========================================
         *
         * order_id dari Midtrans === orderNumber
         * yang kita simpan saat membuat order.
         */

        const order =
            await prisma.order.findUnique({
                where: {
                    orderNumber: order_id,
                },
                include: {
                    items: true,
                },
            });

        if (!order) {
            console.error(
                "MIDTRANS NOTIFICATION: ORDER TIDAK DITEMUKAN:",
                order_id
            );

            /*
             * Tetap balas 200 supaya Midtrans
             * tidak retry terus-menerus untuk
             * order yang memang tidak pernah ada.
             */

            return NextResponse.json({
                success: true,
                message:
                    "Order tidak ditemukan.",
            });
        }

        /*
         * ==========================================
         * IDEMPOTENCY
         * ==========================================
         *
         * Midtrans bisa mengirim notifikasi
         * lebih dari sekali untuk order_id
         * yang sama. Jangan proses ulang kalau
         * order sudah final.
         */

        if (
            order.paymentStatus === "PAID" ||
            order.status === "CANCELLED"
        ) {
            return NextResponse.json({
                success: true,
                message:
                    "Order sudah final sebelumnya.",
            });
        }

        /*
         * ==========================================
         * MAP TRANSACTION STATUS
         * ==========================================
         */

        let newPaymentStatus:
            | "UNPAID"
            | "PENDING"
            | "PAID"
            | "FAILED"
            | "EXPIRED" = "PENDING";

        let newOrderStatus:
            | "PENDING"
            | "PAID"
            | "CANCELLED" = "PENDING";

        let shouldRestoreStock = false;

        if (
            transaction_status ===
            "capture" ||
            transaction_status ===
            "settlement"
        ) {
            if (
                transaction_status ===
                "capture" &&
                fraud_status === "challenge"
            ) {
                /*
                 * Transaksi kartu kredit yang
                 * diflag FDS (Fraud Detection
                 * System), butuh review manual
                 * dari Midtrans/merchant.
                 */

                newPaymentStatus = "PENDING";
                newOrderStatus = "PENDING";
            } else {
                newPaymentStatus = "PAID";
                newOrderStatus = "PAID";
            }
        } else if (
            transaction_status === "pending"
        ) {
            newPaymentStatus = "PENDING";
            newOrderStatus = "PENDING";
        } else if (
            transaction_status === "deny" ||
            transaction_status === "cancel" ||
            transaction_status === "expire"
        ) {
            newPaymentStatus =
                transaction_status ===
                    "expire"
                    ? "EXPIRED"
                    : "FAILED";

            newOrderStatus = "CANCELLED";

            shouldRestoreStock = true;
        }

        /*
         * ==========================================
         * UPDATE ORDER
         * ==========================================
         *
         * Kalau pembayaran gagal/expired,
         * kembalikan stock yang sudah
         * dikurangi saat order dibuat.
         */

        await prisma.$transaction(
            async (tx) => {
                await tx.order.update({
                    where: {
                        id: order.id,
                    },

                    data: {
                        paymentStatus:
                            newPaymentStatus,

                        status:
                            newOrderStatus,

                        paidAt:
                            newPaymentStatus ===
                                "PAID"
                                ? new Date()
                                : order.paidAt,
                    },
                });

                if (shouldRestoreStock) {
                    for (const item of order.items) {
                        await tx.productVariant.update(
                            {
                                where: {
                                    id: item.variantId,
                                },

                                data: {
                                    stock: {
                                        increment:
                                            item.quantity,
                                    },
                                },
                            }
                        );

                        await tx.product.update(
                            {
                                where: {
                                    id: item.productId,
                                },

                                data: {
                                    sold: {
                                        decrement:
                                            item.quantity,
                                    },
                                },
                            }
                        );
                    }
                }
            },
            {
                timeout: 15000,   // 15 detik, dari default 5 detik
                maxWait: 10000,   // waktu tunggu maksimal buat dapat slot transaksi
            }
        );

        console.log(
            `MIDTRANS NOTIFICATION: ORDER ${order_id} -> paymentStatus=${newPaymentStatus}, status=${newOrderStatus}`
        );

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error(
            "MIDTRANS NOTIFICATION ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal memproses notifikasi.",
            },
            { status: 500 }
        );
    }
}