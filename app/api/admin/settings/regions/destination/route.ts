import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rajaOngkirFetch } from "@/lib/rajaongkir";

export async function GET(
    request: Request
) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json(
                {
                    message: "Unauthorized",
                },
                { status: 401 }
            );
        }

        if ((session.user as any).role !== "ADMIN") {
            return NextResponse.json(
                {
                    message: "Forbidden",
                },
                { status: 403 }
            );
        }

        const { searchParams } =
            new URL(request.url);

        const subdistrictId =
            searchParams.get(
                "subdistrictId"
            );

        if (!subdistrictId) {
            return NextResponse.json(
                {
                    message:
                        "subdistrictId wajib diisi.",
                },
                { status: 400 }
            );
        }

        /*
         * Kita tetap menggunakan API RajaOngkir.
         * Jangan mengubah endpoint region yang
         * sekarang sudah berjalan.
         */

        const data =
            await rajaOngkirFetch(
                `/destination/domestic-destination/${subdistrictId}`,
                {
                    method: "GET",
                }
            );

        return NextResponse.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error(
            "DESTINATION ERROR:",
            error
        );

        return NextResponse.json(
            {
                message:
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil destination RajaOngkir.",
            },
            { status: 500 }
        );
    }
}