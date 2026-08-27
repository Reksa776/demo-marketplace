import { NextResponse } from "next/server";

import { auth } from "@/auth";

import {
    createCheckoutOrder,
    rollbackCheckoutOrder,
} from "@/lib/checkout";

import { getReferralCode } from "@/lib/affiliate/referral";

import { rateLimiters } from "@/lib/rate-limit";

import {
    createRedirectPayment,
    formatProductName,
    IPAYMU_CONFIG,
} from "@/lib/payment/ipaymu";

import type {
    IpaymuPaymentChannel,
    IpaymuPaymentMethod,
} from "@/lib/payment/ipaymu";

/* ==========================================
 * POST /api/payment/ipaymu
 * ==========================================
 *
 * NON-COD ONLY — iPaymu Redirect Payment
 *
 * Flow:
 * cleanup pending payment lama
 * ↓
 * create order
 * ↓
 * reserve stock
 * ↓
 * voucher usage
 * ↓
 * create iPaymu Redirect Payment
 * ↓
 * return paymentUrl to client
 * ↓
 * client redirects to iPaymu page
 *
 * Cart TIDAK dikosongkan (sama seperti Midtrans).
 */

export async function POST(request: Request) {
    let createdOrderId: number | null = null;

    try {
        /* ==========================================
         * AUTH
         * ========================================== */

        const session = await auth();

        if (!session?.user?.id) {
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

        const userId = session.user.id;

        /* ==========================================
         * RATE LIMIT
         * ========================================== */

        const rateLimit =
            rateLimiters.orderCreation(userId);

        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Terlalu banyak permintaan. Coba lagi nanti.",
                },
                { status: 429 }
            );
        }

        /* ==========================================
         * CREDENTIALS CHECK
         * ========================================== */

        if (
            !IPAYMU_CONFIG.apiKey ||
            !IPAYMU_CONFIG.va
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Konfigurasi iPaymu belum lengkap.",
                },
                { status: 500 }
            );
        }

        /* ==========================================
         * BODY
         * ========================================== */

        const body = await request.json();

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
        } = body;

        /* ==========================================
         * MODE
         * ========================================== */

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

        /* ==========================================
         * PAYMENT METHOD
         * ========================================== */

        const allowedPaymentMethods = [
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
                        "Metode pembayaran tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        /* ==========================================
         * ADDRESS
         * ========================================== */

        if (
            typeof addressId !== "string" ||
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

        /* ==========================================
         * SHIPPING
         * ========================================== */

        if (
            !shipping ||
            typeof shipping !== "object"
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

        /* ==========================================
         * CREATE CHECKOUT ORDER
         * ========================================== */

        const affiliateCode = getReferralCode(
            request.headers.get("cookie")
        );

        const result = await createCheckoutOrder({
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

            spinWheelSpinId:
                typeof spinWheelSpinId === "number"
                    ? spinWheelSpinId
                    : null,
        });

        createdOrderId = result.order.id;

        /* ==========================================
         * APP URL
         * ========================================== */

        const appUrl =
            process.env.NEXT_PUBLIC_APP_URL;

        if (!appUrl) {
            await rollbackCheckoutOrder(
                result.order.id,
                {
                    restoreCart: false,
                }
            );

            createdOrderId = null;

            throw new Error(
                "NEXT_PUBLIC_APP_URL belum dikonfigurasi."
            );
        }

        /* ==========================================
         * MAP PAYMENT METHOD TO IPAYMU
         * ========================================== */

        let ipaymuMethod: IpaymuPaymentMethod =
            "va";
        let ipaymuChannel: IpaymuPaymentChannel =
            "bca";

        if (paymentMethod === "QRIS") {
            ipaymuMethod = "qris";
            ipaymuChannel = "qris";
        } else if (
            paymentMethod === "E_WALLET"
        ) {
            // iPaymu uses QRIS for e-wallet
            ipaymuMethod = "qris";
            ipaymuChannel = "qris";
        } else {
            // BANK_TRANSFER → VA
            ipaymuMethod = "va";
            ipaymuChannel = "bca";
        }

        /* ==========================================
         * BUILD IPAYMU PRODUCT ITEMS
         * ========================================== */

        const products: string[] = [];
        const qtys: string[] = [];
        const prices: string[] = [];

        for (const item of result.checkoutItems) {
            products.push(
                formatProductName(
                    item.productName,
                    item.variantName
                ).substring(0, 50)
            );
            qtys.push(String(item.quantity));
            prices.push(String(item.price));
        }

        // Add shipping as a product item
        if (result.shippingCost > 0) {
            products.push("Biaya Pengiriman");
            qtys.push("1");
            prices.push(String(result.shippingCost));
        }

        // Add voucher discount as negative price item
        if (
            result.discount > 0 &&
            result.order.voucherCode
        ) {
            products.push(
                `Voucher ${result.order.voucherCode}`.substring(
                    0,
                    50
                )
            );
            qtys.push("1");
            prices.push(
                String(-result.discount)
            );
        }

        /* ==========================================
         * CUSTOMER DATA
         * ========================================== */

        const recipientName = (
            result.order.recipientName ?? ""
        ).substring(0, 50);

        const phone = (
            result.order.phone ?? ""
        ).substring(0, 20);

        /* ==========================================
         * BUILD DESCRIPTION ARRAY
         * ==========================================
         *
         * iPaymu requires description as an array,
         * one entry per product item.
         */

        const descriptions: string[] =
            result.checkoutItems.map((item) =>
                formatProductName(
                    item.productName,
                    item.variantName
                ).substring(0, 50)
            );

        if (result.shippingCost > 0) {
            descriptions.push("Biaya Pengiriman");
        }

        if (
            result.discount > 0 &&
            result.order.voucherCode
        ) {
            descriptions.push(
                `Voucher ${result.order.voucherCode}`.substring(
                    0,
                    50
                )
            );
        }

        /* ==========================================
         * CREATE IPAYMU REDIRECT PAYMENT
         * ========================================== */

        const ipaymuResult =
            await createRedirectPayment({
                product: products,
                qty: qtys,
                price: prices,
                amount: result.grossAmount,
                buyerName: recipientName,
                buyerEmail:
                    session.user.email ?? "",
                buyerPhone: phone,
                paymentMethod: ipaymuMethod,
                paymentChannel: ipaymuChannel,
                notifyUrl: `${appUrl}/api/payment/ipaymu/notification`,
                returnUrl: `${appUrl}/checkout/payment-finish?payment=${encodeURIComponent(
                    result.order.orderNumber
                )}`,
                cancelUrl: `${appUrl}/checkout/payment-finish?payment=${encodeURIComponent(
                    result.order.orderNumber
                )}`,
                referenceId:
                    result.order.orderNumber,
                description: descriptions,
                expired: 1,
            });

        if (
            !ipaymuResult.Data?.Url
        ) {
            try {
                await rollbackCheckoutOrder(
                    result.order.id,
                    {
                        restoreCart: false,
                    }
                );

                createdOrderId = null;
            } catch (rollbackError) {
                console.error(
                    "IPAYMU ROLLBACK ERROR:",
                    rollbackError
                );
            }

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "URL pembayaran iPaymu tidak ditemukan.",
                },
                {
                    status: 500,
                }
            );
        }

        /* ==========================================
         * SUCCESS
         * ========================================== */

        return NextResponse.json({
            success: true,

            message:
                "Pembayaran iPaymu berhasil dibuat.",

            data: {
                orderId: result.order.id,

                orderNumber:
                    result.order.orderNumber,

                paymentUrl:
                    ipaymuResult.Data.Url,

                sessionId:
                    ipaymuResult.Data.SessionId,

                paymentReference:
                    result.order.orderNumber,

                paymentMethod,

                subtotal: result.subtotal,
                shippingCost: result.shippingCost,
                discount: result.discount,
                grossAmount: result.grossAmount,

                mode,
            },
        });
    } catch (error: any) {
        console.error(
            JSON.stringify({
                event: "CHECKOUT_FAILURE",
                checkoutType: "CART_IPAYMU",
                orderId: createdOrderId,
                message:
                    error?.message ??
                    "Unknown error",
                timestamp:
                    new Date().toISOString(),
            })
        );

        /* ==========================================
         * SAFETY ROLLBACK
         * ========================================== */

        if (createdOrderId !== null) {
            try {
                await rollbackCheckoutOrder(
                    createdOrderId,
                    {
                        restoreCart: false,
                    }
                );
            } catch (rollbackError) {
                console.error(
                    "FINAL ROLLBACK ERROR:",
                    rollbackError
                );
            }
        }

        const message =
            error?.message ??
            "Gagal membuat pembayaran iPaymu.";

        const status = Number.isInteger(
            error?.status
        )
            ? error.status
            : 500;

        return NextResponse.json(
            {
                success: false,

                message,
            },
            {
                status,
            }
        );
    }
}
