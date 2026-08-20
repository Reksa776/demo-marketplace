import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["ADMIN", "SELLER"] as const;

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
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

        const user =
            await prisma.user.findUnique({
                where: {
                    id: session.user.id,
                },
                select: {
                    role: true,
                },
            });

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User tidak ditemukan.",
                },
                {
                    status: 404,
                }
            );
        }

        if (
            !ALLOWED_ROLES.includes(
                user.role as any
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Akses ditolak.",
                },
                {
                    status: 403,
                }
            );
        }

        const settings =
            await prisma.storeSetting.findUnique({
                where: {
                    id: 1,
                },
                select: {
                    tiktokPixelId: true,
                },
            });

        return NextResponse.json({
            success: true,
            data: {
                tiktokPixelId:
                    settings?.tiktokPixelId ?? "",
            },
        });
    } catch (error) {
        console.error(
            "GET TRACKING SETTINGS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil pengaturan tracking.",
            },
            {
                status: 500,
            }
        );
    }
}

export async function PUT(
    request: Request
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
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

        const user =
            await prisma.user.findUnique({
                where: {
                    id: session.user.id,
                },
                select: {
                    role: true,
                },
            });

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User tidak ditemukan.",
                },
                {
                    status: 404,
                }
            );
        }

        if (
            !ALLOWED_ROLES.includes(
                user.role as any
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Akses ditolak.",
                },
                {
                    status: 403,
                }
            );
        }

        const body = await request.json();

        let tiktokPixelId =
            typeof body.tiktokPixelId ===
            "string"
                ? body.tiktokPixelId.trim()
                : "";

        /*
         * Pixel ID TikTok biasanya berupa
         * kombinasi huruf dan angka.
         *
         * Kita batasi supaya tidak ada
         * script/HTML yang ikut masuk database.
         */

        if (tiktokPixelId) {
            if (
                tiktokPixelId.length > 100 ||
                !/^[A-Za-z0-9_-]+$/.test(
                    tiktokPixelId
                )
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "TikTok Pixel ID tidak valid.",
                    },
                    {
                        status: 400,
                    }
                );
            }
        }

        const settings =
            await prisma.storeSetting.update({
                where: {
                    id: 1,
                },
                data: {
                    tiktokPixelId:
                        tiktokPixelId ||
                        null,
                },
                select: {
                    tiktokPixelId: true,
                },
            });

        return NextResponse.json({
            success: true,
            message:
                "TikTok Pixel berhasil disimpan.",
            data: {
                tiktokPixelId:
                    settings.tiktokPixelId ?? "",
            },
        });
    } catch (error) {
        console.error(
            "UPDATE TRACKING SETTINGS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal menyimpan TikTok Pixel.",
            },
            {
                status: 500,
            }
        );
    }
}