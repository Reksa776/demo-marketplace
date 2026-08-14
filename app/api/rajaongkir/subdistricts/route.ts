import { NextRequest, NextResponse } from "next/server";
import { rajaOngkirFetch } from "@/lib/rajaongkir";

type Subdistrict = {
    id: number;
    name: string;
    zip_code?: string;
};

export async function GET(
    request: NextRequest
) {
    try {
        const districtId =
            request.nextUrl.searchParams.get(
                "districtId"
            );

        if (!districtId) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "districtId wajib diisi.",
                },
                {
                    status: 400,
                }
            );
        }

        const data =
            await rajaOngkirFetch<Subdistrict[]>(
                `/destination/sub-district/${districtId}`
            );

        return NextResponse.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error(
            "RAJAONGKIR SUBDISTRICTS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil kelurahan.",
            },
            {
                status: 500,
            }
        );
    }
}