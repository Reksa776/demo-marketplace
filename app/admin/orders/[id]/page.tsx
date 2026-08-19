"use client";

import { OrderItem } from "@prisma/client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type Order = {
    id: number;
    orderNumber: string;

    recipientName: string;
    phone: string;
    address: string;

    note: string | null;

    city: string | null;
    district: string | null;
    province: string | null;
    postalCode: string | null;

    latitude: number | null;
    longitude: number | null;

    shippingCourier: string | null;
    shippingService: string | null;

    trackingNumber: string | null;
    trackingUrl: string | null;
    paymentStatus: string;
    paidAt: string | null;

    subtotal: number;
    shippingCost: number;
    total: number;

    status: string;
    paymentMethod: string;

    createdAt: string;
    updatedAt: string;

    items: OrderItem[];
};

type TrackingManifest = {
    manifest_code: string;
    manifest_description: string;
    manifest_date: string;
    manifest_time: string;
    city_name: string;
    title: string;
};

type TrackingSummary = {
    courier_code: string;
    courier_name: string;
    waybill_number: string;
    service_code: string;
    waybill_date: string;
    shipper_name?: string;
    receiver_name?: string;
    origin: string;
    destination: string;
    status: string;
};

type TrackingDeliveryStatus = {
    status: string;
    pod_receiver?: string;
    pod_date?: string;
    pod_time?: string;
};

type TrackingData = {
    summary?: TrackingSummary;
    details?: unknown;
    deliveryStatus?: TrackingDeliveryStatus;
    manifest: TrackingManifest[];
};

const statuses = [
    "PENDING",
    "PAID",
    "PROCESSING",
    "SHIPPED",
    "COMPLETED",
    "CANCELLED",
];

function statusLabel(status: string) {
    const labels: Record<string, string> = {
        PENDING: "Pending",
        PAID: "Dibayar",
        PROCESSING: "Diproses",
        SHIPPED: "Dikirim",
        COMPLETED: "Selesai",
        CANCELLED: "Dibatalkan",
    };

    return labels[status] ?? status;
}

function rupiah(value: number) {
    return `Rp ${Number(value).toLocaleString("id-ID")}`;
}

function getStatusStyle(status: string) {
    switch (status) {
        case "DELIVERED":
            return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200";

        case "ON DELIVERY":
            return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200";

        default:
            return "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200";
    }
}

