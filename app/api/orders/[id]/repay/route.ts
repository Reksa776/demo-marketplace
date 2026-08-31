import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { processRepayment } from "@/lib/repay";
import { rateLimiters } from "@/lib/rate-limit";
import { getAppOrigin } from "@/lib/app-origin";

import { createRedirectPayment, formatProductName } from "@/lib/payment/ipaymu";
import type { IpaymuPaymentChannel, IpaymuPaymentMethod } from "@/lib/payment/ipaymu";

/* ==========================================
 * POST /api/orders/[id]/repay
 * ==========================================
 *
 * Repayment / Bayar Lagi.
 *
 * After the DB state is reset, creates a new
 * payment gateway session and returns the
 * payment URL to the caller.
 *
 * Flow:
 * 1. Validate ownership
 * 2. Validate order eligibility
 * 3. CAS reset order to PENDING
 * 4. Re-reserve stock if needed
 * 5. Create iPaymu payment session
 * 6. Return payment URL to frontend
 *
 * Amount is SERVER-AUTHORITATIVE (order.total from DB).
 * Payment gateway session is created server-side.
 */



export async function POST(
    req: Request,
    context: {
        params: Promise<{
            id: string;
        }>;
    }
) {
    try {
        // ==========================================
        // AUTH
        // ==========================================

        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unauthorized.",
                },
                { status: 401 }
            );
        }

        // ==========================================
        // RATE LIMIT
        // ==========================================

        const rateLimit = rateLimiters.repayment(session.user.id);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Terlalu banyak permintaan. Coba lagi nanti.",
                },
                { status: 429 }
            );
        }

        // ==========================================
        // VALIDATE ORDER ID
        // ==========================================

        const { id } = await context.params;
        const orderId = Number(id);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Order ID tidak valid.",
                },
                { status: 400 }
            );
        }

        // ==========================================
        // PARSE PAYMENT METHOD
        // ==========================================

        let body: { paymentMethod?: string } = {};
        try {
            body = await req.json();
        } catch {
            // Body is optional — default to existing payment method
        }

        const paymentMethod = body.paymentMethod || "BANK_TRANSFER";

        // ==========================================
        // STEP 1: PROCESS REPAYMENT (DB STATE RESET)
        // ==========================================

        const result = await processRepayment(
            session.user.id,
            orderId,
            paymentMethod
        );

        if (!result.ok) {
            return NextResponse.json(
                {
                    success: false,
                    message: result.reason,
                },
                { status: 400 }
            );
        }

        // ==========================================
        // STEP 2: CREATE PAYMENT GATEWAY SESSION
        // ==========================================
        //
        // After DB state is reset, we need to create
        // a new payment session at the gateway.
        // The user will be redirected to the gateway.

        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl) {
            return NextResponse.json(
                {
                    success: true,
                    message: "Pembayaran ulang siap diproses.",
                    data: {
                        orderId: result.orderId,
                        orderNumber: result.orderNumber,
                        grossAmount: result.grossAmount,
                        paymentMethod: result.paymentMethod,
                        // Fallback: no gateway URL, frontend shows manual payment info
                    },
                }
            );
        }

        // Fetch order details for gateway creation
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });

        if (!order) {
            return NextResponse.json(
                {
                    success: true,
                    message: "Pembayaran ulang siap diproses.",
                    data: {
                        orderId: result.orderId,
                        orderNumber: result.orderNumber,
                        grossAmount: result.grossAmount,
                        paymentMethod: result.paymentMethod,
                    },
                }
            );
        }

        // All payment methods now route through iPaymu

        // ==========================================
        // IPAYMU PAYMENT CREATION (ALL METHODS)
        // ==========================================

        try {
            // Map payment method to iPaymu method/channel
            let ipaymuMethod: IpaymuPaymentMethod = "va";
            let ipaymuChannel: IpaymuPaymentChannel = "bca";

            if (paymentMethod === "QRIS") {
                ipaymuMethod = "qris";
                ipaymuChannel = "qris";
            } else if (paymentMethod === "E_WALLET") {
                ipaymuMethod = "qris";
                ipaymuChannel = "qris";
            } else {
                // BANK_TRANSFER and others → VA
                ipaymuMethod = "va";
                ipaymuChannel = "bca";
            }

            const products: string[] = [];
            const qtys: string[] = [];
            const prices: string[] = [];
            const descriptions: string[] = [];

            for (const item of order.items) {
                products.push(
                    formatProductName(item.productName, item.variantName).substring(0, 50)
                );
                qtys.push(String(item.quantity));
                prices.push(String(Number(item.price)));
                descriptions.push(
                    formatProductName(item.productName, item.variantName).substring(0, 50)
                );
            }

            if (Number(order.shippingCost) > 0) {
                products.push("Biaya Pengiriman");
                qtys.push("1");
                prices.push(String(Number(order.shippingCost)));
                descriptions.push("Biaya Pengiriman");
            }

            if (Number(order.discount) > 0 && order.voucherCode) {
                products.push(`Voucher ${order.voucherCode}`.substring(0, 50));
                qtys.push("1");
                prices.push(String(-Number(order.discount)));
                descriptions.push(`Voucher ${order.voucherCode}`.substring(0, 50));
            }

            const ipaymuResult = await createRedirectPayment({
                product: products,
                qty: qtys,
                price: prices,
                amount: Number(order.total),
                buyerName: (order.recipientName || "").substring(0, 50),
                buyerEmail: session.user.email ?? "",
                buyerPhone: (order.phone || "").substring(0, 20),
                paymentMethod: ipaymuMethod,
                paymentChannel: ipaymuChannel,
                notifyUrl: `${appUrl}/api/payment/ipaymu/notification`,
                returnUrl: `${appUrl}/checkout/payment-finish?payment=${encodeURIComponent(order.orderNumber)}`,
                cancelUrl: `${appUrl}/checkout/payment-finish?payment=${encodeURIComponent(order.orderNumber)}`,
                referenceId: order.orderNumber,
                description: descriptions,
                expired: 1,
            });

            if (ipaymuResult.Data?.Url) {
                return NextResponse.json({
                    success: true,
                    message: "Pembayaran ulang berhasil dibuat.",
                    data: {
                        orderId: result.orderId,
                        orderNumber: result.orderNumber,
                        grossAmount: result.grossAmount,
                        paymentMethod: result.paymentMethod,
                        gateway: "ipaymu",
                        redirectUrl: ipaymuResult.Data.Url,
                    },
                });
            }
        } catch (ipaymuError: any) {
            console.error("IPAYMU REPAYMENT CREATE FAILED:", ipaymuError);
            // Fall through — return generic response
        }

        // ==========================================
        // GENERIC RESPONSE (gateway creation failed)
        // ==========================================
        //
        // DB state has been reset successfully.
        // User can try again or contact support.

        return NextResponse.json({
            success: true,
            message: "Pembayaran ulang siap diproses. Silakan pilih metode pembayaran.",
            data: {
                orderId: result.orderId,
                orderNumber: result.orderNumber,
                grossAmount: result.grossAmount,
                paymentMethod: result.paymentMethod,
            },
        });
    } catch (error) {
        console.error("REPAY ORDER ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal memproses pembayaran ulang.",
            },
            { status: 500 }
        );
    }
}
