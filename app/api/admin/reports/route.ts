import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Period = "7d" | "30d" | "90d" | "1y";

function getPeriodStart(period: Period) {
    const now = new Date();

    const start = new Date(now);

    switch (period) {
        case "30d":
            start.setDate(start.getDate() - 30);
            break;

        case "90d":
            start.setDate(start.getDate() - 90);
            break;

        case "1y":
            start.setFullYear(start.getFullYear() - 1);
            break;

        case "7d":
        default:
            start.setDate(start.getDate() - 7);
            break;
    }

    return start;
}

function isPeriod(value: string): value is Period {
    return ["7d", "30d", "90d", "1y"].includes(value);
}

function toNumber(value: unknown) {
    const number = Number(value ?? 0);

    return Number.isFinite(number) ? number : 0;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const rawPeriod = searchParams.get("period") ?? "7d";

        const period: Period = isPeriod(rawPeriod)
            ? rawPeriod
            : "7d";

        const now = new Date();
        const periodStart = getPeriodStart(period);

        /*
         * Ambil order dalam periode.
         *
         * Sesuaikan nama model / field di bawah dengan schema Prisma lu
         * kalau model order lu bukan "order".
         */
        const orders = await prisma.order.findMany({
            where: {
                createdAt: {
                    gte: periodStart,
                    lte: now,
                },
            },
            include: {
                items: {
                    include: {
                        product: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        /*
         * SUMMARY
         */

        const totalOrders = orders.length;

        const paidOrders = orders.filter(
            (order) =>
                order.paymentStatus === "PAID"
        );

        const cancelledOrders = orders.filter(
            (order) =>
                order.status === "CANCELLED"
        );

        const paidOrderCount = paidOrders.length;

        let paidSubtotal = 0;
        let paidShipping = 0;
        let revenue = 0;

        for (const order of paidOrders) {
            const subtotal = toNumber(
                (order as any).subtotal
            );

            const shipping = toNumber(
                (order as any).shippingCost ??
                    (order as any).shipping
            );

            const total = toNumber(
                (order as any).total
            );

            paidSubtotal += subtotal;
            paidShipping += shipping;

            /*
             * Revenue mengikuti total order yang sudah PAID.
             */
            revenue += total;
        }

        /*
         * PRODUCT + CUSTOMER TOTAL
         */

        const totalProducts =
            await prisma.product.count();

        /*
         * Kalau model customer/user di project lu berbeda,
         * bagian ini tinggal disesuaikan.
         */
        const totalCustomers =
            await prisma.user.count();

        /*
         * DAILY SALES
         */

        const dailySales: {
            date: string;
            revenue: number;
            orders: number;
        }[] = [];

        const cursor = new Date(periodStart);

        cursor.setHours(0, 0, 0, 0);

        while (cursor <= now) {
            const dateKey =
                cursor.toISOString().slice(0, 10);

            const dayOrders = paidOrders.filter(
                (order) => {
                    const orderDate =
                        new Date(order.createdAt)
                            .toISOString()
                            .slice(0, 10);

                    return orderDate === dateKey;
                }
            );

            const dayRevenue = dayOrders.reduce(
                (sum, order) =>
                    sum +
                    toNumber(
                        (order as any).total
                    ),
                0
            );

            dailySales.push({
                date: dateKey,
                revenue: dayRevenue,
                orders: dayOrders.length,
            });

            cursor.setDate(
                cursor.getDate() + 1
            );
        }

        /*
         * TOP PRODUCTS
         */

        const productMap = new Map<
            number,
            {
                productId: number;
                productName: string;
                quantity: number;
                revenue: number;
            }
        >();

        for (const order of paidOrders) {
            for (const item of order.items) {
                const productId = Number(
                    (item as any).productId
                );

                const productName =
                    (item as any).product?.name ??
                    (item as any).productName ??
                    "Produk";

                const quantity = toNumber(
                    (item as any).quantity
                );

                const itemTotal = toNumber(
                    (item as any).total ??
                        (item as any).subtotal ??
                        (
                            toNumber(
                                (item as any).price
                            ) * quantity
                        )
                );

                const existing =
                    productMap.get(productId);

                if (existing) {
                    existing.quantity += quantity;
                    existing.revenue += itemTotal;
                } else {
                    productMap.set(productId, {
                        productId,
                        productName,
                        quantity,
                        revenue: itemTotal,
                    });
                }
            }
        }

        const topProducts = Array.from(
            productMap.values()
        )
            .sort(
                (a, b) =>
                    b.revenue - a.revenue
            )
            .slice(0, 10);

        /*
         * PAYMENT METHOD
         */

        const paymentMethod: Record<
            string,
            number
        > = {};

        for (const order of orders) {
            const method =
                String(
                    (order as any).paymentMethod ??
                        "UNKNOWN"
                );

            paymentMethod[method] =
                (paymentMethod[method] ?? 0) + 1;
        }

        /*
         * ORDER STATUS
         */

        const orderStatus: Record<
            string,
            number
        > = {};

        for (const order of orders) {
            const status = String(
                order.status
            );

            orderStatus[status] =
                (orderStatus[status] ?? 0) + 1;
        }

        /*
         * RESPONSE
         */

        return NextResponse.json({
            success: true,

            data: {
                period,
                periodStart:
                    periodStart.toISOString(),

                periodEnd:
                    now.toISOString(),

                summary: {
                    totalProducts,
                    totalCustomers,

                    totalOrders,

                    periodOrderCount:
                        totalOrders,

                    paidOrderCount:
                        paidOrderCount,

                    revenue,

                    paidSubtotal,

                    paidShipping,
                },

                dailySales,

                topProducts,

                paymentMethod,

                orderStatus,
            },
        });
    } catch (error) {
        console.error(
            "ADMIN REPORT ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil laporan.",
            },
            {
                status: 500,
            }
        );
    }
}