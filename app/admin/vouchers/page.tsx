"use client";

import {
    FormEvent,
    useEffect,
    useState,
} from "react";
import toast from "react-hot-toast";
import { useDialog } from "@/components/ui/Dialog";

type VoucherType =
    | "PERCENTAGE"
    | "FIXED";

type Voucher = {
    id: number;
    code: string;
    description: string | null;
    type: VoucherType;
    value: string | number;
    maxDiscount: string | number | null;
    minPurchase: string | number | null;
    quota: number | null;
    usedCount: number;
    isActive: boolean;
    startDate: string | null;
    endDate: string | null;
    createdAt: string;
    updatedAt: string;
};

type FormState = {
    code: string;
    description: string;
    type: VoucherType;
    value: string;
    maxDiscount: string;
    minPurchase: string;
    quota: string;
    isActive: boolean;
    startDate: string;
    endDate: string;
};

const emptyForm: FormState = {
    code: "",
    description: "",
    type: "PERCENTAGE",
    value: "",
    maxDiscount: "",
    minPurchase: "",
    quota: "",
    isActive: true,
    startDate: "",
    endDate: "",
};

function formatRupiah(
    value: string | number | null | undefined
) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "-";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "-";
    }

    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(number);
}

function formatDate(value: string | null) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
}

function toDateTimeLocal(
    value: string | null
) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const offset =
        date.getTimezoneOffset();

    const localDate = new Date(
        date.getTime() -
        offset * 60 * 1000
    );

    return localDate
        .toISOString()
        .slice(0, 16);
}

async function readJsonResponse(
    response: Response
) {
    const text = await response.text();

    if (!text) {
        throw new Error(
            `Server tidak mengembalikan response. Status: ${response.status}`
        );
    }

    try {
        return JSON.parse(text);
    } catch {
        console.error(
            "NON JSON API RESPONSE:",
            text
        );

        throw new Error(
            `Server mengembalikan response bukan JSON. Status: ${response.status}`
        );
    }
}

