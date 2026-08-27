"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { FiChevronLeft } from "react-icons/fi";

type AddressForm = {
    label: string;
    recipientName: string;
    phone: string;
    address: string;
    province: string;
    city: string;
    district: string;
    subdistrict: string;
    postalCode: string;
    isDefault: boolean;
};

const emptyForm: AddressForm = {
    label: "",
    recipientName: "",
    phone: "",
    address: "",
    province: "",
    city: "",
    district: "",
    subdistrict: "",
    postalCode: "",
    isDefault: false,
};

export default function EditAddressPage() {
    return (
        <Suspense fallback={null}>
            <EditAddressPageContent />
        </Suspense>
    );
}

function EditAddressPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const params = useParams();

    const addressId = params.id as string;
    // LOW-2 FIX: Validate callbackUrl is a relative path to prevent open redirect
    const rawCallback = searchParams.get("callbackUrl") || "/addresses";
    const callbackUrl = rawCallback.startsWith("/") && !rawCallback.startsWith("//")
        ? rawCallback
        : "/addresses";

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<AddressForm>(emptyForm);

    useEffect(() => {
        async function loadAddress() {
            try {
                const response = await fetch("/api/addresses", { cache: "no-store" });
                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.message || "Gagal mengambil data alamat.");
                }

                const addresses = result.data ?? [];
                const address = addresses.find((a: any) => a.id === addressId);

                if (!address) {
                    throw new Error("Alamat tidak ditemukan.");
                }

                setForm({
                    label: address.label || "",
                    recipientName: address.recipientName || "",
                    phone: address.phone || "",
                    address: address.address || "",
                    province: address.province || "",
                    city: address.city || "",
                    district: address.district || "",
                    subdistrict: address.subdistrict || "",
                    postalCode: address.postalCode || "",
                    isDefault: address.isDefault || false,
                });
            } catch (error) {
                toast.error(
                    error instanceof Error ? error.message : "Gagal memuat alamat."
                );
                router.push(callbackUrl);
            } finally {
                setLoading(false);
            }
        }

        if (addressId) {
            loadAddress();
        }
    }, [addressId, callbackUrl, router]);

    function updateForm(field: keyof AddressForm, value: string | boolean) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!form.recipientName.trim()) {
            toast.error("Nama penerima wajib diisi.");
            return;
        }

        if (!form.phone.trim()) {
            toast.error("Nomor HP wajib diisi.");
            return;
        }

        if (!form.address.trim()) {
            toast.error("Alamat wajib diisi.");
            return;
        }

        if (!form.province.trim()) {
            toast.error("Provinsi wajib diisi.");
            return;
        }

        if (!form.city.trim()) {
            toast.error("Kota wajib diisi.");
            return;
        }

        try {
            setSaving(true);

            const response = await fetch(`/api/addresses/${addressId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    label: form.label.trim() || null,
                    recipientName: form.recipientName.trim(),
                    phone: form.phone.trim(),
                    address: form.address.trim(),
                    province: form.province.trim(),
                    city: form.city.trim(),
                    district: form.district.trim() || null,
                    subdistrict: form.subdistrict.trim() || null,
                    postalCode: form.postalCode.trim() || null,
                    isDefault: form.isDefault,
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Gagal memperbarui alamat.");
            }

            toast.success("Alamat berhasil diperbarui.");
            router.push(callbackUrl);
            router.refresh();
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Gagal memperbarui alamat."
            );
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
                <div className="mx-auto max-w-2xl">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 w-48 rounded bg-gray-200" />
                        <div className="h-64 rounded-2xl bg-gray-200" />
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
                        href={callbackUrl}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
                    >
                        <FiChevronLeft size={16} />
                        Kembali
                    </Link>

                    <h1 className="mt-3 text-2xl font-bold text-gray-900">
                        Edit Alamat
                    </h1>

                    <p className="mt-1 text-sm text-gray-500">
                        Perbarui informasi alamat pengiriman.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* INFO PENERIMA */}
                    <section className="rounded-2xl border border-gray-200 bg-white p-5">
                        <h2 className="text-sm font-bold text-gray-900">
                            Informasi Penerima
                        </h2>

                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-gray-700">
                                    Label Alamat
                                </label>
                                <input
                                    value={form.label}
                                    onChange={(e) => updateForm("label", e.target.value)}
                                    placeholder="Rumah, Kantor, dll."
                                    className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus:border-rose-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-gray-700">
                                    Nama Penerima *
                                </label>
                                <input
                                    value={form.recipientName}
                                    onChange={(e) => updateForm("recipientName", e.target.value)}
                                    placeholder="Nama lengkap"
                                    className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus:border-rose-500"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-xs font-medium text-gray-700">
                                    Nomor HP *
                                </label>
                                <input
                                    value={form.phone}
                                    onChange={(e) => updateForm("phone", e.target.value)}
                                    placeholder="08xxxxxxxxxx"
                                    type="tel"
                                    className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus:border-rose-500"
                                />
                            </div>
                        </div>
                    </section>

                    {/* DETAIL ALAMAT */}
                    <section className="rounded-2xl border border-gray-200 bg-white p-5">
                        <h2 className="text-sm font-bold text-gray-900">
                            Detail Alamat
                        </h2>

                        <div className="mt-4 space-y-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-gray-700">
                                    Alamat Lengkap *
                                </label>
                                <textarea
                                    value={form.address}
                                    onChange={(e) => updateForm("address", e.target.value)}
                                    rows={3}
                                    placeholder="Nama jalan, nomor rumah, RT/RW, patokan..."
                                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-500"
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-gray-700">
                                        Provinsi *
                                    </label>
                                    <input
                                        value={form.province}
                                        onChange={(e) => updateForm("province", e.target.value)}
                                        className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus:border-rose-500"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-gray-700">
                                        Kota/Kabupaten *
                                    </label>
                                    <input
                                        value={form.city}
                                        onChange={(e) => updateForm("city", e.target.value)}
                                        className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus:border-rose-500"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-gray-700">
                                        Kecamatan
                                    </label>
                                    <input
                                        value={form.district}
                                        onChange={(e) => updateForm("district", e.target.value)}
                                        className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus:border-rose-500"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-gray-700">
                                        Kelurahan/Desa
                                    </label>
                                    <input
                                        value={form.subdistrict}
                                        onChange={(e) => updateForm("subdistrict", e.target.value)}
                                        className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus:border-rose-500"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-gray-700">
                                        Kode Pos
                                    </label>
                                    <input
                                        value={form.postalCode}
                                        onChange={(e) => updateForm("postalCode", e.target.value)}
                                        inputMode="numeric"
                                        className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus:border-rose-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* DEFAULT */}
                    <section className="rounded-2xl border border-gray-200 bg-white p-5">
                        <label className="flex cursor-pointer items-center gap-3">
                            <input
                                type="checkbox"
                                checked={form.isDefault}
                                onChange={(e) => updateForm("isDefault", e.target.checked)}
                                className="h-5 w-5 rounded border-gray-300 text-rose-600"
                            />
                            <span className="text-sm font-medium text-gray-700">
                                Jadikan sebagai alamat utama
                            </span>
                        </label>
                    </section>

                    {/* ACTIONS */}
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <Link
                            href={callbackUrl}
                            className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                            Batal
                        </Link>

                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-xl bg-rose-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                            {saving ? "Menyimpan..." : "Simpan Perubahan"}
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}
