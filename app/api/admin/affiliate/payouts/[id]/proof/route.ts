import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/admin/audit-log";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";

/* ==========================================
 * POST /api/admin/affiliate/payouts/[id]/proof
 * ==========================================
 *
 * Upload payment proof for a payout.
 * Only ADMIN can upload.
 * Only for PROCESSING or PAID payouts.
 *
 * Body: multipart/form-data with "file" field
 *
 * Saves to: storage/uploads/affiliate/payout-proof/{payoutId}/{random}.{ext}
 */

type RouteContext = {
    params: Promise<{ id: string }>;
};

const ALLOWED_TYPES: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
};

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(
    request: Request,
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

        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                { success: false, message: "Forbidden." },
                { status: 403 }
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

        // Check payout exists and is in valid state
        const payout = await prisma.affiliatePayout.findUnique({
            where: { id: payoutId },
            select: { id: true, status: true },
        });

        if (!payout) {
            return NextResponse.json(
                { success: false, message: "Payout tidak ditemukan." },
                { status: 404 }
            );
        }

        if (payout.status !== "PROCESSING" && payout.status !== "PAID") {
            return NextResponse.json(
                { success: false, message: "Upload bukti hanya dapat dilakukan pada payout PROCESSING atau PAID." },
                { status: 400 }
            );
        }

        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json(
                { success: false, message: "File wajib diupload." },
                { status: 400 }
            );
        }

        // Validate file type
        const ext = ALLOWED_TYPES[file.type];
        if (!ext) {
            return NextResponse.json(
                { success: false, message: "Tipe file tidak didukung. Gunakan JPG, PNG, WebP, atau PDF." },
                { status: 400 }
            );
        }

        // Validate file size
        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { success: false, message: "Ukuran file maksimal 5MB." },
                { status: 400 }
            );
        }

        // LOW-3 FIX: Validate magic bytes to prevent spoofed file types
        const buffer = Buffer.from(await file.arrayBuffer());

        if (buffer.length < 4) {
            return NextResponse.json(
                { success: false, message: "File terlalu kecil." },
                { status: 400 }
            );
        }

        const isValidJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        const isValidPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
        const isValidWebp = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
        const isValidPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

        if (!isValidJpeg && !isValidPng && !isValidWebp && !isValidPdf) {
            return NextResponse.json(
                { success: false, message: "File bukan format yang valid (JPEG/PNG/WebP/PDF)." },
                { status: 400 }
            );
        }

        // Save file
        const uploadDir = path.join(
            process.cwd(),
            "storage",
            "uploads",
            "affiliate",
            "payout-proof",
            String(payoutId)
        );

        await fs.mkdir(uploadDir, { recursive: true });

        const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
        const filePath = path.join(uploadDir, filename);

        await fs.writeFile(filePath, buffer);

        const relativePath = path.relative(process.cwd(), filePath);

        // Update payout with proof path
        await prisma.affiliatePayout.update({
            where: { id: payoutId },
            data: { proofFilePath: relativePath },
        });

        await createAuditLog({
            adminId: session.user.id,
            action: "PAYMENT_PROOF_UPLOADED",
            entityType: "AffiliatePayout",
            entityId: payoutId,
            description: `Payment proof uploaded: ${filename}`,
            metadata: { proofFilePath: relativePath, filename },
        });

        return NextResponse.json({
            success: true,
            message: "Bukti pembayaran berhasil diupload.",
            data: { proofFilePath: relativePath },
        });
    } catch (error: any) {
        console.error("UPLOAD PROOF ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal upload bukti." },
            { status: 500 }
        );
    }
}
