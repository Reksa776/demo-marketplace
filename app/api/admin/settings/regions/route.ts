import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { rajaOngkirFetch } from "@/lib/rajaongkir";

async function checkAdmin() {
    const session = await auth();

    if (!session?.user) {
        return false;
    }

    const role = (session.user as any).role;

    return role === "ADMIN";
}

export async function GET(request: NextRequest) {
    try {
        const isAdmin = await checkAdmin();

        if (!isAdmin) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unauthorized.",
                },
                { status: 401 }
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
            case "provinces":
                endpoint = "/destination/province";
                break;

            case "cities":
                if (!id) {
                    return NextResponse.json(
                        {
                            success: false,
                            message:
                                "provinceId wajib diisi.",
                        },
                        { status: 400 }
                    );
                }

                endpoint = `/destination/city/${id}`;
                break;

            case "districts":
                if (!id) {
                    return NextResponse.json(
                        {
                            success: false,
                            message:
                                "cityId wajib diisi.",
                        },
                        { status: 400 }
                    );
                }

                endpoint = `/destination/district/${id}`;
                break;

            case "subdistricts":
                if (!id) {
                    return NextResponse.json(
                        {
                            success: false,
                            message:
                                "districtId wajib diisi.",
                        },
                        { status: 400 }
                    );
                }

                endpoint =
                    `/destination/sub-district/${id}`;
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

        const data =
            await rajaOngkirFetch(endpoint);

        return NextResponse.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error(
            "REGION API ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil data wilayah.",
            },
            { status: 500 }
        );
    }
}