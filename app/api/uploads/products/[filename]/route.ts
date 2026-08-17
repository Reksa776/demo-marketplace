import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const MIME_TYPES: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    const { filename } = await params;

    const safeName = path.basename(filename);

    const uploadDir =
        process.env.UPLOAD_DIR
            ? path.join(process.env.UPLOAD_DIR, "products")
            : path.join(process.cwd(), "storage", "uploads", "products");

    const filePath = path.join(uploadDir, safeName);

    try {
        const fileBuffer = await fs.readFile(filePath);
        const ext = path.extname(safeName).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error) {
        return NextResponse.json(
            { success: false, message: "Gambar tidak ditemukan." },
            { status: 404 }
        );
    }
}
