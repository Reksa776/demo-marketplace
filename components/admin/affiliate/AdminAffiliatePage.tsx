"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import Link from "next/link";

/* ==========================================
 * TYPES
 * ========================================== */

type AffiliateUser = {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
};

type AffiliateKyc = {
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNumber: string | null; // masked
    ktpImageUrl: string | null;
    socialMediaPlatform: string | null;
    socialMediaUsername: string | null;
    socialMediaUrl: string | null;
};

type Application = {
    id: number;
    userId: string;
    status: string;
    affiliateCode: string | null;
    rejectionReason: string | null;
    approvedAt: string | null;
    createdAt: string;
    updatedAt: string;
    user: AffiliateUser | null;
    kyc: AffiliateKyc | null;
};

type Pagination = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

/* ==========================================
 * HELPERS
 * ========================================== */

function statusLabel(status: string) {
    switch (status) {
        case "PENDING":
            return "Menunggu Review";
        case "APPROVED":
            return "Disetujui";
        case "REJECTED":
            return "Ditolak";
        default:
            return status;
    }
}

function statusClass(status: string) {
    switch (status) {
        case "PENDING":
            return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200";
        case "APPROVED":
            return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200";
        case "REJECTED":
            return "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200";
        default:
            return "bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-200";
    }
}

function formatDate(value: string) {
    return new Date(value).toLocaleDateString(
        "id-ID",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }
    );
}

/* ==========================================
 * MAIN COMPONENT
 * ========================================== */

