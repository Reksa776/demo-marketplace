import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { processRepayment } from "@/lib/repay";
import { rateLimiters } from "@/lib/rate-limit";

/* ==========================================
 * POST /api/orders/[id]/repay
 * ==========================================
 *
 * Repayment / Bayar Lagi.
 *
 * Allows user to retry payment for an order that:
 * - paymentStatus = FAILED (auto-cancelled after failure)
 * - paymentStatus = EXPIRED (auto-cancelled after expiry)
 * - paymentStatus = PENDING + status = PENDING (still awaiting)
 *
 * Does NOT create a new order. Reuses existing order.
 * Amount is SERVER-AUTHORITATIVE (order.total from DB).
 *
 * After CAS reset, caller must create Midtrans snap token
 * or iPaymu redirect payment externally.
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
        // PROCESS REPAYMENT
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
        // RESPONSE
        // ==========================================
        //
        // The caller (frontend) must now:
        // 1. Call Midtrans snap.createTransaction() or
        //    iPaymu createRedirectPayment() using the
        //    returned orderNumber and grossAmount.
        // 2. Return the token/paymentUrl to the user.
        //
        // This endpoint only handles the DB state transition.
        // Payment provider integration happens on the frontend
        // or a separate endpoint.

        return NextResponse.json({
            success: true,
            message: "Pembayaran ulang siap diproses.",
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
