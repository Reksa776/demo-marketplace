/**
 * ==========================================
 * WHATSAPP TEST MESSAGE ENDPOINT
 * ==========================================
 *
 * POST /api/admin/whatsapp/test
 *
 * Sends a test WhatsApp message.
 * Requires admin auth and connected state.
 *
 * Rate limiting: max 5 messages per minute.
 *
 * Body:
 * - recipient: phone number to send to
 * - message: custom message (optional)
 *
 * Response:
 * - success: boolean
 * - result: send result
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWhatsAppService } from "@/lib/whatsapp/service";
import {
    normalizePhone,
    normalizePhoneToJid,
    isValidIndonesianPhone,
} from "@/lib/whatsapp/phone";
import { generateTestMessage } from "@/lib/whatsapp/message";

// ==========================================
// RATE LIMITING
// ==========================================
// Simple in-memory rate limiter.
// Max 5 test messages per minute per IP.

const rateLimitMap = new Map<
    string,
    { count: number; resetAt: number }
>();

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5;

function checkRateLimit(
    key: string
): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, {
            count: 1,
            resetAt: now + RATE_LIMIT_WINDOW_MS,
        });
        return {
            allowed: true,
            retryAfterMs: 0,
        };
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        return {
            allowed: false,
            retryAfterMs: entry.resetAt - now,
        };
    }

    entry.count++;
    return { allowed: true, retryAfterMs: 0 };
}

// ==========================================
// MAX MESSAGE LENGTH
// ==========================================
const MAX_MESSAGE_LENGTH = 4096;

export async function POST(request: Request) {
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
        // RATE LIMITING
        // ==========================================
        const clientId = session.user.id;
        const rateCheck = checkRateLimit(clientId);

        if (!rateCheck.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(rateCheck.retryAfterMs / 1000)} detik.`,
                },
                { status: 429 }
            );
        }

        // ==========================================
        // PARSE BODY
        // ==========================================
        const body = await request.json();
        const { recipient, message } = body;

        // Validate recipient
        if (
            !recipient ||
            typeof recipient !== "string"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nomor telepon wajib diisi.",
                },
                { status: 400 }
            );
        }

        if (!isValidIndonesianPhone(recipient)) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nomor telepon tidak valid. Gunakan format: 08xxxxxxxx, +62xxxxxxxx, atau 62xxxxxxxx.",
                },
                { status: 400 }
            );
        }

        // Validate message length
        const messageText =
            message && typeof message === "string"
                ? message.trim()
                : generateTestMessage();

        if (messageText.length > MAX_MESSAGE_LENGTH) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Pesan terlalu panjang. Maksimal ${MAX_MESSAGE_LENGTH} karakter.`,
                },
                { status: 400 }
            );
        }

        // ==========================================
        // CHECK CONNECTION
        // ==========================================
        const service = getWhatsAppService();
        const status = service.getStatus();

        if (status.status !== "CONNECTED") {
            return NextResponse.json(
                {
                    success: false,
                    message: `WhatsApp tidak terhubung. Status: ${status.status}`,
                },
                { status: 400 }
            );
        }

        // ==========================================
        // NORMALIZE AND SEND
        // ==========================================
        const jid = normalizePhoneToJid(recipient);

        if (!jid) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Gagal memproses nomor telepon.",
                },
                { status: 400 }
            );
        }

        const result = await service.sendMessage(
            jid,
            messageText
        );

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: "Pesan test berhasil dikirim.",
                data: {
                    messageId: result.messageId,
                    recipient: normalizePhone(
                        recipient
                    ),
                },
            });
        } else {
            return NextResponse.json(
                {
                    success: false,
                    message: `Gagal mengirim pesan: ${result.errorMessage}`,
                    data: {
                        errorCode:
                            result.errorCode,
                    },
                },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error(
            "POST WHATSAPP TEST ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengirim pesan test.",
            },
            { status: 500 }
        );
    }
}
