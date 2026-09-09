import { NextRequest, NextResponse } from "next/server";
import { rajaOngkirFetch } from "@/lib/rajaongkir";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } =
            new URL(request.url);

        const type =
            searchParams.get("type");

        const id =
            searchParams.get("id");

        let endpoint = "";

        switch (type) {
            case "province":
                endpoint =
                    "/destination/province";
                break;

            case "city":
                if (!id) {
                    return NextResponse.json(
                        {
                            success: false,
                            message:
                                "Province ID wajib diisi.",
                        },
                        { status: 400 }
                    );
                }

                endpoint =
                    `/destination/city/${encodeURIComponent(
                        id
                    )}`;
                break;

            case "district":
                if (!id) {
                    return NextResponse.json(
                        {
                            success: false,
                            message:
                                "City ID wajib diisi.",
                        },
                        { status: 400 }
                    );
                }

                endpoint =
                    `/destination/district/${encodeURIComponent(
                        id
                    )}`;
                break;

            case "subdistrict":
                if (!id) {
                    return NextResponse.json(
                        {
                            success: false,
                            message:
                                "District ID wajib diisi.",
                        },
                        { status: 400 }
                    );
                }

                endpoint =
                    `/destination/sub-district/${encodeURIComponent(
                        id
                    )}`;
                break;

            default:
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Type wilayah tidak valid.",
                    },
                    { status: 400 }
                );
        }

        const result = await rajaOngkirFetch<unknown>(endpoint, {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
        });

        return NextResponse.json({
            success: true,
            data: result ?? [],
        });
    } catch (error) {
        console.error(
            "RAJAONGKIR REGION ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengambil data wilayah.",
            },
            { status: 500 }
        );
    }
}