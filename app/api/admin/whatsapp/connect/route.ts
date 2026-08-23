/**
 * ==========================================
 * WHATSAPP CONNECT ENDPOINT
 * ==========================================
 *
 * POST /api/admin/whatsapp/connect
 *
 * Initiates WhatsApp connection.
 * If session exists, reconnects.
 * If no session, waits for QR pairing.
 *
 * Response:
 * - message: status message
 * - status: current connection status
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWhatsAppService } from "@/lib/whatsapp/service";

export async function POST() {
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
        // CONNECT
        // ==========================================
        const service = getWhatsAppService();
        const currentStatus = service.getStatus();

        if (
            currentStatus.status === "CONNECTED"
        ) {
            return NextResponse.json({
                success: true,
                message:
                    "WhatsApp sudah terhubung.",
                data: {
                    status: currentStatus.status,
                    phoneNumber:
                        currentStatus.phoneNumber,
                },
            });
        }

        // Initiate connection (non-blocking)
        // Fire-and-forget — don't await
        service.connect().catch((err) => {
            console.error(
                "[WHATSAPP] Connect error:",
                err
            );
        });

        // Return immediately
        return NextResponse.json({
            success: true,
            message:
                "WhatsApp connection started",
            data: {
                status: "CONNECTING",
            },
        });
    } catch (error) {
        console.error(
            "POST WHATSAPP CONNECT ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal menghubungkan WhatsApp.",
            },
            { status: 500 }
        );
    }
}
