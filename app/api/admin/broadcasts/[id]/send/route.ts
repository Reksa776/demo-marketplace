import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendBroadcast } from "@/lib/marketing/broadcast";
import { rateLimiters } from "@/lib/rate-limit";

async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.id) return { error: NextResponse.json({ success: false, message: "Silakan login terlebih dahulu." }, { status: 401 }) };
    if ((session.user as any).role !== "ADMIN") return { error: NextResponse.json({ success: false, message: "Akses ditolak." }, { status: 403 }) };
    return { user: session.user };
}

/**
 * POST /api/admin/broadcasts/[id]/send
 *
 * Triggers broadcast delivery to all audience members.
 * Uses atomic CAS to prevent concurrent sends of the same broadcast.
 */
export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await requireAdmin();
        if ("error" in admin) return admin.error;

        // Rate limiting
        const rateLimit = rateLimiters.broadcastSend(admin.user.id!);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, message: "Terlalu banyak permintaan. Coba lagi nanti." },
                { status: 429 }
            );
        }

        const { id } = await params;
        const broadcastId = Number(id);

        if (!Number.isInteger(broadcastId) || broadcastId <= 0) {
            return NextResponse.json(
                { success: false, message: "ID broadcast tidak valid." },
                { status: 400 }
            );
        }

        const result = await sendBroadcast(broadcastId);

        return NextResponse.json({
            success: true,
            message: `Broadcast berhasil dikirim. ${result.sentCount} pesan terkirim, ${result.failedCount} gagal dari ${result.total} target.`,
            data: result,
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, message: "Gagal mengirim broadcast." },
            { status: 500 }
        );
    }
}
