/**
 * ==========================================
 * WHATSAPP QR ENDPOINT
 * ==========================================
 *
 * GET /api/admin/whatsapp/qr
 *
 * Returns the current QR code from the
 * WhatsAppService singleton. The QR is only
 * available when Baileys is in CONNECTING
 * state and has received a QR from WhatsApp.
 *
 * Response:
 * - qr: string | null (raw QR data string)
 * - status: current connection status
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
        // GET QR FROM SINGLETON
        // ==========================================
        const service = getWhatsAppService();
        const status = service.getStatus();
        const qr = service.getQrCode();

        return NextResponse.json({
            success: true,
            qr,
            status: {
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
                reconnectAttempts: status.reconnectAttempts,
            },
        });
    } catch (error) {
        console.error(
            "GET WHATSAPP QR ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil QR code.",
            },
            { status: 500 }
        );
    }
}