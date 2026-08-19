"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
    FiPackage,
    FiChevronRight,
} from "react-icons/fi";
import toast from "react-hot-toast";

type OrderItem = {
    id: number;
    productName: string;
    variantName: string;
    price: string | number;
    quantity: number;
    subtotal: string | number;
};

type Order = {
    id: number;
    orderNumber: string;

    total: string | number;
    subtotal: string | number;
    shippingCost: string | number;

    status: string;
    paymentMethod: string;
    paymentStatus: string;

    shippingCourier: string | null;
    shippingService: string | null;

    createdAt: string;

    items: OrderItem[];
};

function formatRupiah(value: string | number) {
    return `Rp ${Number(value).toLocaleString(
        "id-ID"
    )}`;
}

function formatDate(value: string) {
    return new Date(value).toLocaleDateString(
        "id-ID",
        {
            day: "2-digit",
            month: "long",
            year: "numeric",
        }
    );
}

function statusLabel(status: string) {
    switch (status) {
        case "PENDING":
            return "Menunggu Diproses";

        case "PROCESSING":
            return "Sedang Diproses";

        case "SHIPPED":
            return "Dikirim";

        case "DELIVERED":
            return "Selesai";

        case "CANCELLED":
            return "Dibatalkan";

        default:
            return status;
    }
}

function paymentStatusLabel(status: string) {
    switch (status) {
        case "PAID":
            return "Sudah Dibayar";

        case "UNPAID":
            return "Belum Dibayar";

        case "PENDING":
            return "Menunggu Pembayaran";

        case "FAILED":
            return "Pembayaran Gagal";

        case "EXPIRED":
            return "Pembayaran Kedaluwarsa";

        default:
            return status;
    }
}

export default function OrdersPage() {
    const [orders, setOrders] =
        useState<Order[]>([]);

    const [loading, setLoading] =
        useState(true);

    async function loadOrders() {
        try {
            setLoading(true);

            const response = await fetch(
                "/api/orders",
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                toast.error(
                    data.message ??
                        "Gagal mengambil pesanan."
                );

                return;
            }

            setOrders(data.data ?? []);
        } catch (error) {
            console.error(error);

            toast.error(
                "Terjadi kesalahan saat mengambil pesanan."
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadOrders();
    }, []);

    if (loading) {
        return (
            <main className="min-h-screen bg-gray-50">
                <div className="mx-auto max-w-5xl px-4 py-8">
                    <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />

                    <div className="mt-6 space-y-4">
                        {[1, 2, 3].map(
                            (item) => (
                                <div
                                    key={item}
                                    className="h-40 animate-pulse rounded-2xl bg-white"
                                />
                            )
                        )}
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen mb-20 bg-gray-50">
            <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Pesanan Saya
                    </h1>

                    <p className="mt-1 text-sm text-gray-500">
                        Lihat semua pesanan yang
                        sudah kamu checkout.
                    </p>
                </div>

                {orders.length === 0 ? (
                    <div className="mt-8 rounded-2xl bg-white p-10 text-center shadow-sm">
                        <FiPackage
                            size={42}
                            className="mx-auto text-gray-400"
                        />

                        <h2 className="mt-4 text-lg font-bold text-gray-900">
                            Belum ada pesanan
                        </h2>

                        <p className="mt-2 text-sm text-gray-500">
                            Pesanan yang berhasil
                            kamu checkout akan
                            muncul di sini.
                        </p>

                        <Link
                            href="/products"
                            className="mt-6 inline-flex rounded-xl bg-rose-600 px-6 py-3 text-sm font-semibold text-white"
                        >
                            Mulai Belanja
                        </Link>
                    </div>
                ) : (
                    <div className="mt-6 space-y-4">
                        {orders.map(
                            (order) => (
                                <Link
                                    key={
                                        order.id
                                    }
                                    href={`/orders/${order.id}`}
                                    className="block rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">
                                                {
                                                    order.orderNumber
                                                }
                                            </p>

                                            <p className="mt-1 text-xs text-gray-500">
                                                {formatDate(
                                                    order.createdAt
                                                )}
                                            </p>
                                        </div>

                                        <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                                            {statusLabel(
                                                order.status
                                            )}
                                        </span>
                                    </div>

                                    <div className="mt-5 border-t border-gray-100 pt-4">
                                        {order.items
                                            .slice(
                                                0,
                                                2
                                            )
                                            .map(
                                                (
                                                    item
                                                ) => (
                                                    <div
                                                        key={
                                                            item.id
                                                        }
                                                        className="flex justify-between gap-4 py-2"
                                                    >
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">
                                                                {
                                                                    item.productName
                                                                }
                                                            </p>

                                                            <p className="text-xs text-gray-500">
                                                                {
                                                                    item.variantName
                                                                }{" "}
                                                                ×{" "}
                                                                {
                                                                    item.quantity
                                                                }
                                                            </p>
                                                        </div>

                                                        <p className="text-sm font-semibold">
                                                            {formatRupiah(
                                                                item.subtotal
                                                            )}
                                                        </p>
                                                    </div>
                                                )
                                            )}

                                        {order.items
                                            .length >
                                            2 && (
                                            <p className="mt-2 text-xs text-gray-500">
                                                +
                                                {order
                                                    .items
                                                    .length -
                                                    2}{" "}
                                                produk
                                                lainnya
                                            </p>
                                        )}
                                    </div>

                                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                                        <div>
                                            <p className="text-xs text-gray-500">
                                                {
                                                    order.paymentMethod
                                                }
                                            </p>

                                            <p className="mt-1 text-xs font-medium text-gray-700">
                                                {paymentStatusLabel(
                                                    order.paymentStatus
                                                )}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="text-xs text-gray-500">
                                                    Total
                                                </p>

                                                <p className="text-base font-bold text-rose-600">
                                                    {formatRupiah(
                                                        order.total
                                                    )}
                                                </p>
                                            </div>

                                            <FiChevronRight
                                                className="text-gray-400"
                                            />
                                        </div>
                                    </div>
                                </Link>
                            )
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}