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
    return `Rp ${Number(value).toLocaleString("id-ID")}`;
}

function date(value: string) {
    return new Date(value).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
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

function statusClass(status: string) {
    switch (status) {
        case "PENDING":
            return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200";

        case "PROCESSING":
            return "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200";

        case "SHIPPED":
            return "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200";

        case "DELIVERED":
            return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200";

        case "CANCELLED":
            return "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200";

        default:
            return "bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-200";
    }
}

function paymentStatusClass(status: string) {
    switch (status) {
        case "PAID":
            return "text-emerald-600";

        case "PENDING":
            return "text-amber-600";

        case "FAILED":
        case "EXPIRED":
            return "text-red-600";

        default:
            return "text-gray-500";
    }
}
function paymentStatusLabel(status: string) {
    switch (status) {
        case "PAID":
            return "Lunas";

        case "PENDING":
            return "Menunggu";

        case "FAILED":
            return "Gagal";

        case "EXPIRED":
            return "Kadaluarsa";

        case "CANCELLED":
            return "Dibatalkan";

        default:
            return status;
    }
}

export default function AdminOrdersPage() {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [paymentFilter, setPaymentFilter] = useState("ALL");
    const [courierFilter, setCourierFilter] = useState("ALL");
    const [dateFilter, setDateFilter] = useState("ALL");
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

    const pendingCount =
        orders.filter(
            (order) =>
                order.status === "PENDING"
        ).length;

    const processingCount =
        orders.filter(
            (order) =>
                order.status === "PROCESSING"
        ).length;

    const completedCount =
        orders.filter(
            (order) =>
                order.status === "DELIVERED"
        ).length;

    const filteredOrders = orders.filter((order) => {
        const keyword = search.trim().toLowerCase();

        if (keyword) {
            const searchableText = [
                order.orderNumber,
                order.user?.name,
                order.user?.email,
                order.user?.phone,
                order.recipientName,
                order.phone,
                order.trackingNumber,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            if (!searchableText.includes(keyword)) {
                return false;
            }
        }

        if (
            statusFilter !== "ALL" &&
            order.status !== statusFilter
        ) {
            return false;
        }

        if (
            paymentFilter !== "ALL" &&
            order.paymentStatus !== paymentFilter
        ) {
            return false;
        }

        if (
            courierFilter !== "ALL" &&
            order.shippingCourier !== courierFilter
        ) {
            return false;
        }

        if (dateFilter !== "ALL") {
            const orderDate = new Date(order.createdAt);
            const now = new Date();

            if (dateFilter === "TODAY") {
                const start = new Date(now);
                start.setHours(0, 0, 0, 0);

                if (orderDate < start) {
                    return false;
                }
            }

            if (dateFilter === "7_DAYS") {
                const start = new Date(now);
                start.setDate(start.getDate() - 7);

                if (orderDate < start) {
                    return false;
                }
            }

            if (dateFilter === "30_DAYS") {
                const start = new Date(now);
                start.setDate(start.getDate() - 30);

                if (orderDate < start) {
                    return false;
                }
            }
        }

        return true;
    });
    const couriers = Array.from(
        new Set(
            orders
                .map(
                    (order) =>
                        order.shippingCourier
                )
                .filter(Boolean)
        )
    );

    if (loading) {
        return (
            <div className="p-4 sm:p-6">
                <div className="h-7 w-32 animate-pulse rounded-md bg-gray-200" />

                <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-100" />

                <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {Array.from({
                        length: 4,
                    }).map((_, index) => (
                        <div
                            key={index}
                            className="h-24 animate-pulse rounded-xl border border-gray-100 bg-white"
                        />
                    ))}
                </div>

                <div className="mt-6 h-80 animate-pulse rounded-xl border border-gray-100 bg-white" />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6">
            {/* HEADER */}
            <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
                    Pesanan
                </h1>

                <p className="text-sm text-gray-500">
                    Kelola pesanan customer dan
                    pantau proses pengirimannya.
                </p>
            </div>

            {/* SUMMARY */}
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-4">
                    <p className="text-xs font-medium text-gray-500">
                        Total Pesanan
                    </p>

                    <p className="mt-2 text-xl font-semibold text-gray-900">
                        {orders.length}
                    </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white px-4 py-4">
                    <p className="text-xs font-medium text-gray-500">
                        Menunggu
                    </p>

                    <p className="mt-2 text-xl font-semibold text-amber-600">
                        {pendingCount}
                    </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white px-4 py-4">
                    <p className="text-xs font-medium text-gray-500">
                        Diproses
                    </p>

                    <p className="mt-2 text-xl font-semibold text-blue-600">
                        {processingCount}
                    </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white px-4 py-4">
                    <p className="text-xs font-medium text-gray-500">
                        Selesai
                    </p>

                    <p className="mt-2 text-xl font-semibold text-emerald-600">
                        {completedCount}
                    </p>
                </div>
            </div>

            {/* TABLE */}
            <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-5 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900">
                                Semua Pesanan
                            </h2>

                            <p className="mt-0.5 text-xs text-gray-500">
                                Menampilkan {filteredOrders.length} dari{" "}
                                {orders.length} pesanan
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setSearch("");
                                setStatusFilter("ALL");
                                setPaymentFilter("ALL");
                                setCourierFilter("ALL");
                                setDateFilter("ALL");
                            }}
                            className="self-start text-xs font-medium text-gray-500 hover:text-gray-900 lg:self-auto"
                        >
                            Reset filter
                        </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        {/* SEARCH */}
                        <div className="relative lg:col-span-2">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                ⌕
                            </span>

                            <input
                                type="text"
                                value={search}
                                onChange={(e) =>
                                    setSearch(e.target.value)
                                }
                                placeholder="Cari pesanan, customer, email..."
                                className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400"
                            />
                        </div>

                        {/* STATUS */}
                        <select
                            value={statusFilter}
                            onChange={(e) =>
                                setStatusFilter(e.target.value)
                            }
                            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-400"
                        >
                            <option value="ALL">
                                Semua status
                            </option>

                            <option value="PENDING">
                                Pending
                            </option>

                            <option value="PAID">
                                Dibayar
                            </option>

                            <option value="PROCESSING">
                                Diproses
                            </option>

                            <option value="SHIPPED">
                                Dikirim
                            </option>

                            <option value="COMPLETED">
                                Selesai
                            </option>

                            <option value="CANCELLED">
                                Dibatalkan
                            </option>
                        </select>

                        {/* PAYMENT */}
                        <select
                            value={paymentFilter}
                            onChange={(e) =>
                                setPaymentFilter(e.target.value)
                            }
                            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-400"
                        >
                            <option value="ALL">
                                Semua pembayaran
                            </option>

                            <option value="PAID">
                                Lunas
                            </option>

                            <option value="PENDING">
                                Menunggu
                            </option>

                            <option value="FAILED">
                                Gagal
                            </option>

                            <option value="EXPIRED">
                                Kadaluarsa
                            </option>

                            <option value="CANCELLED">
                                Dibatalkan
                            </option>
                        </select>

                        {/* COURIER */}
                        <select
                            value={courierFilter}
                            onChange={(e) =>
                                setCourierFilter(e.target.value)
                            }
                            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-400"
                        >
                            <option value="ALL">
                                Semua kurir
                            </option>

                            {couriers.map((courier) => (
                                <option
                                    key={courier}
                                    value={courier!}
                                >
                                    {courier}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* DATE FILTER */}
                    <div className="mt-2 flex flex-wrap gap-2">
                        {[
                            ["ALL", "Semua waktu"],
                            ["TODAY", "Hari ini"],
                            ["7_DAYS", "7 hari terakhir"],
                            ["30_DAYS", "30 hari terakhir"],
                        ].map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() =>
                                    setDateFilter(value)
                                }
                                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${dateFilter === value
                                    ? "border-gray-900 bg-gray-900 text-white"
                                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1050px] text-left">
                        <thead className="border-b border-gray-100 bg-gray-50/70">
                            <tr>
                                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    Pesanan
                                </th>

                                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    Customer
                                </th>

                                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    Produk
                                </th>

                                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    Pembayaran
                                </th>

                                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    Total
                                </th>

                                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    Status
                                </th>

                                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    Tanggal
                                </th>

                                <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    Aksi
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                            {filteredOrders.map(
                                (order) => (
                                    <tr
                                        key={
                                            order.id
                                        }
                                        className="group transition-colors hover:bg-gray-50/70"
                                    >
                                        {/* ORDER */}
                                        <td className="px-5 py-4 align-top">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">
                                                    {
                                                        order.orderNumber
                                                    }
                                                </p>

                                                <p className="mt-1 text-[11px] text-gray-400">
                                                    #
                                                    {
                                                        order.id
                                                    }
                                                </p>
                                            </div>
                                        </td>

                                        {/* CUSTOMER */}
                                        <td className="px-5 py-4 align-top">
                                            <div className="max-w-[180px]">
                                                <p className="truncate text-sm font-medium text-gray-900">
                                                    {order
                                                        .user
                                                        ?.name ??
                                                        order.recipientName}
                                                </p>

                                                <p className="mt-1 truncate text-xs text-gray-500">
                                                    {order
                                                        .user
                                                        ?.phone ??
                                                        order.phone}
                                                </p>

                                                {order
                                                    .user
                                                    ?.email && (
                                                        <p className="mt-0.5 truncate text-xs text-gray-400">
                                                            {
                                                                order
                                                                    .user
                                                                    .email
                                                            }
                                                        </p>
                                                    )}
                                            </div>
                                        </td>

                                        {/* PRODUCTS */}
                                        <td className="px-5 py-4 align-top">
                                            <div className="max-w-[220px] space-y-1.5">
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
                                                                className="flex items-start justify-between gap-3"
                                                            >
                                                                <p className="truncate text-sm text-gray-700">
                                                                    {
                                                                        item.productName
                                                                    }
                                                                </p>

                                                                <span className="shrink-0 text-xs text-gray-400">
                                                                    ×
                                                                    {
                                                                        item.quantity
                                                                    }
                                                                </span>
                                                            </div>
                                                        )
                                                    )}

                                                {order
                                                    .items
                                                    .length >
                                                    2 && (
                                                        <p className="text-[11px] text-gray-400">
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

                                        {/* PAYMENT */}
                                        <td className="px-5 py-4 align-top">
                                            <p className="text-sm font-medium text-gray-800">
                                                {
                                                    order.paymentMethod
                                                }
                                            </p>

                                            <p
                                                className={`mt-1 text-xs font-medium ${paymentStatusClass(
                                                    order.paymentStatus
                                                )}`}
                                            >
                                                {
                                                    order.paymentStatus
                                                }
                                            </p>
                                        </td>

                                        {/* TOTAL */}
                                        <td className="px-5 py-4 align-top">
                                            <p className="whitespace-nowrap text-sm font-semibold text-gray-900">
                                                {rupiah(
                                                    order.total
                                                )}
                                            </p>
                                        </td>

                                        {/* STATUS */}
                                        <td className="px-5 py-4 align-top">
                                            <span
                                                className={`inline-flex whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                                                    order.status
                                                )}`}
                                            >
                                                {statusLabel(
                                                    order.status
                                                )}
                                            </span>
                                        </td>

                                        {/* DATE */}
                                        <td className="px-5 py-4 align-top">
                                            <p className="whitespace-nowrap text-xs text-gray-500">
                                                {date(
                                                    order.createdAt
                                                )}
                                            </p>
                                        </td>

                                        {/* ACTION */}
                                        <td className="px-5 py-4 text-right align-top">
                                            <Link
                                                href={`/admin/orders/${order.id}`}
                                                className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
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

                {/* EMPTY */}
                {filteredOrders.length === 0 && (
                    <div className="border-t border-gray-100 px-6 py-14 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                            <span className="text-lg">
                                {orders.length === 0 ? "—" : "⌕"}
                            </span>
                        </div>

                        <p className="mt-4 text-sm font-medium text-gray-900">
                            {orders.length === 0
                                ? "Belum ada pesanan"
                                : "Pesanan tidak ditemukan"}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                            {orders.length === 0
                                ? "Pesanan yang berhasil checkout akan muncul di halaman ini."
                                : "Coba ubah kata pencarian atau filter yang digunakan."}
                        </p>

                        {orders.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch("");
                                    setStatusFilter("ALL");
                                    setPaymentFilter("ALL");
                                    setCourierFilter("ALL");
                                    setDateFilter("ALL");
                                }}
                                className="mt-4 text-xs font-medium text-gray-900 underline underline-offset-4"
                            >
                                Bersihkan filter
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}