export default function AdminVouchersPage() {
    const [vouchers, setVouchers] =
        useState<Voucher[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [deletingId, setDeletingId] =
        useState<number | null>(null);

    const [modalOpen, setModalOpen] =
        useState(false);

    const [
        editingVoucher,
        setEditingVoucher,
    ] = useState<Voucher | null>(null);

    const [form, setForm] =
        useState<FormState>(emptyForm);

    const [search, setSearch] =
        useState("");

    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });

    const [error, setError] =
        useState("");

    const [success, setSuccess] =
        useState("");

    async function loadVouchers(pageNum: number = 1) {
        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams();
            params.set("page", String(pageNum));
            params.set("limit", "50");

            const response = await fetch(
                `/api/admin/vouchers?${params.toString()}`,
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const result =
                await readJsonResponse(
                    response
                );

            if (
                !response.ok ||
                !result.success
            ) {
                throw new Error(
                    result.message ||
                    "Gagal mengambil data voucher."
                );
            }

            const items = result.data?.items ?? (Array.isArray(result.data) ? result.data : []);
            const pag = result.data?.pagination;

            setVouchers(items);
            if (pag) setPagination(pag);
        } catch (err) {
            console.error(
                "LOAD VOUCHERS ERROR:",
                err
            );

            setError(
                err instanceof Error
                    ? err.message
                    : "Gagal mengambil data voucher."
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadVouchers(1);
    }, []);

    function openCreateModal() {
        setEditingVoucher(null);
        setForm({
            ...emptyForm,
        });
        setError("");
        setSuccess("");
        setModalOpen(true);
    }

    function openEditModal(
        voucher: Voucher
    ) {
        setEditingVoucher(voucher);

        setForm({
            code: voucher.code,
            description:
                voucher.description || "",
            type: voucher.type,
            value: String(
                voucher.value ?? ""
            ),
            maxDiscount:
                voucher.maxDiscount !==
                    null
                    ? String(
                        voucher.maxDiscount
                    )
                    : "",
            minPurchase:
                voucher.minPurchase !==
                    null
                    ? String(
                        voucher.minPurchase
                    )
                    : "",
            quota:
                voucher.quota !== null
                    ? String(
                        voucher.quota
                    )
                    : "",
            isActive:
                voucher.isActive,
            startDate:
                toDateTimeLocal(
                    voucher.startDate
                ),
            endDate:
                toDateTimeLocal(
                    voucher.endDate
                ),
        });

        setError("");
        setSuccess("");
        setModalOpen(true);
    }

    function closeModal() {
        if (saving) return;

        setModalOpen(false);
        setEditingVoucher(null);
        setForm({
            ...emptyForm,
        });
        setError("");
        setSuccess("");
    }

    function updateForm<
        K extends keyof FormState
    >(
        key: K,
        value: FormState[K]
    ) {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    }

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!form.code.trim()) {
            setError(
                "Kode voucher wajib diisi."
            );
            return;
        }

        const numericValue =
            Number(form.value);

        if (
            !Number.isFinite(
                numericValue
            ) ||
            numericValue <= 0
        ) {
            setError(
                "Nilai voucher harus lebih dari 0."
            );
            return;
        }

        if (
            form.type ===
            "PERCENTAGE" &&
            numericValue > 100
        ) {
            setError(
                "Persentase voucher tidak boleh lebih dari 100%."
            );
            return;
        }

        if (
            form.type ===
            "PERCENTAGE" &&
            form.maxDiscount
        ) {
            const maxDiscount =
                Number(
                    form.maxDiscount
                );

            if (
                !Number.isFinite(
                    maxDiscount
                ) ||
                maxDiscount <= 0
            ) {
                setError(
                    "Maksimal diskon harus lebih dari 0."
                );
                return;
            }
        }

        if (form.minPurchase) {
            const minPurchase =
                Number(
                    form.minPurchase
                );

            if (
                !Number.isFinite(
                    minPurchase
                ) ||
                minPurchase < 0
            ) {
                setError(
                    "Minimum pembelian tidak valid."
                );
                return;
            }
        }

        if (form.quota) {
            const quota =
                Number(form.quota);

            if (
                !Number.isInteger(
                    quota
                ) ||
                quota < 0
            ) {
                setError(
                    "Quota harus berupa angka bulat."
                );
                return;
            }

            if (
                editingVoucher &&
                quota <
                editingVoucher.usedCount
            ) {
                setError(
                    `Quota tidak boleh lebih kecil dari ${editingVoucher.usedCount}, karena voucher sudah digunakan sebanyak itu.`
                );
                return;
            }
        }

        if (
            form.startDate &&
            form.endDate &&
            new Date(
                form.endDate
            ) <
            new Date(
                form.startDate
            )
        ) {
            setError(
                "Tanggal berakhir tidak boleh sebelum tanggal mulai."
            );
            return;
        }

        try {
            setSaving(true);

            const payload = {
                code: form.code
                    .trim()
                    .toUpperCase(),

                description:
                    form.description.trim() ||
                    null,

                type: form.type,

                value: numericValue,

                maxDiscount:
                    form.type ===
                        "PERCENTAGE" &&
                        form.maxDiscount
                        ? Number(
                            form.maxDiscount
                        )
                        : null,

                minPurchase:
                    form.minPurchase
                        ? Number(
                            form.minPurchase
                        )
                        : null,

                quota: form.quota
                    ? Number(form.quota)
                    : null,

                isActive:
                    form.isActive,

                startDate:
                    form.startDate ||
                    null,

                endDate:
                    form.endDate ||
                    null,
            };

            const url =
                editingVoucher
                    ? `/api/admin/vouchers/${editingVoucher.id}`
                    : "/api/admin/vouchers";

            const method =
                editingVoucher
                    ? "PATCH"
                    : "POST";

            const response =
                await fetch(url, {
                    method,
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify(
                        payload
                    ),
                });

            const result =
                await readJsonResponse(
                    response
                );

            if (
                !response.ok ||
                !result.success
            ) {
                throw new Error(
                    result.message ||
                    "Gagal menyimpan voucher."
                );
            }

            setSuccess(
                editingVoucher
                    ? "Voucher berhasil diubah."
                    : "Voucher berhasil dibuat."
            );

            await loadVouchers(page);

            window.setTimeout(() => {
                closeModal();
            }, 700);
        } catch (err) {
            console.error(
                "SAVE VOUCHER ERROR:",
                err
            );

            setError(
                err instanceof Error
                    ? err.message
                    : "Terjadi kesalahan."
            );
        } finally {
            setSaving(false);
        }
    }

    const dialog = useDialog();

    async function handleDelete(
        voucher: Voucher
    ) {
        if (voucher.usedCount > 0) {
            await dialog.alert({
                title: "Tidak Bisa Dihapus",
                message: "Voucher ini sudah pernah digunakan. Nonaktifkan voucher saja.",
                variant: "warning",
            });
            return;
        }

        const confirmed = await dialog.confirm({
            title: "Hapus Voucher",
            message: `Hapus voucher "${voucher.code}"?\n\nTindakan ini tidak bisa dibatalkan.`,
            variant: "danger",
            confirmText: "Hapus",
        });

        if (!confirmed) return;

        try {
            setDeletingId(
                voucher.id
            );

            setError("");
            setSuccess("");

            const response =
                await fetch(
                    `/api/admin/vouchers/${voucher.id}`,
                    {
                        method: "DELETE",
                    }
                );

            const result =
                await readJsonResponse(
                    response
                );

            if (
                !response.ok ||
                !result.success
            ) {
                throw new Error(
                    result.message ||
                    "Gagal menghapus voucher."
                );
            }

            setSuccess(
                "Voucher berhasil dihapus."
            );

            await loadVouchers(page);
        } catch (err) {
            console.error(
                "DELETE VOUCHER ERROR:",
                err
            );

            setError(
                err instanceof Error
                    ? err.message
                    : "Gagal menghapus voucher."
            );
        } finally {
            setDeletingId(null);
        }
    }

    async function toggleActive(
        voucher: Voucher
    ) {
        try {
            setError("");
            setSuccess("");

            const response =
                await fetch(
                    `/api/admin/vouchers/${voucher.id}`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            isActive:
                                !voucher.isActive,
                        }),
                    }
                );

            const result =
                await readJsonResponse(
                    response
                );

            if (
                !response.ok ||
                !result.success
            ) {
                throw new Error(
                    result.message ||
                    "Gagal mengubah status voucher."
                );
            }

            await loadVouchers(page);
        } catch (err) {
            console.error(
                "TOGGLE VOUCHER ERROR:",
                err
            );

            setError(
                err instanceof Error
                    ? err.message
                    : "Gagal mengubah status voucher."
            );
        }
    }

    const filteredVouchers =
        vouchers.filter(
            (voucher) => {
                const keyword =
                    search
                        .toLowerCase()
                        .trim();

                if (!keyword) {
                    return true;
                }

                return (
                    voucher.code
                        .toLowerCase()
                        .includes(
                            keyword
                        ) ||
                    (
                        voucher.description ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            keyword
                        )
                );
            }
        );

    const activeCount =
        vouchers.filter(
            (voucher) =>
                voucher.isActive
        ).length;

    const totalUsed =
        vouchers.reduce(
            (total, voucher) =>
                total +
                voucher.usedCount,
            0
        );

    return (
        <div className="min-h-full bg-gray-50/70 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-[1500px] space-y-6">

                {/* HEADER */}
                <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                            <span>Admin</span>
                            <span>/</span>
                            <span className="text-gray-600">
                                Voucher
                            </span>
                        </div>

                        <h1 className="text-2xl font-bold tracking-tight text-gray-950">
                            Voucher
                        </h1>

                        <p className="mt-1 text-sm text-gray-500">
                            Kelola promo, diskon, dan penggunaan voucher toko.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gray-950 px-5 text-sm font-semibold text-white transition hover:bg-gray-800 active:scale-[0.98]"
                    >
                        <span className="text-lg leading-none">
                            +
                        </span>

                        Tambah Voucher
                    </button>
                </div>

                {/* ALERT */}
                {error && (
                    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <span className="mt-0.5 font-bold">
                            !
                        </span>

                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        <span className="mt-0.5 font-bold">
                            ✓
                        </span>

                        <span>{success}</span>
                    </div>
                )}

                {/* SUMMARY */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="border-b border-gray-200 bg-white px-5 py-5 sm:border-b-0 sm:border-r">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                            Total Voucher
                        </p>

                        <div className="mt-2 flex items-end gap-2">
                            <span className="text-2xl font-bold tracking-tight text-gray-950">
                                {vouchers.length}
                            </span>

                            <span className="mb-1 text-xs text-gray-400">
                                voucher
                            </span>
                        </div>
                    </div>

                    <div className="border-b border-gray-200 bg-white px-5 py-5 sm:border-b-0 sm:border-r">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                            Voucher Aktif
                        </p>

                        <div className="mt-2 flex items-end gap-2">
                            <span className="text-2xl font-bold tracking-tight text-emerald-600">
                                {activeCount}
                            </span>

                            <span className="mb-1 text-xs text-gray-400">
                                sedang berjalan
                            </span>
                        </div>
                    </div>

                    <div className="bg-white px-5 py-5">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                            Total Pemakaian
                        </p>

                        <div className="mt-2 flex items-end gap-2">
                            <span className="text-2xl font-bold tracking-tight text-gray-950">
                                {totalUsed}
                            </span>

                            <span className="mb-1 text-xs text-gray-400">
                                kali digunakan
                            </span>
                        </div>
                    </div>
                </div>

                {/* TABLE CONTAINER */}
                <section className="overflow-hidden border border-gray-200 bg-white">

                    {/* TOOLBAR */}
                    <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-950">
                                Daftar Voucher
                            </h2>

                            <p className="mt-0.5 text-xs text-gray-400">
                                {filteredVouchers.length} dari{" "}
                                {vouchers.length} voucher
                            </p>
                        </div>

                        <div className="relative w-full md:w-72">
                            <svg
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <circle
                                    cx="11"
                                    cy="11"
                                    r="7"
                                />

                                <path d="m20 20-3.5-3.5" />
                            </svg>

                            <input
                                type="text"
                                value={search}
                                onChange={(event) =>
                                    setSearch(
                                        event.target.value
                                    )
                                }
                                placeholder="Cari voucher..."
                                className="h-10 w-full border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:bg-white"
                            />
                        </div>
                    </div>

                    {/* CONTENT */}
                    {loading ? (
                        <div className="flex min-h-[300px] items-center justify-center">
                            <div className="text-center">
                                <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-800" />

                                <p className="mt-3 text-xs text-gray-400">
                                    Memuat voucher...
                                </p>
                            </div>
                        </div>
                    ) : filteredVouchers.length === 0 ? (
                        <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                                <span className="text-xl">
                                    %
                                </span>
                            </div>

                            <p className="mt-4 text-sm font-semibold text-gray-900">
                                Belum ada voucher
                            </p>

                            <p className="mt-1 max-w-sm text-xs leading-5 text-gray-400">
                                Buat voucher pertama untuk memberikan
                                promo kepada pelanggan.
                            </p>

                            <button
                                type="button"
                                onClick={openCreateModal}
                                className="mt-4 text-xs font-semibold text-gray-900 underline underline-offset-4 hover:text-gray-500"
                            >
                                Tambah voucher
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1050px] text-left">
                                <thead>
                                    <tr className="border-b border-gray-200 bg-gray-50/80">
                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                            Voucher
                                        </th>

                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                            Diskon
                                        </th>

                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                            Minimum
                                        </th>

                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                            Pemakaian
                                        </th>

                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                            Periode
                                        </th>

                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                            Status
                                        </th>

                                        <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {filteredVouchers.map(
                                        (voucher) => {
                                            const quotaProgress =
                                                voucher.quota !== null &&
                                                    voucher.quota > 0
                                                    ? Math.min(
                                                        100,
                                                        (voucher.usedCount /
                                                            voucher.quota) *
                                                        100
                                                    )
                                                    : 0;

                                            return (
                                                <tr
                                                    key={voucher.id}
                                                    className="group transition hover:bg-gray-50/70"
                                                >
                                                    {/* VOUCHER */}
                                                    <td className="px-5 py-4">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono text-sm font-bold tracking-wide text-gray-900">
                                                                    {
                                                                        voucher.code
                                                                    }
                                                                </span>

                                                                {voucher.usedCount >
                                                                    0 && (
                                                                        <span className="text-[10px] text-gray-400">
                                                                            {
                                                                                voucher.usedCount
                                                                            }x
                                                                        </span>
                                                                    )}
                                                            </div>

                                                            {voucher.description && (
                                                                <p className="mt-1 max-w-[230px] truncate text-xs text-gray-400">
                                                                    {
                                                                        voucher.description
                                                                    }
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* DISCOUNT */}
                                                    <td className="px-5 py-4">
                                                        <div className="font-semibold text-gray-900">
                                                            {voucher.type ===
                                                                "PERCENTAGE"
                                                                ? `${Number(
                                                                    voucher.value
                                                                )}%`
                                                                : formatRupiah(
                                                                    voucher.value
                                                                )}
                                                        </div>

                                                        {voucher.type ===
                                                            "PERCENTAGE" &&
                                                            voucher.maxDiscount !==
                                                            null && (
                                                                <p className="mt-1 text-[11px] text-gray-400">
                                                                    Maks.{" "}
                                                                    {formatRupiah(
                                                                        voucher.maxDiscount
                                                                    )}
                                                                </p>
                                                            )}
                                                    </td>

                                                    {/* MINIMUM */}
                                                    <td className="px-5 py-4 text-sm text-gray-600">
                                                        {voucher.minPurchase !==
                                                            null
                                                            ? formatRupiah(
                                                                voucher.minPurchase
                                                            )
                                                            : (
                                                                <span className="text-gray-400">
                                                                    Tanpa
                                                                    minimum
                                                                </span>
                                                            )}
                                                    </td>

                                                    {/* USAGE */}
                                                    <td className="px-5 py-4">
                                                        <div className="w-28">
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="font-medium text-gray-700">
                                                                    {
                                                                        voucher.usedCount
                                                                    }
                                                                </span>

                                                                {voucher.quota !==
                                                                    null && (
                                                                        <span className="text-gray-400">
                                                                            /{" "}
                                                                            {
                                                                                voucher.quota
                                                                            }
                                                                        </span>
                                                                    )}
                                                            </div>

                                                            {voucher.quota !==
                                                                null && (
                                                                    <div className="mt-2 h-1 overflow-hidden bg-gray-100">
                                                                        <div
                                                                            className={`h-full ${quotaProgress >=
                                                                                    90
                                                                                    ? "bg-red-500"
                                                                                    : quotaProgress >=
                                                                                        70
                                                                                        ? "bg-amber-400"
                                                                                        : "bg-gray-800"
                                                                                }`}
                                                                            style={{
                                                                                width: `${quotaProgress}%`,
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )}
                                                        </div>
                                                    </td>

                                                    {/* PERIOD */}
                                                    <td className="px-5 py-4">
                                                        <div className="space-y-1 text-xs">
                                                            <div className="text-gray-700">
                                                                {formatDate(
                                                                    voucher.startDate
                                                                )}
                                                            </div>

                                                            <div className="text-gray-400">
                                                                sampai{" "}
                                                                {formatDate(
                                                                    voucher.endDate
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* STATUS */}
                                                    <td className="px-5 py-4">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                toggleActive(
                                                                    voucher
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-2 text-xs font-medium"
                                                        >
                                                            <span
                                                                className={`h-2 w-2 rounded-full ${voucher.isActive
                                                                        ? "bg-emerald-500"
                                                                        : "bg-gray-300"
                                                                    }`}
                                                            />

                                                            <span
                                                                className={
                                                                    voucher.isActive
                                                                        ? "text-emerald-700"
                                                                        : "text-gray-400"
                                                                }
                                                            >
                                                                {voucher.isActive
                                                                    ? "Aktif"
                                                                    : "Nonaktif"}
                                                            </span>
                                                        </button>
                                                    </td>

                                                    {/* ACTION */}
                                                    <td className="px-5 py-4">
                                                        <div className="flex justify-end gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    openEditModal(
                                                                        voucher
                                                                    )
                                                                }
                                                                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                                                            >
                                                                Edit
                                                            </button>

                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    deletingId ===
                                                                    voucher.id
                                                                }
                                                                onClick={() =>
                                                                    handleDelete(
                                                                        voucher
                                                                    )
                                                                }
                                                                className="px-2.5 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                                            >
                                                                {deletingId ===
                                                                    voucher.id
                                                                    ? "..."
                                                                    : "Hapus"}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                            <p className="text-xs text-gray-500">
                                Halaman {pagination.page} dari {pagination.totalPages} ({pagination.total} voucher)
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={page <= 1}
                                    onClick={() => { const p = page - 1; setPage(p); loadVouchers(p); }}
                                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Sebelumnya
                                </button>
                                <button
                                    type="button"
                                    disabled={page >= pagination.totalPages}
                                    onClick={() => { const p = page + 1; setPage(p); loadVouchers(p); }}
                                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Selanjutnya
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {/* =====================================================
            MODAL
        ===================================================== */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4 backdrop-blur-[2px]">
                    <div className="max-h-[92vh] w-full max-w-xl overflow-hidden bg-white shadow-2xl">

                        {/* MODAL HEADER */}
                        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                                    Voucher
                                </p>

                                <h2 className="mt-1 text-lg font-bold tracking-tight text-gray-950">
                                    {editingVoucher
                                        ? "Edit voucher"
                                        : "Buat voucher baru"}
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={saving}
                                className="flex h-8 w-8 items-center justify-center text-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
                            >
                                ×
                            </button>
                        </div>

                        {/* FORM */}
                        <form
                            onSubmit={handleSubmit}
                            className="max-h-[calc(92vh-76px)] overflow-y-auto"
                        >
                            <div className="space-y-6 px-6 py-6">

                                {error && (
                                    <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-xs text-red-700">
                                        {error}
                                    </div>
                                )}

                                {success && (
                                    <div className="border-l-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                                        {success}
                                    </div>
                                )}

                                {/* BASIC */}
                                <div>
                                    <div className="mb-4">
                                        <h3 className="text-sm font-semibold text-gray-900">
                                            Informasi voucher
                                        </h3>

                                        <p className="mt-1 text-xs text-gray-400">
                                            Tentukan kode dan informasi dasar promo.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                                                Kode voucher
                                            </label>

                                            <input
                                                type="text"
                                                value={form.code}
                                                disabled={
                                                    !!editingVoucher
                                                }
                                                onChange={(event) =>
                                                    updateForm(
                                                        "code",
                                                        event.target.value
                                                            .toUpperCase()
                                                            .replace(
                                                                /\s/g,
                                                                ""
                                                            )
                                                    )
                                                }
                                                placeholder="Contoh: HEMAT20"
                                                className="h-11 w-full border border-gray-200 bg-gray-50 px-3 text-sm font-mono font-semibold uppercase outline-none transition placeholder:font-sans placeholder:text-gray-400 focus:border-gray-500 focus:bg-white disabled:cursor-not-allowed disabled:bg-gray-100"
                                            />

                                            {editingVoucher && (
                                                <p className="mt-1.5 text-[11px] text-gray-400">
                                                    Kode tidak dapat diubah setelah voucher dibuat.
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                                                Deskripsi
                                                <span className="ml-1 font-normal text-gray-400">
                                                    opsional
                                                </span>
                                            </label>

                                            <textarea
                                                value={
                                                    form.description
                                                }
                                                onChange={(event) =>
                                                    updateForm(
                                                        "description",
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Contoh: Diskon spesial pelanggan baru"
                                                rows={2}
                                                className="w-full resize-none border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-500 focus:bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* DISCOUNT */}
                                <div className="border-t border-gray-100 pt-6">
                                    <div className="mb-4">
                                        <h3 className="text-sm font-semibold text-gray-900">
                                            Aturan diskon
                                        </h3>

                                        <p className="mt-1 text-xs text-gray-400">
                                            Atur jenis dan nominal potongan.
                                        </p>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                                                Tipe
                                            </label>

                                            <select
                                                value={
                                                    form.type
                                                }
                                                onChange={(event) =>
                                                    updateForm(
                                                        "type",
                                                        event.target
                                                            .value as VoucherType
                                                    )
                                                }
                                                className="h-11 w-full border border-gray-200 bg-gray-50 px-3 text-sm outline-none transition focus:border-gray-500 focus:bg-white"
                                            >
                                                <option value="PERCENTAGE">
                                                    Persentase (%)
                                                </option>

                                                <option value="FIXED">
                                                    Nominal tetap (Rp)
                                                </option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                                                Nilai diskon
                                            </label>

                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={
                                                        form.value
                                                    }
                                                    onChange={(event) =>
                                                        updateForm(
                                                            "value",
                                                            event.target
                                                                .value
                                                        )
                                                    }
                                                    placeholder={
                                                        form.type ===
                                                            "PERCENTAGE"
                                                            ? "20"
                                                            : "50000"
                                                    }
                                                    className="h-11 w-full border border-gray-200 bg-gray-50 px-3 pr-12 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-500 focus:bg-white"
                                                />

                                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                                    {form.type ===
                                                        "PERCENTAGE"
                                                        ? "%"
                                                        : "IDR"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {form.type ===
                                        "PERCENTAGE" && (
                                            <div className="mt-4">
                                                <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                                                    Maksimal diskon
                                                    <span className="ml-1 font-normal text-gray-400">
                                                        opsional
                                                    </span>
                                                </label>

                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={
                                                            form.maxDiscount
                                                        }
                                                        onChange={(event) =>
                                                            updateForm(
                                                                "maxDiscount",
                                                                event.target
                                                                    .value
                                                            )
                                                        }
                                                        placeholder="50000"
                                                        className="h-11 w-full border border-gray-200 bg-gray-50 px-3 pr-12 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-500 focus:bg-white"
                                                    />

                                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                                        IDR
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                </div>

                                {/* CONDITIONS */}
                                <div className="border-t border-gray-100 pt-6">
                                    <div className="mb-4">
                                        <h3 className="text-sm font-semibold text-gray-900">
                                            Syarat penggunaan
                                        </h3>

                                        <p className="mt-1 text-xs text-gray-400">
                                            Tentukan minimum transaksi dan batas penggunaan.
                                        </p>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                                                Minimum pembelian
                                                <span className="ml-1 font-normal text-gray-400">
                                                    opsional
                                                </span>
                                            </label>

                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={
                                                        form.minPurchase
                                                    }
                                                    onChange={(event) =>
                                                        updateForm(
                                                            "minPurchase",
                                                            event.target
                                                                .value
                                                        )
                                                    }
                                                    placeholder="100000"
                                                    className="h-11 w-full border border-gray-200 bg-gray-50 px-3 pr-12 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-500 focus:bg-white"
                                                />

                                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                                    IDR
                                                </span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                                                Quota
                                                <span className="ml-1 font-normal text-gray-400">
                                                    opsional
                                                </span>
                                            </label>

                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={
                                                    form.quota
                                                }
                                                onChange={(event) =>
                                                    updateForm(
                                                        "quota",
                                                        event.target
                                                            .value
                                                    )
                                                }
                                                placeholder="100"
                                                className="h-11 w-full border border-gray-200 bg-gray-50 px-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-500 focus:bg-white"
                                            />

                                            <p className="mt-1.5 text-[11px] text-gray-400">
                                                Kosongkan jika tidak ada batas penggunaan.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* PERIOD */}
                                <div className="border-t border-gray-100 pt-6">
                                    <div className="mb-4">
                                        <h3 className="text-sm font-semibold text-gray-900">
                                            Periode voucher
                                        </h3>

                                        <p className="mt-1 text-xs text-gray-400">
                                            Kosongkan tanggal jika voucher tidak memiliki batas waktu.
                                        </p>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                                                Mulai
                                            </label>

                                            <input
                                                type="datetime-local"
                                                value={
                                                    form.startDate
                                                }
                                                onChange={(event) =>
                                                    updateForm(
                                                        "startDate",
                                                        event.target
                                                            .value
                                                    )
                                                }
                                                className="h-11 w-full border border-gray-200 bg-gray-50 px-3 text-sm outline-none transition focus:border-gray-500 focus:bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                                                Berakhir
                                            </label>

                                            <input
                                                type="datetime-local"
                                                value={
                                                    form.endDate
                                                }
                                                onChange={(event) =>
                                                    updateForm(
                                                        "endDate",
                                                        event.target
                                                            .value
                                                    )
                                                }
                                                className="h-11 w-full border border-gray-200 bg-gray-50 px-3 text-sm outline-none transition focus:border-gray-500 focus:bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* STATUS */}
                                <div className="border-t border-gray-100 pt-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-900">
                                                Status voucher
                                            </h3>

                                            <p className="mt-1 text-xs text-gray-400">
                                                Customer hanya dapat menggunakan voucher yang aktif.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateForm(
                                                    "isActive",
                                                    !form.isActive
                                                )
                                            }
                                            className={`relative h-6 w-11 shrink-0 rounded-full transition ${form.isActive
                                                    ? "bg-gray-900"
                                                    : "bg-gray-200"
                                                }`}
                                        >
                                            <span
                                                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${form.isActive
                                                        ? "left-[22px]"
                                                        : "left-0.5"
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* FOOTER */}
                            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-gray-200 bg-white px-6 py-4 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={saving}
                                    className="h-10 border border-gray-200 px-5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Batal
                                </button>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="h-10 bg-gray-950 px-5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {saving
                                        ? "Menyimpan..."
                                        : editingVoucher
                                            ? "Simpan perubahan"
                                            : "Buat voucher"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

