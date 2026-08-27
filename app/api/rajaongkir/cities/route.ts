import { NextRequest, NextResponse } from "next/server";
import { rajaOngkirFetch } from "@/lib/rajaongkir";

export async function GET(
    request: NextRequest
) {
    try {
        const provinceId =
            request.nextUrl.searchParams.get(
                "provinceId"
            );

        if (!provinceId) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "provinceId wajib diisi.",
                },
                {
                    status: 400,
                }
            );
        }

        const data =
            await rajaOngkirFetch(
                `/destination/city/${provinceId}`
            );

        return NextResponse.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error(
            "RAJAONGKIR CITIES ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengambil kota.",
            },
            {
                status: 500,
            }
        );
    }
}