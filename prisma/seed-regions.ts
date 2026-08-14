import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASE_URL =
    "https://emsifa.github.io/api-wilayah-indonesia/api";

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status} saat mengambil ${url}`
        );
    }

    return response.json();
}

type Province = {
    id: string;
    name: string;
};

type Regency = {
    id: string;
    province_id: string;
    name: string;
};

type District = {
    id: string;
    regency_id: string;
    name: string;
};

type Village = {
    id: string;
    district_id: string;
    name: string;
};

async function main() {
    console.log("======================================");
    console.log("SEED WILAYAH INDONESIA");
    console.log("======================================");
    console.log("Sumber: api-wilayah-indonesia");
    console.log("Tidak menggunakan RajaOngkir.");
    console.log("");

    /*
     * ==========================================
     * 1. PROVINCES
     * ==========================================
     */

    const provinces =
        await fetchJson<Province[]>(
            `${BASE_URL}/provinces.json`
        );

    console.log(
        `Province ditemukan: ${provinces.length}`
    );

    for (const province of provinces) {
        await prisma.province.upsert({
            where: {
                id: Number(province.id),
            },

            update: {
                name: province.name,
            },

            create: {
                id: Number(province.id),
                name: province.name,
            },
        });
    }

    console.log("✓ Province selesai");

    /*
     * ==========================================
     * 2. REGENCIES
     * ==========================================
     */

    let totalRegencies = 0;

    for (const province of provinces) {
        console.log(
            `\nProvince: ${province.name}`
        );

        const regencies =
            await fetchJson<Regency[]>(
                `${BASE_URL}/regencies/${province.id}.json`
            );

        for (const regency of regencies) {
            await prisma.regency.upsert({
                where: {
                    id: Number(regency.id),
                },

                update: {
                    provinceId:
                        Number(regency.province_id),

                    name: regency.name,
                },

                create: {
                    id: Number(regency.id),
                    provinceId:
                        Number(regency.province_id),

                    name: regency.name,
                },
            });

            totalRegencies++;
        }

        console.log(
            `  ✓ Regency: ${regencies.length}`
        );
    }

    console.log(
        `\n✓ Total Regency: ${totalRegencies}`
    );

    /*
     * ==========================================
     * 3. DISTRICTS
     * ==========================================
     */

    let totalDistricts = 0;

    for (const province of provinces) {
        const regencies =
            await fetchJson<Regency[]>(
                `${BASE_URL}/regencies/${province.id}.json`
            );

        for (const regency of regencies) {
            const districts =
                await fetchJson<District[]>(
                    `${BASE_URL}/districts/${regency.id}.json`
                );

            for (const district of districts) {
                await prisma.district.upsert({
                    where: {
                        id: Number(district.id),
                    },

                    update: {
                        regencyId:
                            Number(
                                district.regency_id
                            ),

                        name: district.name,
                    },

                    create: {
                        id: Number(district.id),

                        regencyId:
                            Number(
                                district.regency_id
                            ),

                        name: district.name,
                    },
                });

                totalDistricts++;
            }
        }

        console.log(
            `✓ District province ${province.name}`
        );
    }

    console.log(
        `\n✓ Total District: ${totalDistricts}`
    );

    /*
     * ==========================================
     * 4. VILLAGES
     * ==========================================
     */

    let totalVillages = 0;

    for (const province of provinces) {
        const regencies =
            await fetchJson<Regency[]>(
                `${BASE_URL}/regencies/${province.id}.json`
            );

        for (const regency of regencies) {
            const districts =
                await fetchJson<District[]>(
                    `${BASE_URL}/districts/${regency.id}.json`
                );

            for (const district of districts) {
                const villages =
                    await fetchJson<Village[]>(
                        `${BASE_URL}/villages/${district.id}.json`
                    );

                for (const village of villages) {
                    await prisma.village.upsert({
                        where: {
                            id: Number(village.id),
                        },

                        update: {
                            districtId:
                                Number(
                                    village.district_id
                                ),

                            name: village.name,
                        },

                        create: {
                            id:
                                Number(
                                    village.id
                                ),

                            districtId:
                                Number(
                                    village.district_id
                                ),

                            name:
                                village.name,
                        },
                    });

                    totalVillages++;
                }
            }
        }

        console.log(
            `✓ Village province ${province.name}`
        );
    }

    console.log(
        `\n✓ Total Village: ${totalVillages}`
    );

    /*
     * ==========================================
     * DONE
     * ==========================================
     */

    console.log("");
    console.log("======================================");
    console.log("SEED SELESAI");
    console.log("======================================");
    console.log(
        `Province : ${provinces.length}`
    );
    console.log(
        `Regency  : ${totalRegencies}`
    );
    console.log(
        `District : ${totalDistricts}`
    );
    console.log(
        `Village  : ${totalVillages}`
    );
    console.log("======================================");
}

main()
    .catch((error) => {
        console.error("");
        console.error(
            "❌ REGION SEED ERROR:"
        );
        console.error(error);

        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });