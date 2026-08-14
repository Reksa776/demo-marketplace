"use client";

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
    city: string | null;
    district: string | null;
    province: string | null;
    postalCode: string | null;

    subtotal: number;
    shippingCost: number;
    total: number;

    status: string;
    paymentMethod: string;
    paymentStatus: string;

    shippingCourier: string | null;
    shippingService: string | null;
    trackingNumber: string | null;
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
    return `Rp ${Number(value).toLocaleString(
        "id-ID"
    )}`;
}

export default function AdminOrderDetailPage() {
    const params = useParams();

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
            <main className="p-6">
                Memuat detail pesanan...
            </main>
        );
    }

    if (!order) {
        return (
            <main className="p-6">
                Pesanan tidak ditemukan.
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
            <div className="mx-auto max-w-6xl">

                <Link
                    href="/admin/orders"
                    className="text-sm text-gray-500 hover:text-gray-900"
                >
                    ← Kembali ke Orderan
                </Link>

                <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">

                    {/* DETAIL */}

                    <section className="space-y-6">

                        <div className="rounded-2xl border bg-white p-6">
                            <h1 className="text-2xl font-bold">
                                {order.orderNumber}
                            </h1>

                            <p className="mt-2 text-sm text-gray-500">
                                {order.recipientName}
                            </p>

                            <p className="text-sm text-gray-500">
                                {order.phone}
                            </p>
                        </div>

                        <div className="rounded-2xl border bg-white p-6">
                            <h2 className="text-lg font-bold">
                                Pengiriman
                            </h2>

                            <div className="mt-5 grid gap-4 sm:grid-cols-3">

                                <div>
                                    <p className="text-xs text-gray-500">
                                        Kurir
                                    </p>

                                    <p className="mt-1 font-bold uppercase">
                                        {order.shippingCourier ??
                                            "-"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-gray-500">
                                        Layanan
                                    </p>

                                    <p className="mt-1 font-bold">
                                        {order.shippingService ??
                                            "-"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-gray-500">
                                        Ongkir
                                    </p>

                                    <p className="mt-1 font-bold">
                                        {rupiah(
                                            order.shippingCost
                                        )}
                                    </p>
                                </div>

                            </div>

                            <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
                                Kurir dan layanan dipilih
                                customer saat checkout.
                            </div>
                        </div>

                    </section>

                    {/* EDIT */}

                    <aside className="h-fit rounded-2xl border bg-white p-6 lg:sticky lg:top-6">

                        <h2 className="text-lg font-bold">
                            Update Pesanan
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                            Ubah status dan isi nomor resi.
                        </p>

                        {/* STATUS */}

                        <div className="mt-6">
                            <label className="text-sm font-semibold">
                                Status
                            </label>

                            <select
                                value={status}
                                onChange={(e) =>
                                    setStatus(
                                        e.target.value
                                    )
                                }
                                className="mt-2 h-11 w-full rounded-xl border px-3 text-sm"
                            >
                                {statuses.map(
                                    (item) => (
                                        <option
                                            key={item}
                                            value={item}
                                        >
                                            {statusLabel(
                                                item
                                            )}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        {/* RESI */}

                        <div className="mt-5">
                            <label className="text-sm font-semibold">
                                Nomor Resi
                            </label>

                            <input
                                type="text"
                                value={
                                    trackingNumber
                                }
                                onChange={(e) =>
                                    setTrackingNumber(
                                        e.target.value
                                    )
                                }
                                placeholder="Masukkan nomor resi"
                                className="mt-2 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-rose-500"
                            />

                            <p className="mt-2 text-xs text-gray-500">
                                Kurir otomatis memakai{" "}
                                {order.shippingCourier?.toUpperCase() ??
                                    "-"}
                            </p>
                        </div>

                        {/* SAVE */}

                        <button
                            type="button"
                            onClick={saveOrder}
                            disabled={saving}
                            className="mt-6 w-full rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                            {saving
                                ? "Menyimpan..."
                                : "Simpan Perubahan"}
                        </button>

                    </aside>
                </div>
            </div>
        </main>
    );
}