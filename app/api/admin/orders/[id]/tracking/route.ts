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

    if (value.includes("ninja")) {
        return "ninja";
    }

    if (value.includes("idexpress")) {
        return "idexpress";
    }

    return value;
}

export async function GET(
    req: Request,
    { params }: RouteContext
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
                    message: "Unauthorized.",
                },
                {
                    status: 401,
                }
            );
        }

        /*
         * ==========================================
         * ADMIN AUTHORIZATION
         * ==========================================
         */

        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Akses ditolak. Hanya admin yang dapat melihat tracking pesanan.",
                },
                {
                    status: 403,
                }
            );
        }

        /*
         * ==========================================
         * PARAMS
         * ==========================================
         */

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
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * GET ORDER
         * ==========================================
         *
         * ADMIN TIDAK BOLEH menggunakan userId.
         *
         * Karena admin melihat pesanan milik
         * customer lain.
         */

        const order =
            await prisma.order.findUnique({
                where: {
                    id: orderId,
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
                {
                    status: 404,
                }
            );
        }

        /*
         * ==========================================
         * VALIDATE TRACKING
         * ==========================================
         */

        if (!order.trackingNumber) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nomor resi belum tersedia.",
                },
                {
                    status: 400,
                }
            );
        }

        if (!order.shippingCourier) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Kurir belum tersedia.",
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
            console.error(
                "RAJAONGKIR_API_KEY belum tersedia."
            );

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
         * NORMALIZE COURIER
         * ==========================================
         */

        const courier =
            normalizeCourier(
                order.shippingCourier
            );

        if (!courier) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Kode kurir tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * PHONE
         * ==========================================
         */

        const phoneDigits =
            String(order.phone ?? "").replace(
                /\D/g,
                ""
            );

        const lastPhoneNumber =
            phoneDigits.slice(-5);

        if (
            lastPhoneNumber.length !== 5
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nomor HP penerima tidak valid untuk tracking.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * RAJAONGKIR REQUEST
         * ==========================================
         */

        const url = new URL(
            "https://rajaongkir.komerce.id/api/v1/track/waybill"
        );

        url.searchParams.set(
            "awb",
            order.trackingNumber
        );

        url.searchParams.set(
            "courier",
            courier
        );

        url.searchParams.set(
            "last_phone_number",
            lastPhoneNumber
        );

        console.log(
            "ADMIN RAJAONGKIR TRACKING REQUEST:",
            {
                adminId: session.user.id,
                orderId: order.id,
                orderNumber:
                    order.orderNumber,
                awb: order.trackingNumber,
                courier,
                lastPhoneNumber,
            }
        );

        const response = await fetch(
            url.toString(),
            {
                method: "POST",

                headers: {
                    key: apiKey,
                    Accept:
                        "application/json",
                },

                cache: "no-store",
            }
        );

        /*
         * ==========================================
         * RAJAONGKIR RESPONSE
         * ==========================================
         */

        const result =
            await response.json();

        if (!response.ok) {
            console.error(
                "ADMIN RAJAONGKIR ERROR:",
                result
            );

            return NextResponse.json(
                {
                    success: false,
                    message:
                        result?.meta?.message ??
                        "Gagal mengambil tracking RajaOngkir.",
                    raw: result,
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
                    raw: result,
                },
                {
                    status: 400,
                }
            );
        }

        if (!result?.data) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "RajaOngkir tidak mengembalikan data tracking.",
                },
                {
                    status: 400,
                }
            );
        }

        const tracking =
            result.data;

        /*
         * ==========================================
         * NORMALIZE RESPONSE
         * ==========================================
         */

        const manifest =
            Array.isArray(
                tracking.manifest
            )
                ? tracking.manifest
                : [];

        const summary =
            tracking.summary ??
            null;

        const deliveryStatus =
            tracking.delivery_status ??
            null;

        /*
         * ==========================================
         * RESPONSE
         * ==========================================
         */

        return NextResponse.json({
            success: true,

            data: {
                order: {
                    id: order.id,

                    orderNumber:
                        order.orderNumber,

                    shippingCourier:
                        order.shippingCourier,

                    shippingService:
                        order.shippingService,

                    trackingNumber:
                        order.trackingNumber,
                },

                summary,

                details:
                    tracking.details ??
                    null,

                deliveryStatus,

                manifest,

                delivered:
                    Boolean(
                        tracking.delivered
                    ),
            },
        });
    } catch (error) {
        console.error(
            "ADMIN ORDER TRACKING ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil tracking paket.",
            },
            {
                status: 500,
            }
        );
    }
}