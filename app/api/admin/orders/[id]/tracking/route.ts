import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

function normalizeCourier(
    courier: string | null
) {
    const value = String(courier ?? "")
        .toLowerCase()
        .trim();

    if (
        value === "jnt" ||
        value === "j&t" ||
        value.includes("jnt")
    ) {
        return "jnt";
    }

    if (value.includes("jne")) {
        return "jne";
    }

    if (value.includes("sicepat")) {
        return "sicepat";
    }

    if (value.includes("anteraja")) {
        return "anteraja";
    }

    if (value.includes("pos")) {
        return "pos";
    }

    if (value.includes("tiki")) {
        return "tiki";
    }

    return value;
}

export async function GET(
    req: Request,
    { params }: RouteContext
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unauthorized.",
                },
                { status: 401 }
            );
        }

        const { id } = await params;

        const orderId = Number(id);

        if (
            !Number.isInteger(orderId) ||
            orderId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "ID pesanan tidak valid.",
                },
                { status: 400 }
            );
        }

        const order =
            await prisma.order.findFirst({
                where: {
                    id: orderId,
                    userId: session.user.id,
                },

                select: {
                    id: true,
                    orderNumber: true,

                    phone: true,

                    shippingCourier: true,
                    shippingService: true,

                    trackingNumber: true,
                },
            });

        if (!order) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Pesanan tidak ditemukan.",
                },
                { status: 404 }
            );
        }

        if (!order.trackingNumber) {
            return NextResponse.json({
                success: false,
                message:
                    "Nomor resi belum tersedia.",
            });
        }

        if (!order.shippingCourier) {
            return NextResponse.json({
                success: false,
                message:
                    "Kurir pesanan belum tersedia.",
            });
        }

        const apiKey =
            process.env.RAJAONGKIR_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "RAJAONGKIR_API_KEY belum dikonfigurasi.",
                },
                { status: 500 }
            );
        }

        const courier =
            normalizeCourier(
                order.shippingCourier
            );

        const phoneDigits =
            String(order.phone).replace(
                /\D/g,
                ""
            );

        const lastPhoneNumber =
            phoneDigits.slice(-5);

        const url =
            "https://rajaongkir.komerce.id/api/v1/track/waybill";

        const response = await fetch(
            url,
            {
                method: "POST",

                headers: {
                    key: apiKey,

                    "Content-Type":
                        "application/json",

                    Accept:
                        "application/json",
                },

                body: JSON.stringify({
                    awb:
                        order.trackingNumber,

                    courier,

                    last_phone_number:
                        lastPhoneNumber,
                }),

                cache: "no-store",
            }
        );

        const result =
            await response.json();

        console.log(
            "RAJAONGKIR TRACKING RESULT:",
            JSON.stringify(
                result,
                null,
                2
            )
        );

        if (!response.ok) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        result?.meta?.message ??
                        "Gagal mengambil tracking.",
                },
                {
                    status: response.status,
                }
            );
        }

        if (
            result?.meta?.status !==
            "success"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        result?.meta?.message ??
                        "Tracking tidak tersedia.",
                },
                { status: 400 }
            );
        }

        const tracking =
            result.data;

        return NextResponse.json({
            success: true,

            data: {
                summary:
                    tracking.summary,

                details:
                    tracking.details,

                deliveryStatus:
                    tracking.delivery_status,

                manifest:
                    Array.isArray(
                        tracking.manifest
                    )
                        ? tracking.manifest
                        : [],
            },
        });
    } catch (error) {
        console.error(
            "ORDER TRACKING ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil tracking paket.",
            },
            { status: 500 }
        );
    }
}