/**
 * ==========================================
 * WHATSAPP STATUS ENDPOINT
 * ==========================================
 *
 * GET /api/admin/whatsapp/status
 *
 * Returns safe WhatsApp connection status
 * to authenticated admin users.
 *
 * Response:
 * - status: connection status
 * - phoneNumber: connected phone (if any)
 * - connectedAt: when connected
 * - lastDisconnectedAt: when disconnected
 * - lastError: last error message
 * - reconnectAttempts: current attempt count
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWhatsAppService } from "@/lib/whatsapp/service";

export async function GET() {
    try {
        // ==========================================
        // AUTH CHECK
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
        // GET STATUS
        // ==========================================
        const service = getWhatsAppService();
        const status = service.getStatus();

        return NextResponse.json({
            success: true,
            data: {
                status: status.status,
                phoneNumber: status.phoneNumber,
                connectedAt: status.connectedAt
                    ? status.connectedAt.toISOString()
                    : null,
                lastDisconnectedAt:
                    status.lastDisconnectedAt
                        ? status.lastDisconnectedAt.toISOString()
                        : null,
                lastError: status.lastError,
                reconnectAttempts:
                    status.reconnectAttempts,
            },
        });
    } catch (error) {
        console.error(
            "GET WHATSAPP STATUS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil status WhatsApp.",
            },
            { status: 500 }
        );
    }
}
