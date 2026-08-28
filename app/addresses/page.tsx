"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useDialog } from "@/components/ui/Dialog";
import {
    FiMapPin,
    FiPlus,
    FiEdit3,
    FiTrash2,
    FiCheck,
    FiStar,
    FiChevronLeft,
} from "react-icons/fi";

type Address = {
    id: string;
    label: string | null;
    recipientName: string;
    phone: string;
    address: string;
    province: string | null;
    city: string | null;
    district: string | null;
    subdistrict: string | null;
    postalCode: string | null;
    isDefault: boolean;
    createdAt: string;
};

export default function AddressesPage() {
    const router = useRouter();
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

    async function loadAddresses() {
        try {
            setLoading(true);
            const response = await fetch("/api/addresses", { cache: "no-store" });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Gagal mengambil data alamat.");
            }

            setAddresses(result.data ?? []);
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Gagal memuat alamat."
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadAddresses();
    }, []);

    async function handleSetDefault(address: Address) {
        if (address.isDefault) return;

        try {
            setSettingDefaultId(address.id);

            const response = await fetch(`/api/addresses/${address.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isDefault: true }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Gagal mengatur alamat utama.");
            }

            toast.success("Alamat utama berhasil diubah.");
            await loadAddresses();
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Gagal mengatur alamat utama."
            );
        } finally {
            setSettingDefaultId(null);
        }
    }

    const dialog = useDialog();

    async function handleDelete(address: Address) {
        const confirmed = await dialog.confirm({
            title: "Hapus Alamat",
            message: `Hapus alamat "${address.label || address.recipientName}"?\n\n${address.isDefault ? "Alamat ini adalah alamat utama. Alamat lain akan ditetapkan sebagai alamat utama." : ""}`,
            variant: "danger",
            confirmText: "Hapus",
        });

        if (!confirmed) return;

        try {
            setDeletingId(address.id);

            const response = await fetch(`/api/addresses/${address.id}`, {
                method: "DELETE",
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Gagal menghapus alamat.");
            }

            toast.success("Alamat berhasil dihapus.");
            await loadAddresses();
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Gagal menghapus alamat."
            );
        } finally {
            setDeletingId(null);
        }
    }

    function formatAddress(addr: Address): string {
        const parts = [
            addr.address,
            addr.subdistrict,
            addr.district,
            addr.city,
            addr.province,
        ].filter(Boolean);
        return parts.join(", ");
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
                <div className="mx-auto max-w-2xl">
                    <div className="animate-pulse space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-32 rounded-2xl bg-gray-200" />
                        ))}
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
            <div className="mx-auto max-w-2xl">
                {/* HEADER */}
                <div className="mb-6">
                    <Link
                        href="/profile"
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
                    >
                        <FiChevronLeft size={16} />
                        Kembali
                    </Link>

                    <div className="mt-3 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Alamat Saya
                            </h1>
                            <p className="mt-1 text-sm text-gray-500">
                                {addresses.length} alamat tersimpan
                            </p>
                        </div>

                        <Link
                            href="/addresses/new?callbackUrl=/addresses"
                            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
                        >
                            <FiPlus size={16} />
                            Tambah
                        </Link>
                    </div>
                </div>

                {/* EMPTY STATE */}
                {addresses.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                            <FiMapPin size={24} className="text-gray-400" />
                        </div>
                        <h2 className="mt-4 text-lg font-bold text-gray-900">
                            Belum ada alamat
                        </h2>
                        <p className="mt-1 max-w-sm text-sm text-gray-500">
                            Tambahkan alamat pengiriman pertamamu.
                        </p>
                        <Link
                            href="/addresses/new?callbackUrl=/addresses"
                            className="mt-4 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
                        >
                            Tambah Alamat
                        </Link>
                    </div>
                )}

                {/* ADDRESS LIST */}
                <div className="space-y-4">
                    {addresses.map((addr) => (
                        <div
                            key={addr.id}
                            className={`rounded-2xl border bg-white p-5 transition ${
                                addr.isDefault
                                    ? "border-rose-300 ring-1 ring-rose-200"
                                    : "border-gray-200"
                            }`}
                        >
                            {/* HEADER */}
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    {addr.isDefault && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                                            <FiStar size={10} className="fill-current" />
                                            Utama
                                        </span>
                                    )}
                                    {addr.label && (
                                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
                                            {addr.label}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* DETAILS */}
                            <div className="mt-3">
                                <p className="text-sm font-semibold text-gray-900">
                                    {addr.recipientName}
                                </p>
                                <p className="text-sm text-gray-500">{addr.phone}</p>
                                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                                    {formatAddress(addr)}
                                </p>
                                {addr.postalCode && (
                                    <p className="text-xs text-gray-400">
                                        Kode Pos: {addr.postalCode}
                                    </p>
                                )}
                            </div>

                            {/* ACTIONS */}
                            <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
                                {!addr.isDefault && (
                                    <button
                                        type="button"
                                        onClick={() => handleSetDefault(addr)}
                                        disabled={settingDefaultId === addr.id}
                                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                                    >
                                        <FiCheck size={14} />
                                        {settingDefaultId === addr.id
                                            ? "Mengatur..."
                                            : "Jadikan Utama"}
                                    </button>
                                )}

                                <Link
                                    href={`/addresses/${addr.id}/edit?callbackUrl=/addresses`}
                                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
                                >
                                    <FiEdit3 size={14} />
                                    Edit
                                </Link>

                                <button
                                    type="button"
                                    onClick={() => handleDelete(addr)}
                                    disabled={deletingId === addr.id}
                                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                >
                                    <FiTrash2 size={14} />
                                    {deletingId === addr.id ? "Menghapus..." : "Hapus"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
