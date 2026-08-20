import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["ADMIN", "SELLER"] as const;

function isAllowedRole(
    role: string | undefined
) {
    return ALLOWED_ROLES.includes(
        role as (typeof ALLOWED_ROLES)[number]
    );
}

function normalizePixelId(
    value: unknown
) {
    if (typeof value !== "string") {
        return null;
    }

    const pixelId = value.trim();

    if (!pixelId) {
        return null;
    }

    /*
     * TikTok Pixel ID umumnya berupa
     * kombinasi huruf dan angka.
     *
     * Kita sengaja tidak menerima HTML,
     * script, spasi, atau karakter aneh.
     */

    if (
        !/^[A-Za-z0-9_-]+$/.test(
            pixelId
        )
    ) {
        return null;
    }

    /*
     * Batas keamanan sederhana.
     */

    if (pixelId.length > 100) {
        return null;
    }

    return pixelId;
}

/*
 * ==========================================
 * GET
 * ==========================================
 *
 * Mengambil setting marketing.
 *
 * ADMIN / SELLER boleh.
 */

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

        if (
            !isAllowedRole(
                session.user.role
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Forbidden.",
                },
                {
                    status: 403,
                }
            );
        }

        const setting =
            await prisma.storeSetting.findUnique(
                {
                    where: {
                        id: 1,
                    },

                    select: {
                        id: true,
                        tiktokPixelId: true,
                    },
                }
            );

        return NextResponse.json({
            success: true,

            data: {
                tiktokPixelId:
                    setting?.tiktokPixelId ??
                    null,
            },
        });
    } catch (error) {
        console.error(
            "GET MARKETING SETTINGS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil pengaturan marketing.",
            },
            {
                status: 500,
            }
        );
    }
}

/*
 * ==========================================
 * PUT
 * ==========================================
 *
 * Menyimpan setting marketing.
 *
 * ADMIN / SELLER boleh.
 */

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

        if (
            !isAllowedRole(
                session.user.role
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Forbidden.",
                },
                {
                    status: 403,
                }
            );
        }

        let body: unknown;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Body request tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !body ||
            typeof body !== "object"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Body request tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        const rawPixelId =
            (
                body as {
                    tiktokPixelId?: unknown;
                }
            ).tiktokPixelId;

        /*
         * String kosong = hapus Pixel.
         */

        let tiktokPixelId: string | null =
            null;

        if (
            rawPixelId !== undefined &&
            rawPixelId !== null
        ) {
            if (
                typeof rawPixelId !==
                "string"
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "TikTok Pixel ID harus berupa teks.",
                    },
                    {
                        status: 400,
                    }
                );
            }

            if (
                rawPixelId.trim() !== ""
            ) {
                tiktokPixelId =
                    normalizePixelId(
                        rawPixelId
                    );

                if (!tiktokPixelId) {
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
        }

        /*
         * StoreSetting adalah singleton
         * dengan id = 1.
         *
         * update jika sudah ada,
         * create jika belum ada.
         */

        const setting =
            await prisma.storeSetting.upsert(
                {
                    where: {
                        id: 1,
                    },

                    update: {
                        tiktokPixelId,
                    },

                    create: {
                        id: 1,

                        storeName:
                            "Store",

                        address: "",

                        tiktokPixelId,
                    },

                    select: {
                        id: true,
                        tiktokPixelId: true,
                    },
                }
            );

        return NextResponse.json({
            success: true,

            message:
                tiktokPixelId
                    ? "TikTok Pixel berhasil disimpan."
                    : "TikTok Pixel berhasil dihapus.",

            data: {
                tiktokPixelId:
                    setting.tiktokPixelId,
            },
        });
    } catch (error) {
        console.error(
            "UPDATE MARKETING SETTINGS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal menyimpan pengaturan marketing.",
            },
            {
                status: 500,
            }
        );
    }
}