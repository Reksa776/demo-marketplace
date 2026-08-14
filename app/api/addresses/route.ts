import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/*
 * ==========================================
 * HELPER
 * ==========================================
 */

function nullableInt(value: unknown): number | null {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const numberValue = Number(value);

    if (
        !Number.isInteger(numberValue) ||
        numberValue <= 0
    ) {
        return null;
    }

    return numberValue;
}

function nullableDecimal(
    value: unknown
): number | null {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
        return null;
    }

    return numberValue;
}

/*
 * ==========================================
 * GET
 * ==========================================
 */

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Silakan login terlebih dahulu.",
                },
                {
                    status: 401,
                }
            );
        }

        const userId = session.user.id;

        const addresses =
            await prisma.userAddress.findMany({
                where: {
                    userId,
                },
                orderBy: [
                    {
                        isDefault: "desc",
                    },
                    {
                        createdAt: "desc",
                    },
                ],
            });

        return NextResponse.json({
            success: true,
            data: addresses,
        });
    } catch (error) {
        console.error(
            "GET ADDRESS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil alamat.",
            },
            {
                status: 500,
            }
        );
    }
}

/*
 * ==========================================
 * POST
 * ==========================================
 */

export async function POST(
    request: Request
) {
    try {
        /*
         * ==========================================
         * AUTH
         * ==========================================
         */

        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Silakan login terlebih dahulu.",
                },
                {
                    status: 401,
                }
            );
        }

        const userId = session.user.id;

        /*
         * ==========================================
         * BODY
         * ==========================================
         */

        const body = await request.json();

        const {
            label,
            recipientName,
            phone,
            address,

            province,
            city,
            district,
            subdistrict,

            postalCode,

            provinceId,
            cityId,
            districtId,
            subdistrictId,

            rajaOngkirDestinationId,

            latitude,
            longitude,

            isDefault,
        } = body;

        /*
         * ==========================================
         * VALIDASI BASIC
         * ==========================================
         */

        if (
            !recipientName ||
            !String(recipientName).trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nama penerima wajib diisi.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !phone ||
            !String(phone).trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nomor HP wajib diisi.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !address ||
            !String(address).trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Alamat lengkap wajib diisi.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !province ||
            !String(province).trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Provinsi wajib diisi.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !city ||
            !String(city).trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Kota/Kabupaten wajib diisi.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !district ||
            !String(district).trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Kecamatan wajib diisi.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !subdistrict ||
            !String(subdistrict).trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Kelurahan/Desa wajib diisi.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * PARSE ID
         * ==========================================
         */

        const parsedProvinceId =
            nullableInt(provinceId);

        const parsedCityId =
            nullableInt(cityId);

        const parsedDistrictId =
            nullableInt(districtId);

        const parsedVillageId =
            nullableInt(subdistrictId);

        const parsedDestinationId =
            nullableInt(
                rajaOngkirDestinationId
            );

        /*
         * ==========================================
         * DEBUG
         * ==========================================
         */

        console.log(
            "CREATE ADDRESS INPUT:",
            {
                provinceId,
                cityId,
                districtId,
                subdistrictId,

                parsedProvinceId,
                parsedCityId,
                parsedDistrictId,
                parsedVillageId,

                rajaOngkirDestinationId:
                    parsedDestinationId,
            }
        );

        /*
         * ==========================================
         * IMPORTANT
         *
         * Jangan langsung percaya ID dari frontend.
         *
         * ID tersebut harus benar-benar ada
         * di database lokal kita.
         * ==========================================
         */

        let validProvinceId:
            number | null = null;

        let validRegencyId:
            number | null = null;

        let validDistrictId:
            number | null = null;

        let validVillageId:
            number | null = null;

        /*
         * ==========================================
         * PROVINCE
         * ==========================================
         */

        if (parsedProvinceId) {
            const provinceData =
                await prisma.province.findUnique({
                    where: {
                        id: parsedProvinceId,
                    },
                    select: {
                        id: true,
                        name: true,
                    },
                });

            if (provinceData) {
                validProvinceId =
                    provinceData.id;
            } else {
                console.warn(
                    "Province ID tidak ditemukan:",
                    parsedProvinceId
                );
            }
        }

        /*
         * ==========================================
         * REGENCY / CITY
         * ==========================================
         */

        if (parsedCityId) {
            const regencyData =
                await prisma.regency.findUnique({
                    where: {
                        id: parsedCityId,
                    },
                    select: {
                        id: true,
                        provinceId: true,
                        name: true,
                    },
                });

            if (regencyData) {
                /*
                 * Pastikan kota memang berada
                 * di provinsi yang dipilih.
                 */

                if (
                    !validProvinceId ||
                    regencyData.provinceId ===
                        validProvinceId
                ) {
                    validRegencyId =
                        regencyData.id;

                    /*
                     * Kalau province lokal belum ada,
                     * tetapi relasi kota valid,
                     * kita bisa mengambil provinceId
                     * dari database.
                     */

                    if (!validProvinceId) {
                        validProvinceId =
                            regencyData.provinceId;
                    }
                } else {
                    console.warn(
                        "City tidak cocok dengan province:",
                        {
                            cityId:
                                parsedCityId,

                            provinceId:
                                validProvinceId,

                            cityProvinceId:
                                regencyData.provinceId,
                        }
                    );
                }
            } else {
                console.warn(
                    "Regency ID tidak ditemukan:",
                    parsedCityId
                );
            }
        }

        /*
         * ==========================================
         * DISTRICT
         * ==========================================
         */

        if (parsedDistrictId) {
            const districtData =
                await prisma.district.findUnique({
                    where: {
                        id: parsedDistrictId,
                    },
                    select: {
                        id: true,
                        regencyId: true,
                        name: true,
                    },
                });

            if (districtData) {
                /*
                 * Pastikan district benar-benar
                 * milik kota yang dipilih.
                 */

                if (
                    !validRegencyId ||
                    districtData.regencyId ===
                        validRegencyId
                ) {
                    validDistrictId =
                        districtData.id;

                    if (!validRegencyId) {
                        validRegencyId =
                            districtData.regencyId;
                    }
                } else {
                    console.warn(
                        "District tidak cocok dengan city:",
                        {
                            districtId:
                                parsedDistrictId,

                            cityId:
                                validRegencyId,

                            districtCityId:
                                districtData.regencyId,
                        }
                    );
                }
            } else {
                console.warn(
                    "District ID tidak ditemukan:",
                    parsedDistrictId
                );
            }
        }

        /*
         * ==========================================
         * VILLAGE
         * ==========================================
         */

        if (parsedVillageId) {
            const villageData =
                await prisma.village.findUnique({
                    where: {
                        id: parsedVillageId,
                    },
                    select: {
                        id: true,
                        districtId: true,
                        name: true,
                        postalCode: true,
                    },
                });

            if (villageData) {
                /*
                 * Pastikan village memang
                 * milik district yang dipilih.
                 */

                if (
                    !validDistrictId ||
                    villageData.districtId ===
                        validDistrictId
                ) {
                    validVillageId =
                        villageData.id;

                    if (!validDistrictId) {
                        validDistrictId =
                            villageData.districtId;
                    }
                } else {
                    console.warn(
                        "Village tidak cocok dengan district:",
                        {
                            villageId:
                                parsedVillageId,

                            districtId:
                                validDistrictId,

                            villageDistrictId:
                                villageData.districtId,
                        }
                    );
                }
            } else {
                console.warn(
                    "Village ID tidak ditemukan:",
                    parsedVillageId
                );
            }
        }

        /*
         * ==========================================
         * STRATEGI AMAN
         *
         * Kalau ID lokal tidak ditemukan,
         * jangan masukkan ID tersebut ke FK.
         *
         * Kita simpan NULL.
         *
         * Nama wilayah tetap disimpan.
         * RajaOngkirDestinationId tetap disimpan.
         * ==========================================
         */

        console.log(
            "VALID LOCAL REGION IDS:",
            {
                provinceId:
                    validProvinceId,

                regencyId:
                    validRegencyId,

                districtId:
                    validDistrictId,

                villageId:
                    validVillageId,
            }
        );

        /*
         * ==========================================
         * DEFAULT ADDRESS
         * ==========================================
         */

        const shouldBeDefault =
            Boolean(isDefault);

        /*
         * Kalau alamat ini dijadikan default,
         * reset alamat default sebelumnya.
         */

        if (shouldBeDefault) {
            await prisma.userAddress.updateMany({
                where: {
                    userId,
                    isDefault: true,
                },
                data: {
                    isDefault: false,
                },
            });
        }

        /*
         * Kalau user belum punya alamat,
         * otomatis jadikan default.
         */

        const addressCount =
            await prisma.userAddress.count({
                where: {
                    userId,
                },
            });

        const finalIsDefault =
            addressCount === 0 ||
            shouldBeDefault;

        /*
         * ==========================================
         * CREATE
         * ==========================================
         */

        const addressData =
            await prisma.userAddress.create({
                data: {
                    userId,

                    label:
                        label
                            ? String(label).trim()
                            : null,

                    recipientName:
                        String(
                            recipientName
                        ).trim(),

                    phone:
                        String(phone).trim(),

                    address:
                        String(address).trim(),

                    province:
                        String(
                            province
                        ).trim(),

                    city:
                        String(city).trim(),

                    district:
                        String(
                            district
                        ).trim(),

                    subdistrict:
                        String(
                            subdistrict
                        ).trim(),

                    postalCode:
                        postalCode
                            ? String(
                                  postalCode
                              ).trim()
                            : null,

                    /*
                     * ==================================
                     * FK LOKAL
                     *
                     * Hanya simpan ID yang benar-benar
                     * ditemukan di database.
                     * ==================================
                     */

                    provinceId:
                        validProvinceId,

                    regencyId:
                        validRegencyId,

                    districtId:
                        validDistrictId,

                    villageId:
                        validVillageId,

                    /*
                     * ==================================
                     * RAJAONGKIR
                     *
                     * Ini ID destination RajaOngkir,
                     * bukan FK ke tabel District/Village.
                     * ==================================
                     */

                    rajaOngkirDestinationId:
                        parsedDestinationId,

                    latitude:
                        nullableDecimal(
                            latitude
                        ),

                    longitude:
                        nullableDecimal(
                            longitude
                        ),

                    isDefault:
                        finalIsDefault,
                },
            });

        /*
         * ==========================================
         * RESPONSE
         * ==========================================
         */

        return NextResponse.json(
            {
                success: true,

                message:
                    "Alamat berhasil disimpan.",

                data: addressData,
            },
            {
                status: 201,
            }
        );
    } catch (error) {
        console.error(
            "CREATE ADDRESS ERROR:",
            error
        );

        /*
         * ==========================================
         * PRISMA ERROR
         * ==========================================
         */

        if (
            error &&
            typeof error === "object" &&
            "code" in error
        ) {
            const prismaError =
                error as {
                    code?: string;
                    meta?: unknown;
                };

            console.error(
                "PRISMA ERROR CODE:",
                prismaError.code
            );

            console.error(
                "PRISMA ERROR META:",
                prismaError.meta
            );
        }

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal menyimpan alamat.",
            },
            {
                status: 500,
            }
        );
    }
}