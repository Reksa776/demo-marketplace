import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
    createCheckoutOrder,
    rollbackCheckoutOrder,
} from "@/lib/checkout";

import { getReferralCode } from "@/lib/affiliate/referral";
import { rateLimiters } from "@/lib/rate-limit";
import { getAppOrigin } from "@/lib/app-origin";

import {
    createRedirectPayment,
    formatProductName,
    IPAYMU_CONFIG,
} from "@/lib/payment/ipaymu";

import type {
    IpaymuPaymentChannel,
    IpaymuPaymentMethod,
} from "@/lib/payment/ipaymu";

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
    let createdOrderId: number | null = null;

    try {
        const user = await getCurrentUser();

        if (!user) {
            return jsonError(
                "Anda harus login terlebih dahulu.",
                401
            );
        }

        // Rate limiting
        const rateLimit =
            rateLimiters.orderCreation(
                user.id!
            );
        if (!rateLimit.allowed) {
            return jsonError(
                "Terlalu banyak permintaan. Coba lagi nanti.",
                429
            );
        }

        // iPaymu credentials check
        if (
            !IPAYMU_CONFIG.apiKey ||
            !IPAYMU_CONFIG.va
        ) {
            console.error(
                "iPaymu credentials belum di-set."
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

        const voucherCode = normalizeVoucherCode(
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

        const affiliateCode = getReferralCode(
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
                spinWheelSpinId:
                    typeof body.spinWheelSpinId ===
                    "number"
                        ? body.spinWheelSpinId
                        : null,
            });

        createdOrderId = result.order.id;

        const appOrigin =
            getAppOrigin(request);

        if (!appOrigin) {
            console.error(
                "GAGAL MEMBANGUN URL: appOrigin kosong."
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
            ipaymuMethod = "qris";
            ipaymuChannel = "qris";
        } else {
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

        if (result.shippingCost > 0) {
            products.push("Biaya Pengiriman");
            qtys.push("1");
            prices.push(
                String(result.shippingCost)
            );
        }

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

        if (result.spinWheelDiscount > 0) {
            products.push("Reward Spin Wheel");
            qtys.push("1");
            prices.push(
                String(-result.spinWheelDiscount)
            );
        }

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

        if (result.spinWheelDiscount > 0) {
            descriptions.push("Reward Spin Wheel");
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
                    user.email ?? "",
                buyerPhone: phone,
                paymentMethod: ipaymuMethod,
                paymentChannel: ipaymuChannel,
                notifyUrl: `${appOrigin}/api/payment/ipaymu/notification`,
                returnUrl: `${appOrigin}/checkout/payment-finish?payment=${encodeURIComponent(
                    result.order.orderNumber
                )}`,
                cancelUrl: `${appOrigin}/checkout/payment-finish?payment=${encodeURIComponent(
                    result.order.orderNumber
                )}`,
                referenceId:
                    result.order.orderNumber,
                description: descriptions,
                expired: 1,
            });

        if (!ipaymuResult.Data?.Url) {
            try {
                await rollbackCheckoutOrder(
                    result.order.id,
                    { restoreCart: false }
                );
                createdOrderId = null;
            } catch (rollbackError) {
                console.error(
                    "IPAYMU ROLLBACK ERROR:",
                    rollbackError
                );
            }

            return jsonError(
                "URL pembayaran iPaymu tidak ditemukan.",
                500
            );
        }

        /* ==========================================
         * SUCCESS
         * ========================================== */

        return jsonSuccess(
            {
                paymentUrl:
                    ipaymuResult.Data.Url,
                sessionId:
                    ipaymuResult.Data.SessionId,
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
                checkoutType: "BUY_NOW_IPAYMU",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unknown error",
                timestamp:
                    new Date().toISOString(),
            })
        );

        const message =
            error instanceof Error
                ? error.message
                : "";

        switch (message) {
            case "NEXT_PUBLIC_APP_URL belum dikonfigurasi.":
                return jsonError(
                    "Konfigurasi aplikasi belum lengkap.",
                    500
                );

            default:
                return jsonError(
                    "Gagal membuat pembayaran iPaymu.",
                    500
                );
        }
    }
}
