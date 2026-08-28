import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { approveRefund, completeRefund, failRefund } from "@/lib/refund";

/* ==========================================
 * PATCH /api/admin/orders/[id]/refund
 * ==========================================
 *
 * Admin refund processing.
 *
 * Actions:
 * - approve: Mark refund as PROCESSING (admin approved)
 * - complete: Mark refund as COMPLETED (provider confirmed)
 * - reject: Mark refund as FAILED (admin or provider rejected)
 *
 * Security:
 * - Admin authorization required
 * - Server-side amount (refund.amount from DB)
 * - CAS on refund status
 * - Idempotent (status checks prevent double processing)
 *
 * NOTE: For actual provider refund API calls,
 * admin should use the Midtrans/iPaymu dashboard
 * or a separate endpoint that calls the provider API.
 */

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

export async function PATCH(
    req: Request,
    { params }: RouteContext
) {
    try {
        // ==========================================
        // AUTH + ADMIN CHECK
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

        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Akses ditolak.",
                },
                { status: 403 }
            );
        }

        // ==========================================
        // VALIDATE ORDER ID
        // ==========================================

        const { id } = await params;
        const orderId = Number(id);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "ID pesanan tidak valid.",
                },
                { status: 400 }
            );
        }

        // ==========================================
        // PARSE ACTION
        // ==========================================

        const body = await req.json();
        const { action, providerRef, reason } = body;

        if (!action || !["approve", "complete", "reject"].includes(action)) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        'Action harus salah satu dari: "approve", "complete", "reject".',
                },
                { status: 400 }
            );
        }

        // ==========================================
        // FIND REFUND FOR THIS ORDER
        // ==========================================

        const refund = await prisma.refund.findUnique({
            where: { orderId },
            select: {
                id: true,
                status: true,
                amount: true,
            },
        });

        if (!refund) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Refund tidak ditemukan untuk pesanan ini.",
                },
                { status: 404 }
            );
        }

        // ==========================================
        // PROCESS ACTION
        // ==========================================

        let result: { ok: boolean; reason?: string };

        switch (action) {
            case "approve":
                result = await approveRefund(refund.id, session.user.id);
                break;

            case "complete":
                result = await completeRefund(
                    refund.id,
                    providerRef || undefined
                );
                break;

            case "reject":
                result = await failRefund(
                    refund.id,
                    reason || "Ditolak oleh admin"
                );
                break;

            default:
                result = { ok: false, reason: "Action tidak valid." };
        }

        if (!result.ok) {
            return NextResponse.json(
                {
                    success: false,
                    message: result.reason || "Gagal memproses refund.",
                },
                { status: 400 }
            );
        }

        // ==========================================
        // RESPONSE
        // ==========================================

        const messages: Record<string, string> = {
            approve: "Refund berhasil disetujui.",
            complete: "Refund berhasil diselesaikan.",
            reject: "Refund berhasil ditolak.",
        };

        return NextResponse.json({
            success: true,
            message: messages[action],
        });
    } catch (error) {
        console.error("ADMIN REFUND PROCESS ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal memproses refund.",
            },
            { status: 500 }
        );
    }
}
