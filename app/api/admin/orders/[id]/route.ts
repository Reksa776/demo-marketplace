import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

const allowedStatuses = [
    "PENDING",
    "PAID",
    "PROCESSING",
    "SHIPPED",
    "COMPLETED",
    "CANCELLED",
];

/*
|--------------------------------------------------------------------------
| GET DETAIL ORDER ADMIN
|--------------------------------------------------------------------------
*/
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

        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Akses ditolak.",
                },
                { status: 403 }
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
            await prisma.order.findUnique({
                where: {
                    id: orderId,
                },

                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                        },
                    },

                    items: {
                        orderBy: {
                            id: "asc",
                        },

                        select: {
                            id: true,
                            productId: true,
                            variantId: true,

                            productName: true,
                            variantName: true,

                            price: true,
                            quantity: true,
                            subtotal: true,

                            product: {
                                select: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                    image: true,
                                },
                            },

                            variant: {
                                select: {
                                    id: true,
                                    name: true,
                                    image: true,
                                    weight: true,
                                },
                            },
                        },
                    },
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

        const data = {
            id: order.id,
            orderNumber: order.orderNumber,

            customer: order.user
                ? {
                      id: order.user.id,
                      name: order.user.name,
                      email: order.user.email,
                      phone: order.user.phone,
                  }
                : null,

            recipientName:
                order.recipientName,

            phone: order.phone,

            address: order.address,

            note: order.note,

            city: order.city,
            district: order.district,
            province: order.province,
            postalCode: order.postalCode,

            subtotal: Number(order.subtotal),
            shippingCost:
                Number(order.shippingCost),
            total: Number(order.total),

            status: order.status,

            paymentMethod:
                order.paymentMethod,

            paymentStatus:
                order.paymentStatus,

            paidAt: order.paidAt
                ? order.paidAt.toISOString()
                : null,

            shippingCourier:
                order.shippingCourier,

            shippingService:
                order.shippingService,

            trackingNumber:
                order.trackingNumber,

            trackingUrl:
                order.trackingUrl,

            createdAt:
                order.createdAt.toISOString(),

            updatedAt:
                order.updatedAt.toISOString(),

            items: order.items.map(
                (item) => ({
                    id: item.id,

                    productId:
                        item.productId,

                    variantId:
                        item.variantId,

                    productName:
                        item.productName,

                    variantName:
                        item.variantName,

                    price: Number(
                        item.price
                    ),

                    quantity:
                        item.quantity,

                    subtotal: Number(
                        item.subtotal
                    ),

                    product:
                        item.product
                            ? {
                                  id:
                                      item
                                          .product
                                          .id,

                                  name:
                                      item
                                          .product
                                          .name,

                                  slug:
                                      item
                                          .product
                                          .slug,

                                  image:
                                      item
                                          .product
                                          .image,
                              }
                            : null,

                    variant:
                        item.variant
                            ? {
                                  id:
                                      item
                                          .variant
                                          .id,

                                  name:
                                      item
                                          .variant
                                          .name,

                                  image:
                                      item
                                          .variant
                                          .image,

                                  weight:
                                      item
                                          .variant
                                          .weight,
                              }
                            : null,
                })
            ),
        };

        return NextResponse.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error(
            "GET ADMIN ORDER DETAIL ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil detail pesanan.",
            },
            { status: 500 }
        );
    }
}

/*
|--------------------------------------------------------------------------
| PATCH STATUS + RESI
|--------------------------------------------------------------------------
*/
export async function PATCH(
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

        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Akses ditolak.",
                },
                { status: 403 }
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

        const body = await req.json();

        const {
            status,
            trackingNumber,
        } = body;

        if (
            !status ||
            !allowedStatuses.includes(status)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Status pesanan tidak valid.",
                },
                { status: 400 }
            );
        }

        const order =
            await prisma.order.findUnique({
                where: {
                    id: orderId,
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

        const cleanTrackingNumber =
            typeof trackingNumber === "string"
                ? trackingNumber.trim()
                : "";

        /*
         * SHIPPED -> wajib ada resi
         */
        if (
            status === "SHIPPED" &&
            !cleanTrackingNumber &&
            !order.trackingNumber
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nomor resi wajib diisi sebelum status menjadi Dikirim.",
                },
                { status: 400 }
            );
        }

        /*
         * COMPLETED -> wajib ada resi
         */
        if (
            status === "COMPLETED" &&
            !cleanTrackingNumber &&
            !order.trackingNumber
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Nomor resi belum tersedia.",
                },
                { status: 400 }
            );
        }

        let trackingUrl =
            order.trackingUrl;

        if (cleanTrackingNumber) {
            trackingUrl =
                createTrackingUrl(
                    order.shippingCourier,
                    cleanTrackingNumber
                );
        }

        if (
            trackingNumber === ""
        ) {
            trackingUrl = null;
        }

        const previousStatus = order.status;

        const updatedOrder =
            await prisma.order.update({
                where: {
                    id: orderId,
                },

                data: {
                    status,

                    trackingNumber:
                        trackingNumber !==
                        undefined
                            ? cleanTrackingNumber ||
                              null
                            : order.trackingNumber,

                    trackingUrl,
                },
            });

        /*
         * ==========================================
         * NOTIFICATION TRIGGER
         * ==========================================
         *
         * Fire-and-forget.
         * Notification error tidak boleh
         * mempengaruhi response ke admin.
         */
        if (previousStatus !== status) {
            const { onOrderStatusChanged } =
                await import(
                    "@/lib/notification/order-status-handler"
                );

            onOrderStatusChanged(
                orderId,
                previousStatus,
                status
            ).catch((err) =>
                console.error(
                    "NOTIFICATION TRIGGER ERROR:",
                    err
                )
            );
        }

        return NextResponse.json({
            success: true,

            message:
                "Pesanan berhasil diperbarui.",

            data: {
                id: updatedOrder.id,

                orderNumber:
                    updatedOrder.orderNumber,

                status:
                    updatedOrder.status,

                shippingCourier:
                    updatedOrder.shippingCourier,

                shippingService:
                    updatedOrder.shippingService,

                trackingNumber:
                    updatedOrder.trackingNumber,

                trackingUrl:
                    updatedOrder.trackingUrl,
            },
        });
    } catch (error) {
        console.error(
            "UPDATE ADMIN ORDER ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal memperbarui pesanan.",
            },
            { status: 500 }
        );
    }
}

/*
|--------------------------------------------------------------------------
| FALLBACK TRACKING URL
|--------------------------------------------------------------------------
*/
function createTrackingUrl(
    courier: string | null,
    trackingNumber: string
) {
    const normalizedCourier =
        courier
            ?.toLowerCase()
            .trim();

    switch (normalizedCourier) {
        case "jne":
            return `https://www.jne.co.id/id/tracking/trace/tracking?awb=${encodeURIComponent(
                trackingNumber
            )}`;

        case "jnt":
        case "j&t":
        case "jnt_express":
            return `https://www.jet.co.id/track?awb=${encodeURIComponent(
                trackingNumber
            )}`;

        case "sicepat":
            return `https://www.sicepat.com/checkAwb?awb=${encodeURIComponent(
                trackingNumber
            )}`;

        case "anteraja":
            return `https://anteraja.id/tracking?tracking_number=${encodeURIComponent(
                trackingNumber
            )}`;

        case "pos":
        case "pos_indonesia":
            return `https://www.posindonesia.co.id/id/tracking?code=${encodeURIComponent(
                trackingNumber
            )}`;

        default:
            return null;
    }
}