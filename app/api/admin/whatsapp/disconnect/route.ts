/**
 * ==========================================
 * WHATSAPP DISCONNECT ENDPOINT
 * ==========================================
 *
 * POST /api/admin/whatsapp/disconnect
 *
 * Gracefully disconnects WhatsApp.
 * Clears reconnect attempts.
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
        // DISCONNECT
        // ==========================================
        const service = getWhatsAppService();
        await service.disconnect();

        const status = service.getStatus();

        return NextResponse.json({
            success: true,
            message: "WhatsApp berhasil diputus.",
            data: {
                status: status.status,
            },
        });
    } catch (error) {
        console.error(
            "POST WHATSAPP DISCONNECT ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal memutus WhatsApp.",
            },
            { status: 500 }
        );
    }
}
