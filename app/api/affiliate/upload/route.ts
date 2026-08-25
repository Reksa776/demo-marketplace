import { NextResponse } from "next/server";
import { auth } from "@/auth";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";

/* ==========================================
 * POST /api/affiliate/upload
 * ==========================================
 *
 * Customer-facing file upload for affiliate
 * application documents (KTP, social media).
 *
 * Uses local filesystem storage.
 *
 * Storage paths:
 *   - KTP: storage/uploads/affiliate/ktp/{userId}/{random}.ext
 *   - Social: storage/uploads/affiliate/social/{userId}/{random}.ext
 *
 * Returns URL like:
 *   /api/uploads/affiliate/ktp/{userId}/{filename}
 *
 * Security:
 *   - Auth required (customer)
 *   - userId from session only
 *   - MIME type validated
 *   - Extension validated
 *   - File size limit (5MB)
 *   - Random filename (no user-controlled names)
 *   - Ownership embedded in path
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_TYPES: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};

const ALLOWED_EXTENSIONS: Record<string, boolean> = {
    ".jpg": true,
    ".jpeg": true,
    ".png": true,
    ".webp": true,
};

function getExtension(filename: string): string {
    const idx = filename.lastIndexOf(".");
    if (idx === -1) return "";
    return filename.slice(idx).toLowerCase();
}

export async function POST(request: Request) {
    try {
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

        const userId = session.user.id;

        /* ==========================================
         * PARSE FORM DATA
         * ========================================== */

        let formData: FormData;

        try {
            formData = await request.formData();
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Gagal membaca form data.",
                },
                { status: 400 }
            );
        }

        const file = formData.get("file") as File | null;
        const type =
            (formData.get("type") as string) ||
            "ktp";

        if (!file || !(file instanceof File)) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "File tidak ditemukan.",
                },
                { status: 400 }
            );
        }

        /* ==========================================
         * VALIDATE FILE TYPE PARAMETER
         * ========================================== */

        const safeType =
            type === "social" ? "social" : "ktp";

        /* ==========================================
         * VALIDATE FILE SIZE
         * ========================================== */

        if (file.size === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "File kosong.",
                },
                { status: 400 }
            );
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Ukuran file maksimal 5MB.",
                },
                { status: 400 }
            );
        }

        /* ==========================================
         * VALIDATE MIME TYPE
         * ========================================== */

        const extension =
            ALLOWED_TYPES[file.type];

        if (!extension) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Format gambar harus JPG, PNG, atau WEBP.",
                },
                { status: 400 }
            );
        }

        /* ==========================================
         * VALIDATE EXTENSION
         * ========================================== */

        const filename =
            file.name || "upload.jpg";
        const ext = getExtension(filename);

        if (!ALLOWED_EXTENSIONS[ext]) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Ekstensi file tidak valid.",
                },
                { status: 400 }
            );
        }

        /* ==========================================
         * DETERMINE UPLOAD DIRECTORY
         * ==========================================
         *
         * Path: storage/uploads/affiliate/{type}/{userId}/
         *
         * Files are named:
         *   {timestamp}-{random}.{ext}
         */

        const uploadDir = process.env.UPLOAD_DIR
            ? path.join(
                  process.env.UPLOAD_DIR,
                  "affiliate",
                  safeType,
                  userId
              )
            : path.join(
                  process.cwd(),
                  "storage",
                  "uploads",
                  "affiliate",
                  safeType,
                  userId
              );

        await fs.mkdir(uploadDir, {
            recursive: true,
        });

        /* ==========================================
         * GENERATE RANDOM FILENAME
         * ========================================== */

        const randomName = crypto
            .randomBytes(16)
            .toString("hex");

        const fileName = `${Date.now()}-${randomName}.${extension}`;

        const filePath = path.join(
            uploadDir,
            fileName
        );

        /* ==========================================
         * WRITE FILE
         * ========================================== */

        const bytes =
            await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        await fs.writeFile(filePath, buffer);

        /* ==========================================
         * BUILD URL
         * ==========================================
         *
         * URL format:
         *   /api/uploads/affiliate/{type}/{userId}/{filename}
         *
         * This URL is used by the serving endpoint
         * to read and return the file with
         * ownership validation.
         */

        const url = `/api/uploads/affiliate/${safeType}/${userId}/${fileName}`;

        console.log(
            `AFFILIATE_UPLOAD: User ${userId} uploaded ${safeType} → ${fileName}`
        );

        return NextResponse.json(
            {
                success: true,
                message:
                    "File berhasil diupload.",
                data: {
                    url,
                    fileName,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            "AFFILIATE UPLOAD ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengupload file.",
            },
            { status: 500 }
        );
    }
}
