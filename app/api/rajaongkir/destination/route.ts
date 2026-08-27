import { NextResponse } from "next/server";

type RajaOngkirDestination = {
    id: number;

    label?: string;

    province_name?: string;
    city_name?: string;
    district_name?: string;
    subdistrict_name?: string;

    zip_code?: string;
};

function normalize(value: unknown): string {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function isSame(
    a: unknown,
    b: unknown
): boolean {
    return normalize(a) === normalize(b);
}

export async function GET(request: Request) {
    try {
        const { searchParams } =
            new URL(request.url);

        const provinceId =
            searchParams.get("provinceId")?.trim();

        const cityId =
            searchParams.get("cityId")?.trim();

        const districtId =
            searchParams.get("districtId")?.trim();

        const subdistrictId =
            searchParams.get("subdistrictId")?.trim();

        const province =
            searchParams.get("province")?.trim();

        const city =
            searchParams.get("city")?.trim();

        const district =
            searchParams.get("district")?.trim();

        const subdistrict =
            searchParams.get("subdistrict")?.trim();

        const postalCode =
            searchParams.get("postalCode")?.trim();

        /*
         * ==========================================
         * VALIDASI ID
         * ==========================================
         */

        if (
            !provinceId ||
            !cityId ||
            !districtId ||
            !subdistrictId
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Data wilayah belum lengkap.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * VALIDASI NAMA WILAYAH
         * ==========================================
         *
         * Karena RajaOngkir domestic-destination
         * menggunakan parameter `search`, kita
         * harus mengirim nama lokasi.
         */

        if (
            !province ||
            !city ||
            !district ||
            !subdistrict
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nama provinsi, kota, kecamatan, dan kelurahan wajib dikirim.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * API KEY
         * ==========================================
         */

        const apiKey =
            process.env.RAJAONGKIR_API_KEY;

        if (!apiKey) {
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
         * SEARCH TERM
         * ==========================================
         *
         * Prioritas:
         *
         * 1. subdistrict + postal code
         * 2. subdistrict
         *
         * Jangan pernah mengirim search kosong.
         */

        const searchTerm =
            postalCode ||
            subdistrict;

        if (!searchTerm.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Search destination tidak boleh kosong.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * RAJAONGKIR URL
         * ==========================================
         */

        const url =
            new URL(
                "https://rajaongkir.komerce.id/api/v1/destination/domestic-destination"
            );

        url.searchParams.set(
            "search",
            searchTerm
        );

        /*
         * Ambil cukup banyak hasil agar kita
         * bisa mencocokkan lokasi secara akurat.
         */

        url.searchParams.set(
            "limit",
            "100"
        );

        url.searchParams.set(
            "offset",
            "0"
        );

        console.log(
            "RAJAONGKIR DESTINATION REQUEST:",
            {
                search: searchTerm,
                province,
                city,
                district,
                subdistrict,
                postalCode,
            }
        );

        /*
         * ==========================================
         * FETCH RAJAONGKIR
         * ==========================================
         */

        const response =
            await fetch(
                url.toString(),
                {
                    method: "GET",

                    headers: {
                        key: apiKey,
                        Accept:
                            "application/json",
                    },

                    cache: "no-store",
                }
            );

        const result =
            await response.json();

        console.log(
            "RAJAONGKIR DESTINATION RESPONSE:",
            JSON.stringify(
                result,
                null,
                2
            )
        );

        /*
         * ==========================================
         * HANDLE ERROR
         * ==========================================
         */

        if (!response.ok) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        result?.meta
                            ?.message ||
                        result?.message ||
                        "Gagal mengambil destination RajaOngkir.",

                    meta:
                        result?.meta ??
                        null,
                },
                {
                    status:
                        response.status,
                }
            );
        }

        /*
         * ==========================================
         * PARSE DATA
         * ==========================================
         */

        const destinations =
            Array.isArray(
                result?.data
            )
                ? (result.data as RajaOngkirDestination[])
                : [];

        if (
            destinations.length === 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        `Destination RajaOngkir tidak ditemukan untuk "${subdistrict}".`,
                    meta:
                        result?.meta ??
                        null,
                },
                {
                    status: 404,
                }
            );
        }

        /*
         * ==========================================
         * MATCH EXACT LOCATION
         * ==========================================
         *
         * Jangan langsung ambil destinations[0].
         *
         * Karena pencarian "Cibaduyut" misalnya
         * bisa mengembalikan lebih dari satu data.
         *
         * Kita cocokkan:
         *
         * province
         * city
         * district
         * subdistrict
         * postal code jika tersedia
         */

        const exactMatches =
            destinations.filter(
                (destination) => {
                    const provinceMatch =
                        isSame(
                            destination.province_name,
                            province
                        );

                    const cityMatch =
                        isSame(
                            destination.city_name,
                            city
                        );

                    const districtMatch =
                        isSame(
                            destination.district_name,
                            district
                        );

                    const subdistrictMatch =
                        isSame(
                            destination.subdistrict_name,
                            subdistrict
                        );

                    const postalMatch =
                        !postalCode ||
                        !destination.zip_code ||
                        isSame(
                            destination.zip_code,
                            postalCode
                        );

                    return (
                        provinceMatch &&
                        cityMatch &&
                        districtMatch &&
                        subdistrictMatch &&
                        postalMatch
                    );
                }
            );

        /*
         * ==========================================
         * SECOND MATCH
         * ==========================================
         *
         * Kalau exact + postal gagal, coba tanpa
         * postal code.
         */

        const locationMatches =
            destinations.filter(
                (destination) => {
                    return (
                        isSame(
                            destination.province_name,
                            province
                        ) &&
                        isSame(
                            destination.city_name,
                            city
                        ) &&
                        isSame(
                            destination.district_name,
                            district
                        ) &&
                        isSame(
                            destination.subdistrict_name,
                            subdistrict
                        )
                    );
                }
            );

        const matchedDestination =
            exactMatches[0] ??
            locationMatches[0] ??
            null;

        /*
         * ==========================================
         * DEBUG
         * ==========================================
         */

        console.log(
            "RAJAONGKIR DESTINATION MATCH:",
            {
                total:
                    destinations.length,

                exactMatches:
                    exactMatches.length,

                locationMatches:
                    locationMatches.length,

                matched:
                    matchedDestination,
            }
        );

        /*
         * ==========================================
         * NO MATCH
         * ==========================================
         */

        if (!matchedDestination) {
            return NextResponse.json(
                {
                    success: false,

                    message:
                        "Destination ditemukan dari API RajaOngkir, tetapi tidak cocok dengan wilayah yang dipilih.",

                    data: null,

                    debug: {
                        search:
                            searchTerm,

                        requested: {
                            province,
                            city,
                            district,
                            subdistrict,
                            postalCode,
                        },

                        resultCount:
                            destinations.length,

                        results:
                            destinations.slice(
                                0,
                                20
                            ),
                    },
                },
                {
                    status: 404,
                }
            );
        }

        /*
         * ==========================================
         * VALIDATE DESTINATION ID
         * ==========================================
         */

        const destinationId =
            Number(
                matchedDestination.id
            );

        if (
            !Number.isInteger(
                destinationId
            ) ||
            destinationId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "ID destination RajaOngkir dari API tidak valid.",
                },
                {
                    status: 500,
                }
            );
        }

        /*
         * ==========================================
         * SUCCESS
         * ==========================================
         */

        return NextResponse.json(
            {
                success: true,

                data: {
                    rajaOngkirDestinationId:
                        destinationId,

                    raw:
                        matchedDestination,
                },
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error(
            "RAJAONGKIR DESTINATION ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Terjadi kesalahan saat mengambil destination RajaOngkir.",
            },
            {
                status: 500,
            }
        );
    }
}