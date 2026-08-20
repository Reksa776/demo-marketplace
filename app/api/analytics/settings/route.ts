import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const setting =
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
                    setting?.tiktokPixelId ??
                    null,
            },
        });
    } catch (error) {
        console.error(
            "GET ANALYTICS SETTINGS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil pengaturan analytics.",
            },
            {
                status: 500,
            }
        );
    }
}