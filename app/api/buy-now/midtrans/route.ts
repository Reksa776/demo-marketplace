import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
    createCheckoutOrder,
    rollbackCheckoutOrder,
} from "@/lib/checkout";

import { getReferralCode } from "@/lib/affiliate/referral";

import { rateLimiters } from "@/lib/rate-limit";

import Midtrans from "midtrans-client";

export const dynamic = "force-dynamic";

type PaymentMethod =
    | "BANK_TRANSFER"
    | "E_WALLET"
    | "QRIS";

type ShippingPayload = {
    courier?: string;
    code?: string;
    service?: string;
    service_name?: string;
    etd?: string;
    estimation?: string;
    cost?: number;
    price?: number;
    shipping_cost?: number;
};

type Body = {
    productId: number;
    variantId: number;
    quantity: number;
    addressId: string;
    shipping: ShippingPayload;
    paymentMethod: PaymentMethod;
    voucherCode?: string | null;
    spinWheelSpinId?: number | null;
};

const snap = new Midtrans.Snap({
    isProduction:
        process.env.MIDTRANS_IS_PRODUCTION ===
        "true",
    serverKey:
        process.env.MIDTRANS_SERVER_KEY!,
    clientKey:
        process.env.MIDTRANS_CLIENT_KEY!,
});

function jsonError(
    message: string,
    status = 400
) {
    return NextResponse.json(
        { success: false, message },
        { status }
    );
}

function jsonSuccess(
    data: unknown,
    status = 200
) {
    return NextResponse.json(
        { success: true, data },
        { status }
    );
}

function normalizeVoucherCode(
    value: unknown
) {
    if (typeof value !== "string") {
        return null;
    }
    const code = value.trim().toUpperCase();
    return code || null;
}

function getEnabledPayments(
    paymentMethod: PaymentMethod
) {
    switch (paymentMethod) {
        case "BANK_TRANSFER":
            return [
                "bca_va",
                "bni_va",
                "bri_va",
                "permata_va",
            ];
        case "E_WALLET":
            return ["gopay", "shopeepay"];
        case "QRIS":
            return ["qris"];
        default:
            return [];
    }
}

function getAppOrigin(request: NextRequest) {
    const envUrl =
        process.env.NEXT_PUBLIC_APP_URL;

    if (
        envUrl &&
        /^https?:\/\//.test(envUrl)
    ) {
        return envUrl.replace(/\/+$/, "");
    }

    const forwardedProto =
        request.headers.get(
            "x-forwarded-proto"
        ) || "https";

    const host =
        request.headers.get(
            "x-forwarded-host"
        ) ||
        request.headers.get("host");

    if (!host) {
        console.error(
            "NEXT_PUBLIC_APP_URL tidak ter-set dan host tidak terdeteksi dari headers."
        );
        return "";
    }

    return `${forwardedProto}://${host}`;
}

async function getCurrentUser() {
    const session = await auth();
    if (!session?.user?.id) {
        return null;
    }
    return session.user;
}

