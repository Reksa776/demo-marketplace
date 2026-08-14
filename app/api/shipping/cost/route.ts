import { NextResponse } from "next/server";

const RAJAONGKIR_BASE_URL =
    "https://rajaongkir.komerce.id/api/v1";

const API_KEY = process.env.RAJAONGKIR_API_KEY;

export async function POST(request: Request) {
    try {
        /*
         * ==========================================
         * API KEY
         * ==========================================
         */

        if (!API_KEY) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "RAJAONGKIR_API_KEY belum dikonfigurasi.",
                },
                {
                    status: 500,
                }
            );
        }

        /*
         * ==========================================
         * BODY
         * ==========================================
         */

        const body = await request.json();

        const {
            origin,
            destination,
            weight,
            courier = "jne:jnt:sicepat",
            price = "lowest",
        } = body;

        /*
         * ==========================================
         * VALIDATE ORIGIN
         * ==========================================
         */

        const originId = Number(origin);

        if (
            !Number.isInteger(originId) ||
            originId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Origin tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * VALIDATE DESTINATION
         * ==========================================
         */

        const destinationId = Number(destination);

        if (
            !Number.isInteger(destinationId) ||
            destinationId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Destination tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * VALIDATE WEIGHT
         * ==========================================
         */

        const packageWeight = Number(weight);

        if (
            !Number.isFinite(packageWeight) ||
            packageWeight <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Berat paket tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * RajaOngkir menggunakan gram.
         */

        const finalWeight = Math.ceil(packageWeight);

        /*
         * ==========================================
         * VALIDATE COURIER
         * ==========================================
         */

        if (
            typeof courier !== "string" ||
            !courier.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Courier tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * FORM DATA
         * ==========================================
         */

        const formData = new URLSearchParams();

        formData.append(
            "origin",
            String(originId)
        );

        formData.append(
            "destination",
            String(destinationId)
        );

        formData.append(
            "weight",
            String(finalWeight)
        );

        formData.append(
            "courier",
            courier
        );

        formData.append(
            "price",
            price
        );

        /*
         * ==========================================
         * REQUEST RAJAONGKIR
         * ==========================================
         */

        const response = await fetch(
            `${RAJAONGKIR_BASE_URL}/calculate/domestic-cost`,
            {
                method: "POST",

                headers: {
                    key: API_KEY,

                    "Content-Type":
                        "application/x-www-form-urlencoded",
                },

                body: formData,

                cache: "no-store",
            }
        );

        /*
         * ==========================================
         * PARSE RESPONSE
         * ==========================================
         */

        let result: any = null;

        try {
            result = await response.json();
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Response RajaOngkir tidak valid.",
                },
                {
                    status: 502,
                }
            );
        }

        /*
         * ==========================================
         * RAJAONGKIR ERROR
         * ==========================================
         */

        if (!response.ok) {
            return NextResponse.json(
                {
                    success: false,

                    message:
                        result?.meta?.message ||
                        result?.message ||
                        "Gagal menghitung ongkir.",

                    data: null,

                    meta: result?.meta ?? null,
                },
                {
                    status:
                        response.status >= 400 &&
                        response.status <= 599
                            ? response.status
                            : 502,
                }
            );
        }

        /*
         * ==========================================
         * NORMALIZE DATA
         * ==========================================
         */

        const shippingData = Array.isArray(
            result?.data
        )
            ? result.data
            : [];

        /*
         * ==========================================
         * RESPONSE
         * ==========================================
         */

        return NextResponse.json({
            success: true,

            data: shippingData,

            meta: result?.meta ?? null,
        });
    } catch (error) {
        console.error(
            "SHIPPING COST ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Gagal menghitung ongkir.",
            },
            {
                status: 500,
            }
        );
    }
}