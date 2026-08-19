import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

type Period = "7d" | "30d" | "90d" | "all";

function getPeriodStart(period: Period) {
    const now = new Date();

    if (period === "7d") {
        return new Date(
            now.getTime() -
            7 * 24 * 60 * 60 * 1000
        );
    }

    if (period === "30d") {
        return new Date(
            now.getTime() -
            30 * 24 * 60 * 60 * 1000
        );
    }

    if (period === "90d") {
        return new Date(
            now.getTime() -
            90 * 24 * 60 * 60 * 1000
        );
    }

    return null;
}

function formatRupiah(value: number) {
    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
        }
    ).format(value);
}

function formatDate(
    value: Date
) {
    return new Intl.DateTimeFormat(
        "id-ID",
        {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Jakarta",
        }
    ).format(value);
}

export async function GET(
    request: Request
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
                    message:
                        "Unauthorized.",
                },
                {
                    status: 401,
                }
            );
        }

        /*
         * ==========================================
         * ADMIN ONLY
         * ==========================================
         */

        if (
            session.user.role !==
            "ADMIN"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Akses hanya untuk admin.",
                },
                {
                    status: 403,
                }
            );
        }

        /*
         * ==========================================
         * PERIOD
         * ==========================================
         */

        const { searchParams } =
            new URL(request.url);

        const requestedPeriod =
            searchParams.get(
                "period"
            );

        const period: Period =
            requestedPeriod ===
                "30d" ||
                requestedPeriod ===
                "90d" ||
                requestedPeriod ===
                "all"
                ? requestedPeriod
                : "7d";

        const periodStart =
            getPeriodStart(period);

        const periodEnd =
            new Date();

        const where = periodStart
            ? {
                createdAt: {
                    gte: periodStart,
                    lte: periodEnd,
                },
            }
            : {};

        /*
         * ==========================================
         * GET ORDERS
         * ==========================================
         */

        const orders =
            await prisma.order.findMany({
                where,

                orderBy: {
                    createdAt:
                        "desc",
                },

                include: {
                    items: true,
                },
            });

        /*
         * ==========================================
         * SUMMARY
         * ==========================================
         */

        const paidOrders =
            orders.filter(
                (order) =>
                    order.paymentStatus ===
                    "PAID"
            );

        const revenue =
            paidOrders.reduce(
                (
                    total,
                    order
                ) =>
                    total +
                    Number(
                        order.total
                    ),
                0
            );

        const paidSubtotal =
            paidOrders.reduce(
                (
                    total,
                    order
                ) =>
                    total +
                    Number(
                        order.subtotal
                    ),
                0
            );

        const paidShipping =
            paidOrders.reduce(
                (
                    total,
                    order
                ) =>
                    total +
                    Number(
                        order.shippingCost
                    ),
                0
            );

        /*
         * ==========================================
         * PRODUCT SALES
         * ==========================================
         */

        const productMap =
            new Map<
                number,
                {
                    productName: string;
                    quantity: number;
                    revenue: number;
                }
            >();

        for (const order of paidOrders) {
            for (const item of order.items) {
                /*
                 * productId bisa null karena relasi
                 * product -> order item kemungkinan optional.
                 *
                 * Untuk laporan produk terjual,
                 * item tanpa productId kita skip.
                 */
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
        }

        const topProducts =
            Array.from(
                productMap.entries()
            )
                .map(
                    ([
                        productId,
                        item,
                    ]) => ({
                        productId,
                        ...item,
                    })
                )
                .sort(
                    (a, b) =>
                        b.revenue -
                        a.revenue
                );

        /*
         * ==========================================
         * SHEET 1
         * RINGKASAN
         * ==========================================
         */

        const summaryRows = [
            {
                "Laporan":
                    "Laporan Penjualan",

                "Periode":
                    period,

                "Mulai":
                    periodStart
                        ? formatDate(
                            periodStart
                        )
                        : "Semua",

                "Sampai":
                    formatDate(
                        periodEnd
                    ),
            },

            {},

            {
                "Metrik":
                    "Total Pesanan",

                "Nilai":
                    orders.length,
            },

            {
                "Metrik":
                    "Pesanan Dibayar",

                "Nilai":
                    paidOrders.length,
            },

            {
                "Metrik":
                    "Revenue",

                "Nilai":
                    revenue,
            },

            {
                "Metrik":
                    "Subtotal Produk",

                "Nilai":
                    paidSubtotal,
            },

            {
                "Metrik":
                    "Total Pengiriman",

                "Nilai":
                    paidShipping,
            },
        ];

        /*
         * ==========================================
         * SHEET 2
         * DETAIL PESANAN
         * ==========================================
         */

        const orderRows =
            orders.flatMap(
                (order) => {
                    if (
                        order.items
                            .length ===
                        0
                    ) {
                        return [
                            {
                                "ID":
                                    order.id,

                                "Nomor Pesanan":
                                    order.orderNumber,

                                "Tanggal":
                                    formatDate(
                                        order.createdAt
                                    ),

                                "Customer":
                                    order.recipientName,

                                "Status":
                                    order.status,

                                "Status Pembayaran":
                                    order.paymentStatus,

                                "Metode Pembayaran":
                                    order.paymentMethod,

                                "Produk":
                                    "-",

                                "Variant":
                                    "-",

                                "Quantity":
                                    0,

                                "Harga":
                                    0,

                                "Subtotal Item":
                                    0,

                                "Subtotal Pesanan":
                                    Number(
                                        order.subtotal
                                    ),

                                "Ongkir":
                                    Number(
                                        order.shippingCost
                                    ),

                                "Total":
                                    Number(
                                        order.total
                                    ),
                            },
                        ];
                    }

                    return order.items.map(
                        (item) => ({
                            "ID":
                                order.id,

                            "Nomor Pesanan":
                                order.orderNumber,

                            "Tanggal":
                                formatDate(
                                    order.createdAt
                                ),

                            "Customer":
                                order.recipientName,

                            "Status":
                                order.status,

                            "Status Pembayaran":
                                order.paymentStatus,

                            "Metode Pembayaran":
                                order.paymentMethod,

                            "Produk":
                                item.productName,

                            "Variant":
                                item.variantName,

                            "Quantity":
                                item.quantity,

                            "Harga":
                                Number(
                                    item.price
                                ),

                            "Subtotal Item":
                                Number(
                                    item.subtotal
                                ),

                            "Subtotal Pesanan":
                                Number(
                                    order.subtotal
                                ),

                            "Ongkir":
                                Number(
                                    order.shippingCost
                                ),

                            "Total":
                                Number(
                                    order.total
                                ),
                        })
                    );
                }
            );

        /*
         * ==========================================
         * SHEET 3
         * PRODUK TERJUAL
         * ==========================================
         */

        const productRows =
            topProducts.map(
                (product, index) => ({
                    "Ranking":
                        index + 1,

                    "Product ID":
                        product.productId,

                    "Produk":
                        product.productName,

                    "Quantity Terjual":
                        product.quantity,

                    "Revenue":
                        product.revenue,
                })
            );

        /*
         * ==========================================
         * SHEET 4
         * STATUS PESANAN
         * ==========================================
         */

        const statusMap =
            new Map<
                string,
                number
            >();

        for (
            const order of orders
        ) {
            statusMap.set(
                order.status,
                (statusMap.get(
                    order.status
                ) ?? 0) + 1
            );
        }

        const statusRows =
            Array.from(
                statusMap.entries()
            ).map(
                ([
                    status,
                    count,
                ]) => ({
                    "Status":
                        status,

                    "Jumlah":
                        count,
                })
            );

        /*
         * ==========================================
         * SHEET 5
         * PEMBAYARAN
         * ==========================================
         */

        const paymentMap =
            new Map<
                string,
                number
            >();

        for (
            const order of orders
        ) {
            paymentMap.set(
                order.paymentMethod,
                (paymentMap.get(
                    order.paymentMethod
                ) ?? 0) + 1
            );
        }

        const paymentRows =
            Array.from(
                paymentMap.entries()
            ).map(
                ([
                    method,
                    count,
                ]) => ({
                    "Metode Pembayaran":
                        method,

                    "Jumlah Pesanan":
                        count,
                })
            );

        /*
         * ==========================================
         * CREATE WORKBOOK
         * ==========================================
         */

        const workbook =
            XLSX.utils.book_new();

        /*
         * SUMMARY
         */

        const summarySheet =
            XLSX.utils.json_to_sheet(
                summaryRows
            );

        XLSX.utils.book_append_sheet(
            workbook,
            summarySheet,
            "Ringkasan"
        );

        /*
         * ORDERS
         */

        const orderSheet =
            XLSX.utils.json_to_sheet(
                orderRows
            );

        XLSX.utils.book_append_sheet(
            workbook,
            orderSheet,
            "Pesanan"
        );

        /*
         * PRODUCTS
         */

        const productSheet =
            XLSX.utils.json_to_sheet(
                productRows
            );

        XLSX.utils.book_append_sheet(
            workbook,
            productSheet,
            "Produk Terjual"
        );

        /*
         * STATUS
         */

        const statusSheet =
            XLSX.utils.json_to_sheet(
                statusRows
            );

        XLSX.utils.book_append_sheet(
            workbook,
            statusSheet,
            "Status Pesanan"
        );

        /*
         * PAYMENT
         */

        const paymentSheet =
            XLSX.utils.json_to_sheet(
                paymentRows
            );

        XLSX.utils.book_append_sheet(
            workbook,
            paymentSheet,
            "Pembayaran"
        );

        /*
         * ==========================================
         * COLUMN WIDTH
         * ==========================================
         */

        const sheets = [
            {
                sheet:
                    summarySheet,
                widths: [
                    25,
                    25,
                    25,
                    25,
                ],
            },

            {
                sheet:
                    orderSheet,
                widths: [
                    8,
                    30,
                    22,
                    25,
                    15,
                    20,
                    20,
                    40,
                    25,
                    12,
                    15,
                    18,
                    20,
                    18,
                    18,
                ],
            },

            {
                sheet:
                    productSheet,
                widths: [
                    10,
                    12,
                    50,
                    18,
                    20,
                ],
            },

            {
                sheet:
                    statusSheet,
                widths: [
                    20,
                    15,
                ],
            },

            {
                sheet:
                    paymentSheet,
                widths: [
                    25,
                    20,
                ],
            },
        ];

        for (
            const {
                sheet,
                widths,
            } of sheets
        ) {
            sheet["!cols"] =
                widths.map(
                    (wch) => ({
                        wch,
                    })
                );
        }

        /*
         * ==========================================
         * GENERATE EXCEL
         * ==========================================
         */

        const buffer =
            XLSX.write(
                workbook,
                {
                    type: "buffer",
                    bookType: "xlsx",
                }
            );

        const filename =
            `laporan-penjualan-${period}-${new Date()
                .toISOString()
                .slice(0, 10)}.xlsx`;

        return new NextResponse(
            buffer,
            {
                status: 200,

                headers: {
                    "Content-Type":
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

                    "Content-Disposition":
                        `attachment; filename="${filename}"`,

                    "Cache-Control":
                        "no-store",
                },
            }
        );
    } catch (error) {
        console.error(
            "ADMIN EXCEL REPORT ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal membuat laporan Excel.",
            },
            {
                status: 500,
            }
        );
    }
}