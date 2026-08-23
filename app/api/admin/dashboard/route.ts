import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/*
 * ==========================================
 * ADMIN / SELLER DASHBOARD
 * ==========================================
 *
 * ADMIN dan SELLER dianggap sebagai
 * staff toko dan boleh mengakses reporting.
 *
 * CUSTOMER / AFFILIATOR tidak boleh.
 */

const STAFF_ROLES = ["ADMIN", "SELLER"] as const;

export async function GET(request: Request) {
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
                { status: 401 }
            );
        }

        /*
         * ==========================================
         * CHECK ROLE
         * ==========================================
         *
         * Jangan hanya mengandalkan halaman /admin.
         * API juga wajib dilindungi.
         */

        const user = await prisma.user.findUnique({
            where: {
                id: session.user.id,
            },

            select: {
                id: true,
                role: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User tidak ditemukan.",
                },
                { status: 404 }
            );
        }

        if (!STAFF_ROLES.includes(user.role as any)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Forbidden.",
                },
                { status: 403 }
            );
        }

        /*
         * ==========================================
         * PERIOD
         * ==========================================
         *
         * ?period=7d
         * ?period=30d
         * ?period=90d
         * ?period=year
         */

        const { searchParams } =
            new URL(request.url);

        const period =
            searchParams.get("period") || "30d";

        const now = new Date();

        let startDate = new Date(now);

        if (period === "7d") {
            startDate.setDate(
                startDate.getDate() - 6
            );
        } else if (period === "90d") {
            startDate.setDate(
                startDate.getDate() - 89
            );
        } else if (period === "year") {
            startDate = new Date(
                now.getFullYear(),
                0,
                1
            );
        } else {
            /*
             * DEFAULT = 30 HARI
             */
            startDate.setDate(
                startDate.getDate() - 29
            );
        }

        /*
         * Set awal hari.
         */

        startDate.setHours(
            0,
            0,
            0,
            0
        );

        /*
         * ==========================================
         * BASIC COUNTS
         * ==========================================
         */

        const [
            totalProducts,
            totalCustomers,
            totalOrders,
        ] = await Promise.all([
            prisma.product.count(),

            prisma.user.count({
                where: {
                    role: "CUSTOMER",
                },
            }),

            prisma.order.count(),
        ]);

        /*
         * ==========================================
         * PERIOD ORDERS
         * ==========================================
         *
         * Semua order pada periode.
         */

        const periodOrders =
            await prisma.order.findMany({
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: now,
                    },
                },

                select: {
                    id: true,
                    orderNumber: true,
                    total: true,
                    subtotal: true,
                    shippingCost: true,
                    status: true,
                    paymentStatus: true,
                    paymentMethod: true,
                    createdAt: true,
                },

                orderBy: {
                    createdAt: "desc",
                },
            });

        /*
         * ==========================================
         * VALID SALES
         * ==========================================
         *
         * Untuk sementara omzet hanya dihitung
         * dari pembayaran yang sudah PAID.
         */

        const paidOrders =
            periodOrders.filter(
                (order) =>
                    order.paymentStatus ===
                    "PAID"
            );

        /*
         * ==========================================
         * REVENUE
         * ==========================================
         */

        const revenue =
            paidOrders.reduce(
                (total, order) =>
                    total +
                    Number(order.total),
                0
            );

        const paidSubtotal =
            paidOrders.reduce(
                (total, order) =>
                    total +
                    Number(order.subtotal),
                0
            );

        const paidShipping =
            paidOrders.reduce(
                (total, order) =>
                    total +
                    Number(order.shippingCost),
                0
            );

        /*
         * ==========================================
         * ORDER COUNT
         * ==========================================
         */

        const periodOrderCount =
            periodOrders.length;

        const paidOrderCount =
            paidOrders.length;

        /*
         * ==========================================
         * ORDER STATUS
         * ==========================================
         */

        const orderStatus = {
            PENDING: 0,
            PAID: 0,
            PROCESSING: 0,
            SHIPPED: 0,
            COMPLETED: 0,
            CANCELLED: 0,
        };

        for (const order of periodOrders) {
            if (
                order.status in
                orderStatus
            ) {
                orderStatus[
                    order.status as keyof typeof orderStatus
                ]++;
            }
        }

        /*
         * ==========================================
         * PAYMENT METHOD
         * ==========================================
         */

        const paymentMethod = {
            COD: 0,
            BANK_TRANSFER: 0,
            E_WALLET: 0,
            QRIS: 0,
        };

        for (const order of periodOrders) {
            if (
                order.paymentMethod in
                paymentMethod
            ) {
                paymentMethod[
                    order.paymentMethod as keyof typeof paymentMethod
                ]++;
            }
        }

        /*
         * ==========================================
         * DAILY SALES
         * ==========================================
         *
         * Dipakai oleh grafik.
         *
         * Hanya order PAID yang masuk revenue.
         */

        const dailyMap =
            new Map<
                string,
                {
                    date: string;
                    revenue: number;
                    orders: number;
                }
            >();

        /*
         * Generate semua tanggal dahulu supaya
         * hari tanpa transaksi tetap muncul
         * di grafik dengan nilai 0.
         */

        const cursor =
            new Date(startDate);

        while (
            cursor <= now
        ) {
            const key =
                formatDate(cursor);

            dailyMap.set(key, {
                date: key,
                revenue: 0,
                orders: 0,
            });

            cursor.setDate(
                cursor.getDate() + 1
            );
        }

        for (const order of paidOrders) {
            const key =
                formatDate(
                    order.createdAt
                );

            const current =
                dailyMap.get(key);

            if (!current) {
                continue;
            }

            current.revenue +=
                Number(order.total);

            current.orders += 1;
        }

        const dailySales =
            Array.from(
                dailyMap.values()
            );

        /*
         * ==========================================
         * TOP PRODUCTS
         * ==========================================
         *
         * Ambil OrderItem dari order yang
         * paymentStatus = PAID.
         */

        const paidOrderIds =
            paidOrders.map(
                (order) => order.id
            );

        const orderItems =
            paidOrderIds.length > 0
                ? await prisma.orderItem.findMany(
                    {
                        where: {
                            orderId: {
                                in: paidOrderIds,
                            },
                        },

                        select: {
                            productId: true,
                            variantId: true,
                            productName: true,
                            variantName: true,
                            price: true,
                            quantity: true,
                            subtotal: true,
                        },
                    }
                )
                : [];

        const productMap =
            new Map<
                number,
                {
                    productId: number;
                    productName: string;
                    quantity: number;
                    revenue: number;
                }
            >();

        for (const item of orderItems) {
            if (item.productId === null) {
                continue;
            }
            const existing =
                productMap.get(
                    item.productId
                );

            if (existing) {
                existing.quantity +=
                    item.quantity;

                existing.revenue +=
                    Number(
                        item.subtotal
                    );
            } else {
                productMap.set(
                    item.productId,
                    {
                        productId:
                            item.productId,

                        productName:
                            item.productName,

                        quantity:
                            item.quantity,

                        revenue:
                            Number(
                                item.subtotal
                            ),
                    }
                );
            }
        }

        const topProducts =
            Array.from(
                productMap.values()
            )
                .sort(
                    (a, b) =>
                        b.quantity -
                        a.quantity
                )
                .slice(0, 10);

        /*
         * ==========================================
         * RECENT ORDERS
         * ==========================================
         */

        const recentOrders =
            await prisma.order.findMany({
                orderBy: {
                    createdAt: "desc",
                },

                take: 10,

                select: {
                    id: true,
                    orderNumber: true,
                    recipientName: true,
                    total: true,
                    status: true,
                    paymentStatus: true,
                    paymentMethod: true,
                    createdAt: true,

                    items: {
                        take: 1,

                        select: {
                            productName: true,
                            variantName: true,
                            quantity: true,
                        },
                    },
                },
            });

        /*
         * ==========================================
         * FLASH SALES & CAMPAIGNS SUMMARY
         * ==========================================
         */

        const [activeFlashSales, activeCampaigns] = await Promise.all([
            prisma.flashSale.findMany({
                where: {
                    isActive: true,
                    startAt: { lte: now },
                    endAt: { gte: now },
                    saleStock: { gt: 0 },
                },
                select: {
                    id: true,
                    name: true,
                    saleStock: true,
                    soldCount: true,
                    endAt: true,
                },
                orderBy: { endAt: "asc" },
                take: 10,
            }),
            prisma.campaign.findMany({
                where: {
                    status: "ACTIVE",
                    startAt: { lte: now },
                    endAt: { gte: now },
                },
                select: {
                    id: true,
                    name: true,
                    type: true,
                    endAt: true,
                },
                orderBy: { endAt: "asc" },
                take: 10,
            }),
        ]);

        const pendingOrders = await prisma.order.count({
            where: { status: "PENDING" },
        });

        const failedPayments = await prisma.order.count({
            where: { paymentStatus: "FAILED" },
        });

        /*
         * ==========================================
         * RESPONSE
         * ==========================================
         */

        return NextResponse.json({
            success: true,

            data: {
                period,

                periodStart:
                    startDate.toISOString(),

                periodEnd:
                    now.toISOString(),

                summary: {
                    totalProducts,

                    totalCustomers,

                    totalOrders,

                    periodOrderCount,

                    paidOrderCount,

                    revenue,

                    paidSubtotal,

                    paidShipping,

                    pendingOrders,

                    failedPayments,

                    activeFlashSalesCount: activeFlashSales.length,

                    activeCampaignsCount: activeCampaigns.length,
                },

                activeFlashSales,

                activeCampaigns,

                dailySales,

                orderStatus,

                paymentMethod,

                topProducts,

                recentOrders,
            },
        });
    } catch (error) {
        console.error(
            "ADMIN DASHBOARD ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil data dashboard.",
            },
            { status: 500 }
        );
    }
}

/*
 * ==========================================
 * FORMAT DATE
 * ==========================================
 *
 * Menghasilkan:
 *
 * YYYY-MM-DD
 *
 * berdasarkan local date server.
 */

function formatDate(
    date: Date
) {
    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}