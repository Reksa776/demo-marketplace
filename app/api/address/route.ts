import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Silakan login terlebih dahulu.",
                },
                { status: 401 }
            );
        }

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
            rajaOngkirDestinationId,
            latitude,
            longitude,
            isDefault,
        } = body;

        if (
            typeof recipientName !== "string" ||
            !recipientName.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nama penerima wajib diisi.",
                },
                { status: 400 }
            );
        }

        if (
            typeof phone !== "string" ||
            !phone.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nomor HP wajib diisi.",
                },
                { status: 400 }
            );
        }

        if (
            typeof address !== "string" ||
            !address.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Alamat lengkap wajib diisi.",
                },
                { status: 400 }
            );
        }

        if (
            !rajaOngkirDestinationId ||
            !Number.isInteger(
                Number(rajaOngkirDestinationId)
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Wilayah tujuan belum lengkap.",
                },
                { status: 400 }
            );
        }

        const userId = session.user.id;

        const shouldBeDefault =
            Boolean(isDefault);

        /*
         * Kalau alamat baru dijadikan default,
         * matikan default alamat lama.
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
         * otomatis jadikan alamat pertama sebagai default.
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

        const newAddress =
            await prisma.userAddress.create({
                data: {
                    userId,

                    label:
                        typeof label === "string" &&
                        label.trim()
                            ? label.trim()
                            : null,

                    recipientName:
                        recipientName.trim(),

                    phone: phone.trim(),

                    address: address.trim(),

                    province:
                        typeof province ===
                            "string" &&
                        province.trim()
                            ? province.trim()
                            : null,

                    city:
                        typeof city === "string" &&
                        city.trim()
                            ? city.trim()
                            : null,

                    district:
                        typeof district ===
                            "string" &&
                        district.trim()
                            ? district.trim()
                            : null,

                    subdistrict:
                        typeof subdistrict ===
                            "string" &&
                        subdistrict.trim()
                            ? subdistrict.trim()
                            : null,

                    postalCode:
                        typeof postalCode ===
                            "string" &&
                        postalCode.trim()
                            ? postalCode.trim()
                            : null,

                    rajaOngkirDestinationId:
                        Number(
                            rajaOngkirDestinationId
                        ),

                    latitude:
                        latitude !== null &&
                        latitude !== undefined &&
                        latitude !== ""
                            ? Number(latitude)
                            : null,

                    longitude:
                        longitude !== null &&
                        longitude !== undefined &&
                        longitude !== ""
                            ? Number(longitude)
                            : null,

                    isDefault:
                        finalIsDefault,
                },
            });

        return NextResponse.json(
            {
                success: true,
                message:
                    "Alamat berhasil disimpan.",
                address: newAddress,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            "CREATE ADDRESS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal menyimpan alamat.",
            },
            { status: 500 }
        );
    }
}

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
                { status: 401 }
            );
        }

        const addresses =
            await prisma.userAddress.findMany({
                where: {
                    userId: session.user.id,
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
            addresses,
        });
    } catch (error) {
        console.error(
            "GET ADDRESSES ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil alamat.",
            },
            { status: 500 }
        );
    }
}