export async function POST(
    request: NextRequest
) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return jsonError(
                "Anda harus login terlebih dahulu.",
                401
            );
        }

        // Rate limiting for order creation
        const rateLimit = rateLimiters.orderCreation(user.id!);
        if (!rateLimit.allowed) {
            return jsonError(
                "Terlalu banyak permintaan. Coba lagi nanti.",
                429
            );
        }

        const serverKey =
            process.env.MIDTRANS_SERVER_KEY;

        if (!serverKey) {
            console.error(
                "MIDTRANS_SERVER_KEY belum di-set."
            );
            return jsonError(
                "Konfigurasi pembayaran belum lengkap.",
                500
            );
        }

        let body: Body;

        try {
            body = await request.json();
        } catch {
            return jsonError(
                "Body request tidak valid."
            );
        }

        const productId = Number(
            body.productId
        );

        const variantId = Number(
            body.variantId
        );

        const quantity = Number(
            body.quantity
        );

        const addressId = String(
            body.addressId || ""
        );

        const paymentMethod =
            body.paymentMethod;

        const voucherCode =
            normalizeVoucherCode(
                body.voucherCode
            );

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {
            return jsonError(
                "Product ID tidak valid."
            );
        }

        if (
            !Number.isInteger(variantId) ||
            variantId <= 0
        ) {
            return jsonError(
                "Variant ID tidak valid."
            );
        }

        if (
            !Number.isInteger(quantity) ||
            quantity <= 0 ||
            quantity > 100
        ) {
            return jsonError(
                "Quantity tidak valid."
            );
        }

        if (!addressId) {
            return jsonError(
                "Alamat pengiriman wajib dipilih."
            );
        }

        if (
            ![
                "BANK_TRANSFER",
                "E_WALLET",
                "QRIS",
            ].includes(paymentMethod)
        ) {
            return jsonError(
                "Metode pembayaran tidak valid."
            );
        }

        if (!body.shipping) {
            return jsonError(
                "Pengiriman wajib dipilih."
            );
        }

        const enabledPayments =
            getEnabledPayments(paymentMethod);

        /* ==========================================
         * CREATE ORDER VIA SHARED CHECKOUT
         * ==========================================
         *
         * Uses the same createCheckoutOrder()
         * shared by Cart COD, Cart Midtrans,
         * and Buy Now COD.
         *
         * Handles:
         * - marketing pricing (flash sale,
         *   discount, campaign)
         * - flash sale stock reservation
         * - regular stock reservation
         * - voucher validation + usage
         * - order + order item creation
         * - pending order cleanup
         */

        let createdOrderId: number | null =
            null;

        const affiliateCode =
            getReferralCode(
                request.headers.get("cookie")
            );

        const result =
            await createCheckoutOrder({
                userId: user.id,
                mode: "BUY_NOW",
                addressId,
                shipping: body.shipping,
                paymentMethod,
                voucherCode:
                    voucherCode ?? undefined,
                productId,
                variantId,
                quantity,
                affiliateCode,
                spinWheelSpinId: typeof body.spinWheelSpinId === "number" ? body.spinWheelSpinId : null,
            });

        createdOrderId = result.order.id;

        /* ==========================================
         * MIDTRANS SNAP
         * ========================================== */

        const appOrigin =
            getAppOrigin(request);

        if (!appOrigin) {
            console.error(
                "GAGAL MEMBANGUN FINISH URL: appOrigin kosong."
            );

            await rollbackCheckoutOrder(
                result.order.id,
                { restoreCart: false }
            );

            createdOrderId = null;

            throw new Error(
                "NEXT_PUBLIC_APP_URL belum dikonfigurasi."
            );
        }

        const recipientName = (
            result.order.recipientName ?? ""
        ).substring(0, 50);

        const phone = (
            result.order.phone ?? ""
        ).substring(0, 20);

        const finishUrl =
            `${appOrigin}/checkout/payment-finish?payment=${encodeURIComponent(
                result.order.orderNumber
            )}`;

        const parameter = {
            transaction_details: {
                order_id:
                    result.order.orderNumber,
                gross_amount:
                    result.grossAmount,
            },

            item_details: result.itemDetails,

            customer_details: {
                first_name: recipientName,
                phone,
                email:
                    user.email ?? undefined,
                shipping_address: {
                    first_name: recipientName,
                    phone,
                    address:
                        result.order.address,
                    city:
                        result.order.city ??
                        "",
                    postal_code:
                        result.order
                            .postalCode ?? "",
                    country_code: "IDN",
                },
            },

            enabled_payments: enabledPayments,

            callbacks: {
                finish: finishUrl,
            },

            custom_expiry: {
                expiry_duration: 1,
                unit: "hour",
            },

            custom_field1:
                result.order.id.toString(),

            custom_field2:
                result.order.paymentMethod,

            custom_field3:
                result.order.voucherCode ||
                "",
        };

        /* ==========================================
         * CREATE SNAP TOKEN
         * ========================================== */

        let transaction: any;

        try {
            transaction =
                await snap.createTransaction(
                    parameter
                );
        } catch (midtransError) {
            console.error(
                "MIDTRANS CREATE FAILED:",
                midtransError
            );

            /* ==========================================
             * ROLLBACK ON SNAP FAILURE
             * ==========================================
             *
             * Order already committed to DB.
             * Must release stock + voucher
             * and cancel order.
             */

            try {
                await rollbackCheckoutOrder(
                    result.order.id,
                    { restoreCart: false }
                );
                createdOrderId = null;
            } catch (rollbackError) {
                console.error(
                    "MIDTRANS ROLLBACK ERROR:",
                    rollbackError
                );
            }

            throw midtransError;
        }

        if (!transaction?.token) {
            try {
                await rollbackCheckoutOrder(
                    result.order.id,
                    { restoreCart: false }
                );
                createdOrderId = null;
            } catch (rollbackError) {
                console.error(
                    "TOKEN ROLLBACK ERROR:",
                    rollbackError
                );
            }

            return jsonError(
                "Token pembayaran Midtrans tidak ditemukan.",
                500
            );
        }

        /* ==========================================
         * SUCCESS
         * ========================================== */

        return jsonSuccess(
            {
                token: transaction.token,
                redirectUrl:
                    transaction.redirect_url ||
                    null,
                paymentReference:
                    result.order.orderNumber,
                orderId: result.order.id,
                orderNumber:
                    result.order.orderNumber,
                grossAmount:
                    result.grossAmount,
                paymentMethod,
            },
            201
        );
    } catch (error) {
        console.error(
            JSON.stringify({
                event: "CHECKOUT_FAILURE",
                checkoutType: "BUY_NOW_MIDTRANS",
                message: error instanceof Error ? error.message : "Unknown error",
                timestamp: new Date().toISOString(),
            })
        );

        return jsonError(
            "Gagal membuat pembayaran Midtrans.",
            500
        );
    }
}
