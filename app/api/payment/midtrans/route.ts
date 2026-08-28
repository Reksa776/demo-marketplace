import { NextResponse } from "next/server";

import { auth } from "@/auth";

import Midtrans from "midtrans-client";

import {
    createCheckoutOrder,
    getEnabledPayments,
    rollbackCheckoutOrder,
} from "@/lib/checkout";

import { getReferralCode } from "@/lib/affiliate/referral";

import { rateLimiters } from "@/lib/rate-limit";

const snap =
    new Midtrans.Snap({
        isProduction:
            process.env
                .MIDTRANS_IS_PRODUCTION ===
            "true",

        serverKey:
            process.env
                .MIDTRANS_SERVER_KEY!,

        clientKey:
            process.env
                .MIDTRANS_CLIENT_KEY!,
    });

/*
 * ==========================================
 * POST /api/payment/midtrans
 * ==========================================
 *
 * NON-COD ONLY
 *
 * Flow:
 *
 * cleanup pending payment lama
 * ↓
 * create order
 * ↓
 * reserve stock
 * ↓
 * voucher usage
 * ↓
 * create Midtrans Snap
 *
 * Cart TIDAK dikosongkan.
 */

export async function POST(
    request: Request
) {
    let createdOrderId:
        | number
        | null = null;

    try {
        /*
         * ==========================================
         * AUTH
         * ==========================================
         */

        const session =
            await auth();

        if (
            !session?.user?.id
        ) {
            return NextResponse.json(
                {
                    success: false,

                    message:
                        "Silakan login terlebih dahulu.",
                },
                {
                    status: 401,
                }
            );
        }

        const userId =
            session.user.id;

        /*
         * ==========================================
         * RATE LIMIT
         * ==========================================
         */

        const rateLimit =
            rateLimiters.orderCreation(userId);

        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Terlalu banyak permintaan. Coba lagi nanti.",
                },
                { status: 429 }
            );
        }

        /*
         * ==========================================
         * BODY
         * ==========================================
         */

        const body =
            await request.json();

        const {
            mode = "CART",

            addressId,

            shipping,

            paymentMethod,

            voucherCode,

            productId,

            variantId,

            quantity,

            spinWheelSpinId,
            selectedCartItemIds,
        } = body;

        /*
         * ==========================================
         * MODE
         * ==========================================
         */

        if (
            mode !== "CART" &&
            mode !== "BUY_NOW"
        ) {
            return NextResponse.json(
                {
                    success: false,

                    message:
                        "Mode checkout tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * PAYMENT METHOD
         * ==========================================
         */

        const allowedPaymentMethods =
            [
                "BANK_TRANSFER",
                "E_WALLET",
                "QRIS",
            ];

        if (
            !allowedPaymentMethods.includes(
                paymentMethod
            )
        ) {
            return NextResponse.json(
                {
                    success: false,

                    message:
                        "Metode pembayaran Midtrans tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * ADDRESS
         * ==========================================
         */

        if (
            typeof addressId !==
                "string" ||
            !addressId.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,

                    message:
                        "Alamat pengiriman wajib dipilih.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * SHIPPING
         * ==========================================
         */

        if (
            !shipping ||
            typeof shipping !==
                "object"
        ) {
            return NextResponse.json(
                {
                    success: false,

                    message:
                        "Layanan pengiriman wajib dipilih.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * CREATE CHECKOUT ORDER
         * ==========================================
         */

        const affiliateCode =
            getReferralCode(
                request.headers.get("cookie")
            );

        const result =
            await createCheckoutOrder(
                {
                    userId,

                    mode,

                    addressId,

                    shipping,

                    paymentMethod,

                    voucherCode,

                    productId,

                    variantId,

                    quantity,

                    affiliateCode,

                    spinWheelSpinId: typeof spinWheelSpinId === "number" ? spinWheelSpinId : null,

                    selectedCartItemIds: mode === "CART" && Array.isArray(selectedCartItemIds)
                        ? selectedCartItemIds.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
                        : undefined,
                }
            );

        createdOrderId =
            result.order.id;

        /*
         * ==========================================
         * APP URL
         * ==========================================
         */

        const appUrl =
            process.env
                .NEXT_PUBLIC_APP_URL;

        if (!appUrl) {
            await rollbackCheckoutOrder(
                result.order.id,
                {
                    restoreCart:
                        false,
                }
            );

            createdOrderId =
                null;

            throw new Error(
                "NEXT_PUBLIC_APP_URL belum dikonfigurasi."
            );
        }

        /*
         * ==========================================
         * CUSTOMER DATA
         * ==========================================
         */

        const recipientName =
            (
                result.order
                    .recipientName ??
                ""
            ).substring(
                0,
                50
            );

        const phone =
            (
                result.order.phone ??
                ""
            ).substring(
                0,
                20
            );

        /*
         * ==========================================
         * MIDTRANS PARAMETER
         * ==========================================
         */

        const parameter = {
            transaction_details: {
                order_id:
                    result.order
                        .orderNumber,

                gross_amount:
                    result.grossAmount,
            },

            item_details:
                result.itemDetails,

            customer_details: {
                first_name:
                    recipientName,

                phone,

                email:
                    session.user
                        .email ??
                    undefined,

                shipping_address: {
                    first_name:
                        recipientName,

                    phone,

                    address:
                        result.order
                            .address,

                    city:
                        result.order
                            .city ??
                        undefined,

                    postal_code:
                        result.order
                            .postalCode ??
                        undefined,

                    country_code:
                        "IDN",
                },
            },

            enabled_payments:
                getEnabledPayments(
                    paymentMethod
                ),

            callbacks: {
                finish:
                    `${appUrl}/checkout/payment-finish?payment=${encodeURIComponent(
                        result.order
                            .orderNumber
                    )}`,
            },

            custom_expiry: {
                expiry_duration:
                    1,

                unit:
                    "hour",
            },
        };

        console.log(
            "========== MIDTRANS CREATE =========="
        );

        console.log(
            "MODE:",
            mode
        );

        console.log(
            "ORDER:",
            result.order
                .orderNumber
        );

        console.log(
            "GROSS:",
            result.grossAmount
        );

        console.log(
            "DISCOUNT:",
            result.discount
        );

        /*
         * ==========================================
         * CREATE SNAP
         * ==========================================
         */

        let transaction: any;

        try {
            transaction =
                await snap.createTransaction(
                    parameter
                );
        } catch (
            midtransError
        ) {
            console.error(
                "MIDTRANS CREATE FAILED:",
                midtransError
            );

            /*
             * IMPORTANT:
             *
             * Cart TIDAK perlu dikembalikan
             * karena sejak awal tidak pernah
             * dihapus.
             *
             * Yang dikembalikan:
             * - stock
             * - sold
             * - voucher quota
             */

            try {
                await rollbackCheckoutOrder(
                    result.order.id,
                    {
                        restoreCart:
                            false,
                    }
                );

                createdOrderId =
                    null;
            } catch (
                rollbackError
            ) {
                console.error(
                    "MIDTRANS ROLLBACK ERROR:",
                    rollbackError
                );
            }

            throw midtransError;
        }

        /*
         * ==========================================
         * TOKEN VALIDATION
         * ==========================================
         */

        if (
            !transaction?.token
        ) {
            try {
                await rollbackCheckoutOrder(
                    result.order.id,
                    {
                        restoreCart:
                            false,
                    }
                );

                createdOrderId =
                    null;
            } catch (
                rollbackError
            ) {
                console.error(
                    "TOKEN ROLLBACK ERROR:",
                    rollbackError
                );
            }

            return NextResponse.json(
                {
                    success: false,

                    message:
                        "Token pembayaran Midtrans tidak ditemukan.",
                },
                {
                    status: 500,
                }
            );
        }

        /*
         * ==========================================
         * SUCCESS
         * ==========================================
         */

        return NextResponse.json(
            {
                success: true,

                message:
                    "Pembayaran Midtrans berhasil dibuat.",

                data: {
                    orderId:
                        result.order.id,

                    orderNumber:
                        result.order
                            .orderNumber,

                    token:
                        transaction.token,

                    redirectUrl:
                        transaction
                            .redirect_url,

                    paymentReference:
                        result.order
                            .orderNumber,

                    paymentMethod,

                    subtotal:
                        result.subtotal,

                    shippingCost:
                        result.shippingCost,

                    discount:
                        result.discount,

                    grossAmount:
                        result.grossAmount,

                    mode,
                },
            }
        );
    } catch (error: any) {
        console.error(
            JSON.stringify({
                event: "CHECKOUT_FAILURE",
                checkoutType: "CART_MIDTRANS",
                orderId: createdOrderId,
                message: error?.message ?? "Unknown error",
                midtransApiError: error?.ApiResponse?.status_message ?? null,
                timestamp: new Date().toISOString(),
            })
        );

        /*
         * ==========================================
         * SAFETY ROLLBACK
         * ==========================================
         *
         * Kalau order sudah dibuat tetapi
         * ada error lain setelahnya.
         */

        if (
            createdOrderId !== null
        ) {
            try {
                await rollbackCheckoutOrder(
                    createdOrderId,
                    {
                        restoreCart:
                            false,
                    }
                );
            } catch (
                rollbackError
            ) {
                console.error(
                    "FINAL ROLLBACK ERROR:",
                    rollbackError
                );
            }
        }        return NextResponse.json(
            {
                success: false,
                message: "Gagal membuat pembayaran Midtrans.",
            },
            {
                status: 500,
            }
        );
    }
}