"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";

type OrderItem = {
    id: number;
    productName: string;
    variantName: string;
    quantity: number;
    price: string | number;
    subtotal: string | number;
};

type OrderUser = {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
};

type Order = {
    id: number;
    orderNumber: string;

    recipientName: string;
    phone: string;

    address: string;
    city: string | null;
    district: string | null;
    province: string | null;
    postalCode: string | null;

    subtotal: string | number;
    shippingCost: string | number;
    total: string | number;

    status: string;
    paymentMethod: string;
    paymentStatus: string;

    shippingCourier: string | null;
    shippingService: string | null;
    trackingNumber: string | null;

    createdAt: string;

    user?: OrderUser | null;

    items: OrderItem[];
};

function rupiah(value: string | number) {
    return `Rp ${Number(value).toLocaleString(
        "id-ID"
    )}`;
}

function date(value: string) {
    return new Date(value).toLocaleString(
        "id-ID"
    );
}

function statusLabel(status: string) {
    switch (status) {
        case "PENDING":
            return "Pending";

        case "PROCESSING":
            return "Diproses";

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

export default function AdminOrdersPage() {
    const [orders, setOrders] =
        useState<Order[]>([]);

    const [loading, setLoading] =
        useState(true);

    async function loadOrders() {
        try {
            setLoading(true);

            const response = await fetch(
                "/api/admin/orders",
                {
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
                "Terjadi kesalahan."
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
            <div className="p-6">
                <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />

                <div className="mt-6 h-64 animate-pulse rounded-2xl bg-gray-100" />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Pesanan
                </h1>

                <p className="mt-1 text-sm text-gray-500">
                    Semua pesanan customer yang
                    sudah berhasil checkout.
                </p>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px] text-left">
                        <thead className="border-b bg-gray-50">
                            <tr>
                                <th className="px-5 py-4 text-xs font-semibold uppercase text-gray-500">
                                    Pesanan
                                </th>

                                <th className="px-5 py-4 text-xs font-semibold uppercase text-gray-500">
                                    Customer
                                </th>

                                <th className="px-5 py-4 text-xs font-semibold uppercase text-gray-500">
                                    Produk
                                </th>

                                <th className="px-5 py-4 text-xs font-semibold uppercase text-gray-500">
                                    Pembayaran
                                </th>

                                <th className="px-5 py-4 text-xs font-semibold uppercase text-gray-500">
                                    Total
                                </th>

                                <th className="px-5 py-4 text-xs font-semibold uppercase text-gray-500">
                                    Status
                                </th>

                                <th className="px-5 py-4 text-xs font-semibold uppercase text-gray-500">
                                    Tanggal
                                </th>
                                <th className="px-5 py-4 text-xs font-semibold uppercase text-gray-500">
                                    Aksi
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y">
                            {orders.map(
                                (order) => (
                                    <tr
                                        key={
                                            order.id
                                        }
                                        className="hover:bg-gray-50"
                                    >
                                        <td className="px-5 py-4">
                                            <p className="text-sm font-bold text-gray-900">
                                                {
                                                    order.orderNumber
                                                }
                                            </p>

                                            <p className="mt-1 text-xs text-gray-500">
                                                ID #
                                                {
                                                    order.id
                                                }
                                            </p>
                                        </td>

                                        <td className="px-5 py-4">
                                            <p className="text-sm font-semibold text-gray-900">
                                                {order.user?.name ??
                                                    order.recipientName}
                                            </p>

                                            <p className="mt-1 text-xs text-gray-500">
                                                {order.user?.phone ??
                                                    order.phone}
                                            </p>

                                            <p className="text-xs text-gray-500">
                                                {order.user?.email ??
                                                    "-"}
                                            </p>
                                        </td>

                                        <td className="px-5 py-4">
                                            <div className="space-y-1">
                                                {order.items
                                                    .slice(
                                                        0,
                                                        2
                                                    )
                                                    .map(
                                                        (
                                                            item
                                                        ) => (
                                                            <p
                                                                key={
                                                                    item.id
                                                                }
                                                                className="text-sm text-gray-700"
                                                            >
                                                                {
                                                                    item.productName
                                                                }{" "}
                                                                ×{" "}
                                                                {
                                                                    item.quantity
                                                                }
                                                            </p>
                                                        )
                                                    )}

                                                {order
                                                    .items
                                                    .length >
                                                    2 && (
                                                        <p className="text-xs text-gray-400">
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
                                        </td>

                                        <td className="px-5 py-4">
                                            <p className="text-sm font-semibold">
                                                {
                                                    order.paymentMethod
                                                }
                                            </p>

                                            <p className="mt-1 text-xs text-gray-500">
                                                {
                                                    order.paymentStatus
                                                }
                                            </p>
                                        </td>

                                        <td className="px-5 py-4">
                                            <p className="text-sm font-bold text-gray-900">
                                                {rupiah(
                                                    order.total
                                                )}
                                            </p>
                                        </td>

                                        <td className="px-5 py-4">
                                            <span className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                                                {statusLabel(
                                                    order.status
                                                )}
                                            </span>
                                        </td>

                                        <td className="px-5 py-4 text-xs text-gray-500">
                                            {date(
                                                order.createdAt
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <Link
                                                href={`/admin/orders/${order.id}`}
                                                className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-gray-700"
                                            >
                                                Detail
                                            </Link>
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>

                {orders.length === 0 && (
                    <div className="p-10 text-center">
                        <p className="font-semibold text-gray-900">
                            Belum ada pesanan
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                            Pesanan yang berhasil
                            checkout akan muncul
                            di sini.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}