import { NextRequest, NextResponse } from "next/server";
import { rajaOngkirFetch } from "@/lib/rajaongkir";

export async function GET(
    request: NextRequest
) {
    try {
        const cityId =
            request.nextUrl.searchParams.get(
                "cityId"
            );

        if (!cityId) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "cityId wajib diisi.",
                },
                {
                    status: 400,
                }
            );
        }

        const data =
            await rajaOngkirFetch(
                `/destination/district/${cityId}`
            );

        return NextResponse.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error(
            "RAJAONGKIR DISTRICTS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil kecamatan.",
            },
            {
                status: 500,
            }
        );
    }
}