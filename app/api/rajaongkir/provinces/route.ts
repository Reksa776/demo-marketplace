import { NextResponse } from "next/server";
import { rajaOngkirFetch } from "@/lib/rajaongkir";

export async function GET() {
    try {
        const data = await rajaOngkirFetch(
            "/destination/province"
        );

        return NextResponse.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error(
            "RAJAONGKIR PROVINCES ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengambil provinsi.",
            },
            {
                status: 500,
            }
        );
    }
}