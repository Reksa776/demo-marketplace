import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { rajaOngkirFetch } from "@/lib/rajaongkir";

type RegionItem = {
    id?: number | string;
    destination_id?: number | string;

    province_id?: number | string;
    province_name?: string;

    city_id?: number | string;
    city_name?: string;

    district_id?: number | string;
    district_name?: string;

    subdistrict_id?: number | string;
    subdistrict_name?: string;

    zip_code?: string;
    postal_code?: string;
};

function toNumberOrNull(
    value?: number | string | null
): number | null {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}

function toStringOrNull(
    value?: string | null
): string | null {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    return String(value);
}

export async function POST() {
    try {
        /**
         * ============================
         * ADMIN AUTHORIZATION
         * ============================
         */

        await requireAdmin();

        /**
         * ============================
         * FETCH RAJAONGKIR
         * ============================
         */

        const data = await rajaOngkirFetch(
            "/destination/domestic-destination"
        );

        if (!Array.isArray(data)) {
            throw new Error(
                "Format data destination RajaOngkir tidak valid."
            );
        }

        /**
         * ============================
         * SYNC DATA
         * ============================
         */

        let inserted = 0;
        let skipped = 0;

        for (
            const item of data as RegionItem[]
        ) {
            const destinationId =
                toNumberOrNull(
                    item.destination_id ??
                        item.id
                );

            /**
             * Destination ID wajib ada.
             */
            if (!destinationId) {
                skipped++;
                continue;
            }

            const provinceId =
                toNumberOrNull(
                    item.province_id
                );

            const cityId =
                toNumberOrNull(
                    item.city_id
                );

            const districtId =
                toNumberOrNull(
                    item.district_id
                );

            const subdistrictId =
                toNumberOrNull(
                    item.subdistrict_id
                );

            const province =
                toStringOrNull(
                    item.province_name
                );

            const city =
                toStringOrNull(
                    item.city_name
                );

            const district =
                toStringOrNull(
                    item.district_name
                );

            const subdistrict =
                toStringOrNull(
                    item.subdistrict_name
                );

            const postalCode =
                toStringOrNull(
                    item.postal_code ??
                        item.zip_code
                );

            /**
             * ============================
             * UPSERT
             * ============================
             */

            await prisma.rajaOngkirRegion.upsert(
                {
                    where: {
                        destinationId,
                    },

                    create: {
                        destinationId,

                        provinceId,
                        province,

                        cityId,
                        city,

                        districtId,
                        district,

                        subdistrictId,
                        subdistrict,

                        postalCode,
                    },

                    update: {
                        provinceId,
                        province,

                        cityId,
                        city,

                        districtId,
                        district,

                        subdistrictId,
                        subdistrict,

                        postalCode,
                    },
                }
            );

            inserted++;
        }

        /**
         * ============================
         * RESPONSE
         * ============================
         */

        return NextResponse.json(
            {
                success: true,
                message:
                    "Data wilayah berhasil disinkronkan.",
                count: inserted,
                skipped,
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error(
            "SYNC RAJAONGKIR REGION ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Gagal melakukan sinkronisasi wilayah.",
            },
            {
                status: 500,
            }
        );
    }
}