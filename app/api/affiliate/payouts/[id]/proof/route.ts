import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

/* ==========================================
 * GET /api/affiliate/payouts/[id]/proof
 * ==========================================
 *
 * Serves payment proof for a specific payout.
 *
 * Security:
 *   - Authentication required
 *   - Affiliate can only view own payout proof
 *   - ADMIN can view any payout proof
 *   - Only serves file if payout is PAID
 *   - Path traversal protection
 */

const MIME_TYPES: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
};

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(
    request: NextRequest,
    { params }: RouteContext
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Unauthorized." },
                { status: 401 }
            );
        }

        const { id } = await params;
        const payoutId = Number(id);

        if (!Number.isInteger(payoutId) || payoutId <= 0) {
            return NextResponse.json(
                { success: false, message: "ID tidak valid." },
                { status: 400 }
            );
        }

        // Find payout
        const payout = await prisma.affiliatePayout.findUnique({
            where: { id: payoutId },
            select: {
                id: true,
                affiliateId: true,
                status: true,
                proofFilePath: true,
                paidAt: true,
                amount: true,
                affiliate: {
                    select: { userId: true },
                },
            },
        });

        if (!payout) {
            return NextResponse.json(
                { success: false, message: "Payout tidak ditemukan." },
                { status: 404 }
            );
        }

        // Ownership check: affiliate can only view own proof
        const isAdmin = session.user.role === "ADMIN";
        const isOwner = payout.affiliate.userId === session.user.id;

        if (!isAdmin && !isOwner) {
            return NextResponse.json(
                { success: false, message: "Forbidden." },
                { status: 403 }
            );
        }

        // Only serve proof for PAID payouts
        if (payout.status !== "PAID") {
            return NextResponse.json(
                { success: false, message: "Bukti pembayaran hanya tersedia untuk payout yang sudah PAID." },
                { status: 400 }
            );
        }

        if (!payout.proofFilePath) {
            return NextResponse.json(
                { success: false, message: "Tidak ada bukti pembayaran untuk payout ini." },
                { status: 404 }
            );
        }

        // Path traversal protection
        const resolvedPath = path.resolve(payout.proofFilePath);
        const storageDir = path.resolve("storage");

        if (!resolvedPath.startsWith(storageDir)) {
            return NextResponse.json(
                { success: false, message: "Path tidak valid." },
                { status: 400 }
            );
        }

        // Read and serve file
        const fileBuffer = await fs.readFile(resolvedPath);
        const ext = path.extname(resolvedPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "private, max-age=3600",
            },
        });
    } catch (error: any) {
        if (error.code === "ENOENT") {
            return NextResponse.json(
                { success: false, message: "File bukti tidak ditemukan." },
                { status: 404 }
            );
        }
        console.error("PAYMENT PROOF SERVE ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal mengambil bukti pembayaran." },
            { status: 500 }
        );
    }
}
