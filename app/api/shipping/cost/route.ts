import { NextResponse } from "next/server";

const RAJAONGKIR_BASE_URL =
    "https://rajaongkir.komerce.id/api/v1";

/*
 * ==========================================
 * TYPE
 * ==========================================
 */

type RajaOngkirShipping = {
    name?: string;   // nama kurir, misal "SiCepat Express"
    code?: string;   // kode kurir, misal "sicepat"
    service?: string;
    description?: string;
    cost?: number;
    etd?: string;
};

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
 * RAW SHIPPING DATA
 * ==========================================
 */

        const rawData: RajaOngkirShipping[] = Array.isArray(result?.data)
            ? result.data
            : [];

        /*
         * ==========================================
         * FILTER SERVICE
         * ==========================================
         *
         * Paket biasa jangan menampilkan
         * layanan cargo/bulky (JTR, JTR<130, JTR>130, JTR>200, dst).
         */

        const shippingData = rawData
            .filter((item) => {
                const service = String(item.service ?? "").trim().toUpperCase();

                if (service.startsWith("JTR")) {
                    return false;
                }

                const cost = Number(item.cost);
                if (!Number.isFinite(cost) || cost < 0) {
                    return false;
                }

                return true;
            })
            .map((item) => ({
                courier: item.code ?? "",
                courierName: item.name ?? "",
                service: item.service ?? "",
                description: item.description ?? "",
                cost: Number(item.cost),
                etd: item.etd ?? "",
            }));

        /*
         * ==========================================
         * REMOVE DUPLICATE
         * ==========================================
         */

        const uniqueShipping = Array.from(
            new Map(
                shippingData.map((item) => [
                    [item.courier, item.service, item.cost].join("|"),
                    item,
                ])
            ).values()
        );

        /*
         * ==========================================
         * SORT
         * ==========================================
         *
         * Kurir dulu, kemudian harga termurah.
         */

        uniqueShipping.sort((a, b) => {
            const courierCompare = a.courier.localeCompare(b.courier);

            if (courierCompare !== 0) {
                return courierCompare;
            }

            return a.cost - b.cost;
        });

        /*
         * ==========================================
         * RESPONSE
         * ==========================================
         */

        return NextResponse.json({
            success: true,

            data: uniqueShipping,

            meta: result?.meta ?? null,

            weight: finalWeight,
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