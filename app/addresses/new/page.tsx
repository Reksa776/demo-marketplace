"use client";

import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

import type { Location } from "./LocationPickerMap";

const DEFAULT_LOCATION: Location = {
    lat: -6.2,
    lng: 106.816666,
};

// Leaflet menyentuh `window` saat load, jadi peta HARUS
// hanya di-render di client, tidak boleh ikut prerender.
const LocationPickerMap = dynamic(
    () => import("./LocationPickerMap"),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-[400px] w-full items-center justify-center bg-gray-100 text-sm text-gray-500">
                Memuat peta...
            </div>
        ),
    }
);

export default function NewAddressPage() {
    return (
        <Suspense fallback={null}>
            <NewAddressPageContent />
        </Suspense>
    );
}

function NewAddressPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const callbackUrl =
        searchParams.get("callbackUrl") ||
        "/addresses";

    const [loading, setLoading] =
        useState(false);

    const [gettingGps, setGettingGps] =
        useState(false);

    const [location, setLocation] =
        useState<Location>(
            DEFAULT_LOCATION
        );

    const [form, setForm] = useState({
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
    });

    function updateForm(
        field: keyof typeof form,
        value: string | boolean
    ) {
        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));
    }

    function updateLocation(
        nextLocation: Location
    ) {
        setLocation(nextLocation);
    }

    function useGps() {
        if (!navigator.geolocation) {
            toast.error(
                "Browser kamu tidak mendukung GPS."
            );

            return;
        }

        setGettingGps(true);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const nextLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };

                setLocation(nextLocation);

                toast.success(
                    "Lokasi GPS berhasil digunakan."
                );

                setGettingGps(false);
            },
            (error) => {
                console.error(
                    "GPS ERROR:",
                    error
                );

                let message =
                    "Gagal mendapatkan lokasi.";

                if (
                    error.code ===
                    error.PERMISSION_DENIED
                ) {
                    message =
                        "Izin lokasi ditolak. Silakan izinkan akses lokasi di browser.";
                }

                if (
                    error.code ===
                    error.POSITION_UNAVAILABLE
                ) {
                    message =
                        "Lokasi GPS tidak tersedia.";
                }

                if (
                    error.code ===
                    error.TIMEOUT
                ) {
                    message =
                        "Pengambilan lokasi terlalu lama.";
                }

                toast.error(message);

                setGettingGps(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
            }
        );
    }

    async function handleSubmit(
        event: React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (!form.recipientName.trim()) {
            toast.error(
                "Nama penerima wajib diisi."
            );
            return;
        }

        if (!form.phone.trim()) {
            toast.error(
                "Nomor HP wajib diisi."
            );
            return;
        }

        if (!form.address.trim()) {
            toast.error(
                "Alamat wajib diisi."
            );
            return;
        }

        if (!form.province.trim()) {
            toast.error(
                "Provinsi wajib diisi."
            );
            return;
        }

        if (!form.city.trim()) {
            toast.error(
                "Kota wajib diisi."
            );
            return;
        }

        if (!form.postalCode.trim()) {
            toast.error(
                "Kode pos wajib diisi."
            );
            return;
        }

        try {
            setLoading(true);

            const response = await fetch(
                "/api/addresses",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body: JSON.stringify({
                        label:
                            form.label.trim() ||
                            null,

                        recipientName:
                            form.recipientName.trim(),

                        phone:
                            form.phone.trim(),

                        address:
                            form.address.trim(),

                        province:
                            form.province.trim(),

                        city:
                            form.city.trim(),

                        district:
                            form.district.trim() ||
                            null,

                        subdistrict:
                            form.subdistrict.trim() ||
                            null,

                        postalCode:
                            form.postalCode.trim(),

                        latitude:
                            location.lat,

                        longitude:
                            location.lng,

                        isDefault:
                            form.isDefault,
                    }),
                }
            );

            const result =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message ||
                        "Gagal menyimpan alamat."
                );
            }

            toast.success(
                "Alamat berhasil disimpan."
            );

            router.push(callbackUrl);
            router.refresh();
        } catch (error) {
            console.error(
                "SAVE ADDRESS ERROR:",
                error
            );

            toast.error(
                error instanceof Error
                    ? error.message
                    : "Gagal menyimpan alamat."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
            <div className="mx-auto max-w-5xl">
                <div className="mb-6">
                    <Link
                        href={callbackUrl}
                        className="text-sm text-gray-500 hover:text-gray-900"
                    >
                        ← Kembali
                    </Link>

                    <h1 className="mt-3 text-3xl font-bold text-gray-900">
                        Tambah Alamat
                    </h1>

                    <p className="mt-1 text-sm text-gray-500">
                        Tentukan alamat dan titik
                        lokasi pengiriman.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-6"
                >
                    {/* FORM ALAMAT */}

                    <section className="rounded-3xl border border-gray-200 bg-white p-6">
                        <h2 className="text-lg font-bold">
                            Informasi Penerima
                        </h2>

                        <div className="mt-5 grid gap-5 sm:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Label Alamat
                                </label>

                                <input
                                    value={
                                        form.label
                                    }
                                    onChange={(event) =>
                                        updateForm(
                                            "label",
                                            event.target
                                                .value
                                        )
                                    }
                                    placeholder="Rumah"
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-rose-500"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Nama Penerima *
                                </label>

                                <input
                                    value={
                                        form.recipientName
                                    }
                                    onChange={(event) =>
                                        updateForm(
                                            "recipientName",
                                            event.target
                                                .value
                                        )
                                    }
                                    placeholder="Nama lengkap"
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-rose-500"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Nomor HP *
                                </label>

                                <input
                                    value={
                                        form.phone
                                    }
                                    onChange={(event) =>
                                        updateForm(
                                            "phone",
                                            event.target
                                                .value
                                        )
                                    }
                                    placeholder="08xxxxxxxxxx"
                                    type="tel"
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-rose-500"
                                />
                            </div>
                        </div>
                    </section>

                    {/* ALAMAT */}

                    <section className="rounded-3xl border border-gray-200 bg-white p-6">
                        <h2 className="text-lg font-bold">
                            Detail Alamat
                        </h2>

                        <div className="mt-5 space-y-5">
                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Alamat Lengkap *
                                </label>

                                <textarea
                                    value={
                                        form.address
                                    }
                                    onChange={(event) =>
                                        updateForm(
                                            "address",
                                            event.target
                                                .value
                                        )
                                    }
                                    rows={4}
                                    placeholder="Nama jalan, nomor rumah, RT/RW, patokan..."
                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-rose-500"
                                />
                            </div>

                            <div className="grid gap-5 sm:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Provinsi *
                                    </label>

                                    <input
                                        value={
                                            form.province
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            updateForm(
                                                "province",
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-rose-500"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Kota/Kabupaten *
                                    </label>

                                    <input
                                        value={
                                            form.city
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            updateForm(
                                                "city",
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-rose-500"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Kecamatan
                                    </label>

                                    <input
                                        value={
                                            form.district
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            updateForm(
                                                "district",
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-rose-500"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Kelurahan/Desa
                                    </label>

                                    <input
                                        value={
                                            form.subdistrict
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            updateForm(
                                                "subdistrict",
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-rose-500"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Kode Pos *
                                    </label>

                                    <input
                                        value={
                                            form.postalCode
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            updateForm(
                                                "postalCode",
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        inputMode="numeric"
                                        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-rose-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* MAP */}

                    <section className="rounded-3xl border border-gray-200 bg-white p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-bold">
                                    Titik Lokasi
                                </h2>

                                <p className="mt-1 text-sm text-gray-500">
                                    Geser pin atau klik
                                    pada peta untuk
                                    menentukan lokasi.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={useGps}
                                disabled={
                                    gettingGps
                                }
                                className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {gettingGps
                                    ? "Mencari lokasi..."
                                    : "📍 Gunakan GPS Saya"}
                            </button>
                        </div>

                        <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200">
                            <LocationPickerMap
                                location={location}
                                onChange={updateLocation}
                            />
                        </div>

                        {/* KOORDINAT */}

                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div className="rounded-xl bg-gray-50 p-4">
                                <div className="text-xs font-medium text-gray-500">
                                    Latitude
                                </div>

                                <div className="mt-1 font-mono text-sm font-semibold text-gray-900">
                                    {location.lat.toFixed(
                                        7
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl bg-gray-50 p-4">
                                <div className="text-xs font-medium text-gray-500">
                                    Longitude
                                </div>

                                <div className="mt-1 font-mono text-sm font-semibold text-gray-900">
                                    {location.lng.toFixed(
                                        7
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* DEFAULT */}

                    <section className="rounded-3xl border border-gray-200 bg-white p-6">
                        <label className="flex cursor-pointer items-center gap-3">
                            <input
                                type="checkbox"
                                checked={
                                    form.isDefault
                                }
                                onChange={(event) =>
                                    updateForm(
                                        "isDefault",
                                        event.target
                                            .checked
                                    )
                                }
                                className="h-5 w-5 rounded border-gray-300 text-rose-600"
                            />

                            <span className="text-sm font-medium">
                                Jadikan sebagai alamat
                                utama
                            </span>
                        </label>
                    </section>

                    {/* ACTION */}

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <Link
                            href={callbackUrl}
                            className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                            Batal
                        </Link>

                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-xl bg-rose-600 px-6 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                            {loading
                                ? "Menyimpan..."
                                : "Simpan Alamat"}
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}