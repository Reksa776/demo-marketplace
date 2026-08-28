import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRefundRequest } from "@/lib/refund";
import { rateLimiters } from "@/lib/rate-limit";

/* ==========================================
 * POST /api/orders/[id]/refund
 * ==========================================
 *
 * User-initiated refund request.
 *
 * Security:
 * - Authentication required
 * - Ownership check (userId matches order)
 * - Server-side refund amount (order.total from DB)
 * - Rate limited (3 per hour)
 * - Idempotent (unique orderId on Refund model)
 *
 * Flow:
 * 1. Verify ownership
 * 2. Check refund eligibility
 * 3. Create Refund record (PENDING)
 * 4. CAS: Order.status → REFUND_PENDING
 * 5. Admin will process the refund
 *
 * Amount is NEVER taken from client request.
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

        const rateLimit = rateLimiters.refundRequest(session.user.id);
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
        // PARSE REASON (optional)
        // ==========================================

        let reason: string | undefined;
        try {
            const body = await req.json();
            if (typeof body.reason === "string" && body.reason.trim()) {
                reason = body.reason.trim().substring(0, 500);
            }
        } catch {
            // Body is optional
        }

        // ==========================================
        // CREATE REFUND REQUEST
        // ==========================================
        //
        // Amount is SERVER-AUTHORITATIVE: order.total from DB.
        // Client cannot influence the refund amount.

        const result = await createRefundRequest(
            session.user.id,
            orderId,
            reason
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

        return NextResponse.json({
            success: true,
            message:
                "Permintaan refund berhasil diajukan. Admin akan memproses segera.",
            data: {
                refundId: result.refundId,
                status: "PENDING",
            },
        });
    } catch (error) {
        console.error("REFUND REQUEST ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengajukan permintaan refund.",
            },
            { status: 500 }
        );
    }
}
