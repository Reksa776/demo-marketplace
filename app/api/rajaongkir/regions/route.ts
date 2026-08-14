import { NextRequest, NextResponse } from "next/server";

const RAJAONGKIR_BASE_URL =
    "https://rajaongkir.komerce.id/api/v1";

const API_KEY = process.env.RAJAONGKIR_API_KEY;

export async function GET(request: NextRequest) {
    try {
        if (!API_KEY) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "RAJAONGKIR_API_KEY belum dikonfigurasi.",
                },
                { status: 500 }
            );
        }

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
                    `${RAJAONGKIR_BASE_URL}/destination/province`;
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
                    `${RAJAONGKIR_BASE_URL}/destination/city/${encodeURIComponent(
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
                    `${RAJAONGKIR_BASE_URL}/destination/district/${encodeURIComponent(
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
                    `${RAJAONGKIR_BASE_URL}/destination/sub-district/${encodeURIComponent(
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

        const response = await fetch(
            endpoint,
            {
                method: "GET",
                headers: {
                    key: API_KEY,
                },
                cache: "no-store",
            }
        );

        const result =
            await response.json();

        if (!response.ok) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        result?.meta?.message ||
                        "Gagal mengambil data wilayah RajaOngkir.",
                },
                {
                    status: response.status,
                }
            );
        }

        return NextResponse.json({
            success: true,
            data: result?.data ?? [],
        });
    } catch (error) {
        console.error(
            "RAJAONGKIR REGION ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil data wilayah.",
            },
            { status: 500 }
        );
    }
}