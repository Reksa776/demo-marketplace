import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
                    message: "Forbidden.",
                },
                { status: 403 }
            );
        }

        const orders =
            await prisma.order.findMany({
                orderBy: {
                    createdAt: "desc",
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

                    items: true,
                },
            });

        const data = orders.map((order) => ({
            id: order.id,

            orderNumber: order.orderNumber,

            recipientName: order.recipientName,
            phone: order.phone,

            address: order.address,
            city: order.city,
            district: order.district,
            province: order.province,
            postalCode: order.postalCode,

            subtotal: Number(order.subtotal),
            shippingCost: Number(order.shippingCost),
            total: Number(order.total),

            status: order.status,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,

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

            user: order.user
                ? {
                    id: order.user.id,
                    name: order.user?.name ?? order.recipientName,
                    email: order.user?.email ?? "-",
                    phone: order.user?.phone ?? order.phone,
                }
                : null,

            items: order.items.map(
                (item) => ({
                    id: item.id,
                    productName:
                        item.productName,
                    variantName:
                        item.variantName,
                    quantity:
                        item.quantity,
                    price:
                        Number(item.price),
                    subtotal:
                        Number(item.subtotal),
                })
            ),
        }));

        return NextResponse.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error(
            "GET ADMIN ORDERS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil pesanan admin.",
            },
            { status: 500 }
        );
    }
}