export default function AdminOrderDetailPage() {
    const params = useParams();

    const [tracking, setTracking] =
        useState<TrackingData | null>(null);

    const [trackingLoading, setTrackingLoading] =
        useState(false);

    const id = Array.isArray(params.id)
        ? params.id[0]
        : params.id;

    const [order, setOrder] =
        useState<Order | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [status, setStatus] =
        useState("");

    const [trackingNumber, setTrackingNumber] =
        useState("");

    async function loadTracking() {
        if (!order?.id || !order.trackingNumber) {
            setTracking(null);
            return;
        }

        try {
            setTrackingLoading(true);

            const response = await fetch(
                `/api/admin/orders/${order.id}/tracking`,
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const result =
                await response.json();

            console.log(
                "ADMIN TRACKING RESPONSE:",
                result
            );

            if (
                !response.ok ||
                !result.success
            ) {
                throw new Error(
                    result.message ??
                    "Gagal mengambil tracking."
                );
            }

            setTracking({
                summary:
                    result.data?.summary ??
                    undefined,

                details:
                    result.data?.details ??
                    undefined,

                deliveryStatus:
                    result.data?.deliveryStatus ??
                    undefined,

                manifest:
                    Array.isArray(
                        result.data?.manifest
                    )
                        ? result.data.manifest
                        : [],
            });
        } catch (error) {
            console.error(
                "ADMIN TRACKING ERROR:",
                error
            );

            setTracking(null);

            toast.error(
                error instanceof Error
                    ? error.message
                    : "Gagal mengambil tracking."
            );
        } finally {
            setTrackingLoading(false);
        }
    }

    useEffect(() => {
        if (
            order?.id &&
            order.trackingNumber
        ) {
            loadTracking();
        } else {
            setTracking(null);
        }
    }, [
        order?.id,
        order?.trackingNumber,
    ]);

    async function loadOrder() {
        try {
            const response = await fetch(
                `/api/admin/orders/${id}`,
                {
                    cache: "no-store",
                }
            );

            const result =
                await response.json();

            if (
                !response.ok ||
                !result.success
            ) {
                throw new Error(
                    result.message ??
                    "Gagal mengambil order."
                );
            }

            setOrder(result.data);

            setStatus(result.data.status);

            setTrackingNumber(
                result.data.trackingNumber ?? ""
            );
        } catch (error) {
            console.error(error);

            toast.error(
                error instanceof Error
                    ? error.message
                    : "Gagal mengambil order."
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (id) {
            loadOrder();
        }
    }, [id]);

    async function saveOrder() {
        if (
            status === "SHIPPED" &&
            !trackingNumber.trim()
        ) {
            toast.error(
                "Nomor resi wajib diisi sebelum status Dikirim."
            );
            return;
        }

        try {
            setSaving(true);

            const response = await fetch(
                `/api/admin/orders/${id}`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body: JSON.stringify({
                        status,
                        trackingNumber:
                            trackingNumber.trim(),
                    }),
                }
            );

            const result =
                await response.json();

            if (
                !response.ok ||
                !result.success
            ) {
                throw new Error(
                    result.message ??
                    "Gagal memperbarui order."
                );
            }

            toast.success(
                "Pesanan berhasil diperbarui."
            );

            await loadOrder();
        } catch (error) {
            console.error(error);

            toast.error(
                error instanceof Error
                    ? error.message
                    : "Gagal memperbarui order."
            );
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-[#f7f7f8] p-6">
                <div className="mx-auto max-w-6xl">
                    <div className="animate-pulse space-y-5">
                        <div className="h-4 w-32 rounded bg-gray-200" />
                        <div className="h-24 rounded-xl bg-white ring-1 ring-gray-200" />
                        <div className="h-56 rounded-xl bg-white ring-1 ring-gray-200" />
                    </div>
                </div>
            </main>
        );
    }

    if (!order) {
        return (
            <main className="min-h-screen bg-[#f7f7f8] p-6">
                <div className="mx-auto max-w-6xl">
                    <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
                        <p className="text-sm font-medium text-gray-700">
                            Pesanan tidak ditemukan.
                        </p>

                        <Link
                            href="/admin/orders"
                            className="mt-4 inline-flex text-sm font-medium text-rose-600 hover:text-rose-700"
                        >
                            Kembali ke order
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#f7f7f8] p-4 sm:p-6">
            <div className="mx-auto max-w-6xl">

                {/* HEADER */}

                <div className="mb-5">
                    <Link
                        href="/admin/orders"
                        className="inline-flex items-center gap-1 text-sm text-gray-500 transition hover:text-gray-900"
                    >
                        <span>←</span>
                        <span>Kembali ke Orderan</span>
                    </Link>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
                                    {order.orderNumber}
                                </h1>

                                <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyle(
                                        order.status
                                    )}`}
                                >
                                    {statusLabel(
                                        order.status
                                    )}
                                </span>
                            </div>

                            <p className="mt-1.5 text-sm text-gray-500">
                                Detail pesanan dan pengiriman
                            </p>
                        </div>

                        <div className="text-left sm:text-right">
                            <p className="text-xs text-gray-400">
                                Total pesanan
                            </p>

                            <p className="mt-0.5 text-base font-semibold text-gray-900">
                                {rupiah(order.total)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">

                    {/* CONTENT */}

                    <section className="min-w-0 space-y-5">

                        {/* CUSTOMER */}

                        <div className="rounded-xl border border-gray-200 bg-white">
                            <div className="border-b border-gray-100 px-5 py-4">
                                <h2 className="text-sm font-semibold text-gray-900">
                                    Informasi Pembeli
                                </h2>
                            </div>

                            <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
                                <div>
                                    <p className="text-xs text-gray-400">
                                        Penerima
                                    </p>

                                    <p className="mt-1 text-sm font-medium text-gray-900">
                                        {order.recipientName}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-gray-400">
                                        Nomor Telepon
                                    </p>

                                    <p className="mt-1 text-sm font-medium text-gray-900">
                                        {order.phone}
                                    </p>
                                </div>

                                <div className="sm:col-span-2">
                                    <p className="text-xs text-gray-400">
                                        Alamat Pengiriman
                                    </p>

                                    <p className="mt-1 text-sm leading-6 text-gray-700">
                                        {order.address}
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-gray-500">
                                        {[
                                            order.district,
                                            order.city,
                                            order.province,
                                            order.postalCode,
                                        ]
                                            .filter(Boolean)
                                            .join(", ")}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* SHIPPING */}

                        <div className="rounded-xl border border-gray-200 bg-white">
                            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                                <div>
                                    <h2 className="text-sm font-semibold text-gray-900">
                                        Pengiriman
                                    </h2>

                                    <p className="mt-0.5 text-xs text-gray-400">
                                        Informasi layanan yang dipilih customer
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-5 px-5 py-5 sm:grid-cols-3">
                                <div>
                                    <p className="text-xs text-gray-400">
                                        Kurir
                                    </p>

                                    <p className="mt-1 text-sm font-semibold uppercase text-gray-900">
                                        {order.shippingCourier ??
                                            "-"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-gray-400">
                                        Layanan
                                    </p>

                                    <p className="mt-1 text-sm font-medium text-gray-900">
                                        {order.shippingService ??
                                            "-"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-gray-400">
                                        Ongkir
                                    </p>

                                    <p className="mt-1 text-sm font-semibold text-gray-900">
                                        {rupiah(
                                            order.shippingCost
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* TRACKING */}

                        <div className="rounded-xl border border-gray-200 bg-white">

                            <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-sm font-semibold text-gray-900">
                                        Tracking Pengiriman
                                    </h2>

                                    <p className="mt-0.5 text-xs text-gray-400">
                                        Riwayat perjalanan paket
                                    </p>
                                </div>

                                {tracking?.summary?.status && (
                                    <span
                                        className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyle(
                                            tracking.summary.status
                                        )}`}
                                    >
                                        {tracking.summary.status}
                                    </span>
                                )}
                            </div>

                            {/* NO TRACKING NUMBER */}

                            {!order.trackingNumber && (
                                <div className="px-5 py-8">
                                    <div className="border-l-2 border-gray-200 pl-4">
                                        <p className="text-sm font-medium text-gray-700">
                                            Nomor resi belum tersedia
                                        </p>

                                        <p className="mt-1 text-sm leading-5 text-gray-500">
                                            Masukkan nomor resi pada panel
                                            update pesanan untuk melihat
                                            perjalanan paket.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* LOADING */}

                            {order.trackingNumber &&
                                trackingLoading && (
                                    <div className="px-5 py-7">
                                        <p className="text-xs font-medium text-gray-500">
                                            Mengambil data tracking...
                                        </p>

                                        <div className="mt-6 space-y-6">
                                            {Array.from({
                                                length: 4,
                                            }).map(
                                                (_, index) => (
                                                    <div
                                                        key={
                                                            index
                                                        }
                                                        className="flex gap-4"
                                                    >
                                                        <div className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-gray-200" />

                                                        <div className="flex-1">
                                                            <div className="h-3.5 w-3/4 animate-pulse rounded bg-gray-200" />

                                                            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-gray-100" />
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}

                            {/* EMPTY */}

                            {order.trackingNumber &&
                                !trackingLoading &&
                                (!tracking ||
                                    tracking.manifest.length ===
                                    0) && (
                                    <div className="px-5 py-8">
                                        <div className="border-l-2 border-gray-200 pl-4">
                                            <p className="text-sm font-medium text-gray-700">
                                                Riwayat tracking belum tersedia
                                            </p>

                                            <p className="mt-1 text-sm leading-5 text-gray-500">
                                                Data perjalanan paket belum
                                                tersedia dari kurir.
                                            </p>
                                        </div>
                                    </div>
                                )}

                            {/* TRACKING DATA */}

                            {tracking &&
                                !trackingLoading &&
                                tracking.manifest.length >
                                0 && (
                                    <div className="px-5 py-5">

                                        {/* SUMMARY */}

                                        <div className="grid gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 sm:grid-cols-3">
                                            <div className="bg-gray-50 px-4 py-3.5">
                                                <p className="text-[11px] uppercase tracking-wide text-gray-400">
                                                    Asal
                                                </p>

                                                <p className="mt-1 text-sm font-medium text-gray-900">
                                                    {tracking
                                                        .summary
                                                        ?.origin ??
                                                        "-"}
                                                </p>
                                            </div>

                                            <div className="bg-gray-50 px-4 py-3.5">
                                                <p className="text-[11px] uppercase tracking-wide text-gray-400">
                                                    Tujuan
                                                </p>

                                                <p className="mt-1 text-sm font-medium text-gray-900">
                                                    {tracking
                                                        .summary
                                                        ?.destination ??
                                                        "-"}
                                                </p>
                                            </div>

                                            <div className="bg-gray-50 px-4 py-3.5">
                                                <p className="text-[11px] uppercase tracking-wide text-gray-400">
                                                    Status
                                                </p>

                                                <p
                                                    className={`mt-1 text-sm font-semibold ${tracking
                                                        .summary
                                                        ?.status ===
                                                        "DELIVERED"
                                                        ? "text-emerald-600"
                                                        : "text-blue-600"
                                                        }`}
                                                >
                                                    {tracking
                                                        .summary
                                                        ?.status ??
                                                        "-"}
                                                </p>
                                            </div>
                                        </div>

                                        {/* WAYBILL */}

                                        <div className="mt-4 grid gap-4 border-b border-gray-100 pb-5 sm:grid-cols-3">
                                            <div>
                                                <p className="text-xs text-gray-400">
                                                    Kurir
                                                </p>

                                                <p className="mt-1 text-sm font-semibold uppercase text-gray-900">
                                                    {tracking
                                                        .summary
                                                        ?.courier_name ??
                                                        order.shippingCourier ??
                                                        "-"}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-gray-400">
                                                    Nomor Resi
                                                </p>

                                                <p className="mt-1 break-all text-sm font-semibold text-gray-900">
                                                    {tracking
                                                        .summary
                                                        ?.waybill_number ??
                                                        order.trackingNumber ??
                                                        "-"}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-gray-400">
                                                    Layanan
                                                </p>

                                                <p className="mt-1 text-sm font-medium text-gray-900">
                                                    {tracking
                                                        .summary
                                                        ?.service_code ??
                                                        order.shippingService ??
                                                        "-"}
                                                </p>
                                            </div>
                                        </div>

                                        {/* POD */}

                                        {tracking.deliveryStatus
                                            ?.status ===
                                            "DELIVERED" && (
                                                <div className="mt-5 border-l-2 border-emerald-500 bg-emerald-50 px-4 py-3">
                                                    <p className="text-sm font-medium text-emerald-800">
                                                        Paket sudah diterima
                                                    </p>

                                                    {tracking
                                                        .deliveryStatus
                                                        .pod_receiver && (
                                                            <p className="mt-1 text-xs text-emerald-700">
                                                                Diterima oleh{" "}
                                                                {
                                                                    tracking
                                                                        .deliveryStatus
                                                                        .pod_receiver
                                                                }
                                                            </p>
                                                        )}

                                                    {tracking
                                                        .deliveryStatus
                                                        .pod_date && (
                                                            <p className="mt-1 text-xs text-emerald-600">
                                                                {
                                                                    tracking
                                                                        .deliveryStatus
                                                                        .pod_date
                                                                }{" "}
                                                                {
                                                                    tracking
                                                                        .deliveryStatus
                                                                        .pod_time ??
                                                                    ""
                                                                }
                                                            </p>
                                                        )}
                                                </div>
                                            )}

                                        {/* TIMELINE */}

                                        <div className="mt-7">
                                            <div className="mb-5">
                                                <h3 className="text-sm font-semibold text-gray-900">
                                                    Riwayat Perjalanan
                                                </h3>

                                                <p className="mt-0.5 text-xs text-gray-400">
                                                    Status paket dari waktu ke waktu
                                                </p>
                                            </div>

                                            <div>
                                                {[
                                                    ...tracking.manifest,
                                                ]
                                                    .reverse()
                                                    .map(
                                                        (
                                                            item,
                                                            index
                                                        ) => {
                                                            const isLatest =
                                                                index ===
                                                                0;

                                                            const isLast =
                                                                index ===
                                                                tracking
                                                                    .manifest
                                                                    .length -
                                                                1;

                                                            return (
                                                                <div
                                                                    key={`${item.manifest_date}-${item.manifest_time}-${index}`}
                                                                    className="relative flex gap-4"
                                                                >
                                                                    <div className="flex w-5 shrink-0 flex-col items-center">
                                                                        <div
                                                                            className={`relative z-10 mt-0.5 h-3.5 w-3.5 rounded-full border-[3px] ${isLatest
                                                                                ? "border-emerald-500 bg-white"
                                                                                : "border-gray-300 bg-white"
                                                                                }`}
                                                                        />

                                                                        {!isLast && (
                                                                            <div className="w-px flex-1 bg-gray-200" />
                                                                        )}
                                                                    </div>

                                                                    <div
                                                                        className={`min-w-0 flex-1 pb-7 ${isLast
                                                                            ? "pb-1"
                                                                            : ""
                                                                            }`}
                                                                    >
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <p
                                                                                className={`text-sm ${isLatest
                                                                                    ? "font-semibold text-gray-900"
                                                                                    : "font-medium text-gray-700"
                                                                                    }`}
                                                                            >
                                                                                {
                                                                                    item.manifest_description
                                                                                }
                                                                            </p>

                                                                            {isLatest && (
                                                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                                                                                    Terbaru
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-gray-400">
                                                                            {item.city_name && (
                                                                                <span>
                                                                                    {
                                                                                        item.city_name
                                                                                    }
                                                                                </span>
                                                                            )}

                                                                            <span>
                                                                                {
                                                                                    item.manifest_date
                                                                                }{" "}
                                                                                •{" "}
                                                                                {
                                                                                    item.manifest_time
                                                                                }
                                                                            </span>
                                                                        </div>

                                                                        {item.title && (
                                                                            <p className="mt-1.5 text-xs text-gray-500">
                                                                                {
                                                                                    item.title
                                                                                }
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                        </div>
                    </section>

                    {/* SIDEBAR */}

                    <aside className="h-fit lg:sticky lg:top-5">
                        <div className="rounded-xl border border-gray-200 bg-white">

                            <div className="border-b border-gray-100 px-5 py-4">
                                <h2 className="text-sm font-semibold text-gray-900">
                                    Update Pesanan
                                </h2>

                                <p className="mt-0.5 text-xs text-gray-400">
                                    Perbarui status dan nomor resi
                                </p>
                            </div>

                            <div className="space-y-5 px-5 py-5">

                                {/* STATUS */}

                                <div>
                                    <label className="text-xs font-medium text-gray-600">
                                        Status Pesanan
                                    </label>

                                    <select
                                        value={status}
                                        onChange={(e) =>
                                            setStatus(
                                                e.target.value
                                            )
                                        }
                                        className="mt-2 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                                    >
                                        {statuses.map(
                                            (item) => (
                                                <option
                                                    key={
                                                        item
                                                    }
                                                    value={
                                                        item
                                                    }
                                                >
                                                    {statusLabel(
                                                        item
                                                    )}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </div>

                                {/* TRACKING NUMBER */}

                                <div>
                                    <label className="text-xs font-medium text-gray-600">
                                        Nomor Resi
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            trackingNumber
                                        }
                                        onChange={(e) =>
                                            setTrackingNumber(
                                                e.target
                                                    .value
                                            )
                                        }
                                        placeholder="Masukkan nomor resi"
                                        className="mt-2 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                                    />

                                    <p className="mt-2 text-xs leading-5 text-gray-400">
                                        Kurir:{" "}
                                        <span className="font-medium text-gray-600">
                                            {order.shippingCourier?.toUpperCase() ??
                                                "-"}
                                        </span>
                                    </p>
                                </div>

                                {/* SAVE */}

                                <button
                                    type="button"
                                    onClick={
                                        saveOrder
                                    }
                                    disabled={
                                        saving
                                    }
                                    className="h-10 w-full rounded-lg bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {saving
                                        ? "Menyimpan..."
                                        : "Simpan Perubahan"}
                                </button>

                                <p className="text-center text-[11px] leading-4 text-gray-400">
                                    Perubahan status dan resi
                                    akan langsung disimpan.
                                </p>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    );
}