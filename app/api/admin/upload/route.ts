import { NextResponse } from "next/server";
import { auth } from "@/auth";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unauthorized.",
                },
                {
                    status: 401,
                }
            );
        }

        const role = (session.user as any).role;

        if (role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Kamu tidak memiliki akses admin.",
                },
                {
                    status: 403,
                }
            );
        }

        /*
         * =====================================
         * FORM DATA
         * =====================================
         */

        const formData =
            await request.formData();

        const file =
            formData.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "File gambar wajib diupload.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * =====================================
         * VALIDATE TYPE
         * =====================================
         */

        const allowedTypes: Record<
            string,
            string
        > = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
        };

        const extension =
            allowedTypes[file.type];

        if (!extension) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Format gambar harus JPG, PNG, atau WEBP.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * =====================================
         * VALIDATE SIZE
         * =====================================
         */

        const maxSize =
            5 * 1024 * 1024;

        if (file.size > maxSize) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Ukuran gambar maksimal 5MB.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * =====================================
         * UPLOAD DIRECTORY
         * =====================================
         */

        const uploadDir =
            path.join(
                process.cwd(),
                "public",
                "uploads",
                "products"
            );

        await fs.mkdir(
            uploadDir,
            {
                recursive: true,
            }
        );

        /*
         * =====================================
         * UNIQUE FILE NAME
         * =====================================
         */

        const randomName =
            crypto
                .randomBytes(16)
                .toString("hex");

        const fileName =
            `${Date.now()}-${randomName}.${extension}`;

        const filePath =
            path.join(
                uploadDir,
                fileName
            );

        /*
         * =====================================
         * SAVE FILE
         * =====================================
         */

        const bytes =
            await file.arrayBuffer();

        const buffer =
            Buffer.from(bytes);

        await fs.writeFile(
            filePath,
            buffer
        );

        /*
         * =====================================
         * PUBLIC URL
         * =====================================
         */

        const url =
            `/uploads/products/${fileName}`;

        console.log(
            "========== LOCAL IMAGE UPLOAD =========="
        );

        console.log(
            "FILE:",
            fileName
        );

        console.log(
            "TYPE:",
            file.type
        );

        console.log(
            "SIZE:",
            file.size
        );

        console.log(
            "PATH:",
            filePath
        );

        console.log(
            "URL:",
            url
        );

        console.log(
            "========================================"
        );

        /*
         * =====================================
         * RESPONSE
         * =====================================
         */

        return NextResponse.json(
            {
                success: true,
                message:
                    "Gambar berhasil diupload.",
                url,
                fileName,
            },
            {
                status: 201,
            }
        );
    } catch (error) {
        console.error(
            "========== LOCAL IMAGE UPLOAD ERROR =========="
        );

        console.error(error);

        console.error(
            "==============================================="
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    error instanceof Error
                        ? error.message
                        : "Gagal mengupload gambar.",
            },
            {
                status: 500,
            }
        );
    }
}