export default function AdminAffiliatePage() {
    const [applications, setApplications] =
        useState<Application[]>([]);
    const [pagination, setPagination] =
        useState<Pagination>({
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
        });
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] =
        useState("ALL");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    // Review modal
    const [reviewing, setReviewing] =
        useState<Application | null>(null);
    const [rejectReason, setRejectReason] =
        useState("");
    const [processing, setProcessing] =
        useState(false);

    const loadApplications = useCallback(
        async (
            pageNum: number,
            statusVal: string,
            searchVal: string
        ) => {
            try {
                setLoading(true);
                const params = new URLSearchParams();
                params.set("page", String(pageNum));
                params.set("limit", "20");
                if (statusVal !== "ALL")
                    params.set("status", statusVal);
                if (searchVal.trim())
                    params.set(
                        "search",
                        searchVal.trim()
                    );

                const response = await fetch(
                    `/api/admin/affiliate/applications?${params.toString()}`,
                    { cache: "no-store" }
                );
                const data =
                    await response.json();

                if (!response.ok) {
                    toast.error(
                        data.message ??
                            "Gagal mengambil data."
                    );
                    return;
                }

                setApplications(
                    data.data?.items ?? []
                );
                setPagination(
                    data.data?.pagination ?? {
                        page: 1,
                        limit: 20,
                        total: 0,
                        totalPages: 0,
                    }
                );
            } catch (error) {
                console.error(error);
                toast.error(
                    "Terjadi kesalahan."
                );
            } finally {
                setLoading(false);
            }
        },
        []
    );

    useEffect(() => {
        loadApplications(page, statusFilter, search);
    }, [page, loadApplications]);

    function handleStatusFilter(value: string) {
        setStatusFilter(value);
        setPage(1);
        loadApplications(1, value, search);
    }

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        setPage(1);
        loadApplications(1, statusFilter, search);
    }

    /* ==========================================
     * APPROVE
     * ========================================== */

    async function handleApprove(
        application: Application
    ) {
        if (
            !confirm(
                `Setujui pengajuan dari ${application.user?.name ?? "user ini"}?`
            )
        ) {
            return;
        }

        try {
            setProcessing(true);

            const res = await fetch(
                `/api/admin/affiliate/applications/${application.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        action: "APPROVE",
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(
                    data.message ??
                        "Gagal menyetujui."
                );
            }

            toast.success(
                "Pengajuan berhasil disetujui."
            );
            setReviewing(null);
            loadApplications(
                page,
                statusFilter,
                search
            );
        } catch (err) {
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Gagal menyetujui."
            );
        } finally {
            setProcessing(false);
        }
    }

    /* ==========================================
     * REJECT
     * ========================================== */

    async function handleReject(
        application: Application
    ) {
        if (!rejectReason.trim()) {
            toast.error(
                "Alasan penolakan wajib diisi."
            );
            return;
        }

        try {
            setProcessing(true);

            const res = await fetch(
                `/api/admin/affiliate/applications/${application.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        action: "REJECT",
                        rejectionReason:
                            rejectReason.trim(),
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(
                    data.message ??
                        "Gagal menolak."
                );
            }

            toast.success(
                "Pengajuan berhasil ditolak."
            );
            setReviewing(null);
            setRejectReason("");
            loadApplications(
                page,
                statusFilter,
                search
            );
        } catch (err) {
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Gagal menolak."
            );
        } finally {
            setProcessing(false);
        }
    }

    /* ==========================================
     * RENDER
     * ========================================== */

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
                    Pengajuan Affiliator
                </h1>
                <p className="text-sm text-gray-500">
                    Review dan kelola pengajuan
                    Affiliator dari customer.
                </p>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-5 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900">
                                Semua Pengajuan
                            </h2>
                            <p className="mt-0.5 text-xs text-gray-500">
                                Menampilkan{" "}
                                {
                                    applications.length
                                }{" "}
                                dari{" "}
                                {pagination.total}{" "}
                                pengajuan
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <form
                            onSubmit={handleSearch}
                            className="relative flex-1 lg:max-w-sm"
                        >
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                ⌕
                            </span>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) =>
                                    setSearch(
                                        e.target.value
                                    )
                                }
                                placeholder="Cari nama, email..."
                                className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400"
                            />
                        </form>
                        <select
                            value={statusFilter}
                            onChange={(e) =>
                                handleStatusFilter(
                                    e.target.value
                                )
                            }
                            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-400"
                        >
                            <option value="ALL">
                                Semua status
                            </option>
                            <option value="PENDING">
                                Menunggu Review
                            </option>
                            <option value="APPROVED">
                                Disetujui
                            </option>
                            <option value="REJECTED">
                                Ditolak
                            </option>
                        </select>
                    </div>
                </div>

                {/* TABLE */}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left">
                        <thead className="border-b border-gray-100 bg-gray-50/70">
                            <tr>
                                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    Customer
                                </th>
                                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    Bank
                                </th>
                                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    Rekening
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
                            {applications.map(
                                (app) => (
                                    <tr
                                        key={app.id}
                                        className="group transition-colors hover:bg-gray-50/70"
                                    >
                                        <td className="px-5 py-4">
                                            <p className="text-sm font-semibold text-gray-900">
                                                {app
                                                    .user
                                                    ?.name ??
                                                    "-"}
                                            </p>
                                            <p className="mt-0.5 text-xs text-gray-500">
                                                {app
                                                    .user
                                                    ?.email ??
                                                    "-"}
                                            </p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="text-sm text-gray-700">
                                                {app
                                                    .kyc
                                                    ?.bankName ??
                                                    "-"}
                                            </p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="font-mono text-sm text-gray-700">
                                                {app
                                                    .kyc
                                                    ?.bankAccountNumber ??
                                                    "-"}
                                            </p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span
                                                className={`inline-flex whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                                                    app.status
                                                )}`}
                                            >
                                                {statusLabel(
                                                    app.status
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="whitespace-nowrap text-xs text-gray-500">
                                                {formatDate(
                                                    app.createdAt
                                                )}
                                            </p>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setReviewing(
                                                        app
                                                    );
                                                    setRejectReason(
                                                        ""
                                                    );
                                                }}
                                                className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                                            >
                                                Review
                                            </button>
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>

                {applications.length === 0 && (
                    <div className="border-t border-gray-100 px-6 py-14 text-center">
                        <p className="text-sm font-medium text-gray-900">
                            Belum ada pengajuan
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                            Pengajuan Affiliator
                            dari customer akan
                            muncul di sini.
                        </p>
                    </div>
                )}

                {/* PAGINATION */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                        <p className="text-xs text-gray-500">
                            Halaman {pagination.page}{" "}
                            dari{" "}
                            {pagination.totalPages}
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() =>
                                    setPage((p) =>
                                        Math.max(
                                            1,
                                            p - 1
                                        )
                                    )
                                }
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Sebelumnya
                            </button>
                            <button
                                type="button"
                                disabled={
                                    page >=
                                    pagination.totalPages
                                }
                                onClick={() =>
                                    setPage((p) =>
                                        Math.min(
                                            pagination.totalPages,
                                            p + 1
                                        )
                                    )
                                }
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Selanjutnya
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ==========================================
             * REVIEW MODAL
             * ========================================== */}

            {reviewing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                            <h3 className="text-base font-semibold text-gray-900">
                                Review Pengajuan
                            </h3>
                            <button
                                type="button"
                                onClick={() =>
                                    setReviewing(null)
                                }
                                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
                            {/* Customer Info */}
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-gray-400">
                                        Customer
                                    </p>
                                    <p className="text-sm font-medium text-gray-900">
                                        {reviewing
                                            .user
                                            ?.name ??
                                            "-"}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {reviewing
                                            .user
                                            ?.email ??
                                            "-"}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {reviewing
                                            .user
                                            ?.phone ??
                                            "-"}
                                    </p>
                                </div>

                                {/* KTP */}
                                {reviewing.kyc
                                    ?.ktpImageUrl && (
                                    <div>
                                        <p className="text-xs text-gray-400">
                                            Foto KTP
                                        </p>
                                        <img
                                            src={
                                                reviewing
                                                    .kyc
                                                    .ktpImageUrl
                                            }
                                            alt="KTP"
                                            className="mt-1 h-40 rounded-lg border border-gray-200 object-cover"
                                        />
                                    </div>
                                )}

                                {/* Bank */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-xs text-gray-400">
                                            Bank
                                        </p>
                                        <p className="text-sm font-medium text-gray-900">
                                            {reviewing
                                                .kyc
                                                ?.bankName ??
                                                "-"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">
                                            Pemilik
                                            Rekening
                                        </p>
                                        <p className="text-sm font-medium text-gray-900">
                                            {reviewing
                                                .kyc
                                                ?.bankAccountName ??
                                                "-"}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">
                                        Nomor Rekening
                                    </p>
                                    <p className="font-mono text-sm font-medium text-gray-900">
                                        {reviewing
                                            .kyc
                                            ?.bankAccountNumber ??
                                            "-"}
                                    </p>
                                </div>

                                {/* Social Media */}
                                {reviewing.kyc
                                    ?.socialMediaPlatform && (
                                    <div>
                                        <p className="text-xs text-gray-400">
                                            Sosial Media
                                        </p>
                                        <p className="text-sm text-gray-700">
                                            {
                                                reviewing
                                                    .kyc
                                                    .socialMediaPlatform
                                            }
                                            {reviewing
                                                .kyc
                                                .socialMediaUsername
                                                ? ` — ${reviewing.kyc.socialMediaUsername}`
                                                : ""}
                                        </p>
                                        {reviewing
                                            .kyc
                                            .socialMediaUrl && (
                                            <img
                                                src={
                                                    reviewing
                                                        .kyc
                                                        .socialMediaUrl
                                                }
                                                alt="Foto Sosial Media"
                                                className="mt-2 h-40 rounded-lg border border-gray-200 object-cover"
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Reject reason if exists */}
                                {reviewing.rejectionReason && (
                                    <div className="rounded-lg bg-red-50 p-3">
                                        <p className="text-xs font-medium text-red-600">
                                            Alasan
                                            Penolakan
                                            Sebelumnya:
                                        </p>
                                        <p className="mt-1 text-sm text-red-700">
                                            {
                                                reviewing.rejectionReason
                                            }
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* REJECT REASON INPUT */}
                            {reviewing.status ===
                                "PENDING" && (
                                <div className="mt-5">
                                    <label className="text-sm font-medium text-gray-700">
                                        Alasan
                                        Penolakan
                                        (jika
                                        Reject)
                                    </label>
                                    <textarea
                                        value={
                                            rejectReason
                                        }
                                        onChange={(e) =>
                                            setRejectReason(
                                                e.target
                                                    .value
                                            )
                                        }
                                        placeholder="Masukkan alasan penolakan..."
                                        rows={3}
                                        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                                    />
                                </div>
                            )}
                        </div>

                        {/* ACTIONS */}
                        {reviewing.status ===
                            "PENDING" && (
                            <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleReject(
                                            reviewing
                                        )
                                    }
                                    disabled={
                                        processing
                                    }
                                    className="flex-1 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {processing
                                        ? "Memproses..."
                                        : "Tolak"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleApprove(
                                            reviewing
                                        )
                                    }
                                    disabled={
                                        processing
                                    }
                                    className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {processing
                                        ? "Memproses..."
                                        : "Setujui"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
