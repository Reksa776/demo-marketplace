import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

import {
    getProvinces,
    getCities,
    getDistricts,
    getSubdistricts,
} from "@/lib/rajaongkir/locations";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "Silakan login terlebih dahulu." }, { status: 401 });
        }
        if (session.user.role !== "ADMIN") {
            return NextResponse.json({ success: false, message: "Akses ditolak." }, { status: 403 });
        }
        const { searchParams } =
            new URL(request.url);

        const type =
            searchParams.get("type");

        const id =
            searchParams.get("id");

        if (type === "province") {
            const data =
                await getProvinces();

            return NextResponse.json({
                success: true,
                data,
            });
        }

        if (!id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "ID wilayah wajib diisi.",
                },
                { status: 400 }
            );
        }

        const numericId =
            Number(id);

        if (
            !Number.isInteger(
                numericId
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "ID wilayah tidak valid.",
                },
                { status: 400 }
            );
        }

        if (type === "city") {
            const data =
                await getCities(
                    numericId
                );

            return NextResponse.json({
                success: true,
                data,
            });
        }

        if (type === "district") {
            const data =
                await getDistricts(
                    numericId
                );

            return NextResponse.json({
                success: true,
                data,
            });
        }

        if (
            type ===
            "subdistrict"
        ) {
            const data =
                await getSubdistricts(
                    numericId
                );

            return NextResponse.json({
                success: true,
                data,
            });
        }

        return NextResponse.json(
            {
                success: false,
                message:
                    "Tipe wilayah tidak valid.",
            },
            { status: 400 }
        );
    } catch (error) {
        console.error(
            "LOCATION API ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengambil wilayah.",
            },
            { status: 500 }
        );
    }
}