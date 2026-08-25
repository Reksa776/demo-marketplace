"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { FiSearch, FiChevronLeft, FiChevronRight, FiEye, FiEdit } from "react-icons/fi";

type AffiliateItem = {
    id: number;
    name: string;
    email: string;
    affiliateCode: string;
    commissionRate: number;
    status: string;
    clicks: number;
    orders: number;
    totalConversions: number;
    conversionRate: number;
    sales: number;
    totalCommission: number;
    pendingCommission: number;
    approvedCommission: number;
    paidCommission: number;
    approvedAt: string | null;
    createdAt: string;
};

function rupiah(v: number) {
    return `Rp ${Number(v).toLocaleString("id-ID")}`;
}

function statusClass(s: string) {
    const m: Record<string, string> = {
        APPROVED: "bg-emerald-50 text-emerald-700",
        PENDING: "bg-amber-50 text-amber-700",
        REJECTED: "bg-red-50 text-red-700",
        SUSPENDED: "bg-gray-50 text-gray-600",
    };
    return m[s] || "bg-gray-50 text-gray-600";
}

export default function AdminAffiliateManagement() {
    const [items, setItems] = useState<AffiliateItem[]>([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [sort, setSort] = useState("createdAt");
    const [period, setPeriod] = useState("all");

    const load = useCallback(async (p: number, status: string, q: string, s: string, per: string) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.set("page", String(p));
            params.set("limit", "20");
            if (status !== "ALL") params.set("status", status);
            if (q.trim()) params.set("search", q.trim());
            if (s !== "createdAt") params.set("sort", s);
            if (per !== "all") params.set("days", per);

            const res = await fetch(`/api/admin/affiliate?${params.toString()}`, { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) { toast.error(data.message); return; }
            setItems(data.data?.items ?? []);
            setPagination(data.data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 });
        } catch { toast.error("Gagal memuat data."); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(page, statusFilter, search, sort, period); }, [page, load]);

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        setPage(1);
        load(1, statusFilter, search, sort, period);
    }

    function handleStatus(v: string) {
        setStatusFilter(v);
        setPage(1);
        load(1, v, search, sort, period);
    }

    function handleSort(v: string) {
        setSort(v);
        setPage(1);
        load(1, statusFilter, search, v, period);
    }

    function handlePeriod(v: string) {
        setPeriod(v);
        setPage(1);
        load(1, statusFilter, search, sort, v);
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">Affiliate Management</h1>
                <p className="text-sm text-gray-500">Kelola seluruh affiliate dan performa mereka.</p>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-gray-500">Menampilkan {items.length} dari {pagination.total} affiliate</p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <form onSubmit={handleSearch} className="relative">
                                <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, email, kode..." className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-gray-400 sm:w-56" />
                            </form>
                            <select value={statusFilter} onChange={(e) => handleStatus(e.target.value)} className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs outline-none">
                                <option value="ALL">Semua Status</option>
                                <option value="APPROVED">Approved</option>
                                <option value="PENDING">Pending</option>
                                <option value="REJECTED">Rejected</option>
                                <option value="SUSPENDED">Suspended</option>
                            </select>
                            <select value={sort} onChange={(e) => handleSort(e.target.value)} className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs outline-none">
                                <option value="createdAt">Terbaru</option>
                                <option value="sales">Penjualan</option>
                                <option value="commission">Komisi</option>
                                <option value="orders">Order</option>
                                <option value="clicks">Klik</option>
                                <option value="conversion">Conversion Rate</option>
                            </select>
                            <select value={period} onChange={(e) => handlePeriod(e.target.value)} className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs outline-none">
                                <option value="all">Semua Waktu</option>
                                <option value="7">7 Hari</option>
                                <option value="30">30 Hari</option>
                                <option value="90">90 Hari</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px] text-left text-xs">
                        <thead className="border-b border-gray-100 bg-gray-50/70">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-gray-500">Affiliator</th>
                                <th className="px-4 py-3 font-semibold text-gray-500">Kode</th>
                                <th className="px-4 py-3 font-semibold text-gray-500">Rate</th>
                                <th className="px-4 py-3 font-semibold text-gray-500">Klik</th>
                                <th className="px-4 py-3 font-semibold text-gray-500">Konversi</th>
                                <th className="px-4 py-3 font-semibold text-gray-500">Conv. Rate</th>
                                <th className="px-4 py-3 font-semibold text-gray-500">Penjualan</th>
                                <th className="px-4 py-3 font-semibold text-gray-500">Total Komisi</th>
                                <th className="px-4 py-3 font-semibold text-gray-500">Status</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-500">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}><td colSpan={10} className="px-4 py-4"><div className="h-4 animate-pulse rounded bg-gray-100" /></td></tr>
                                ))
                            ) : items.length === 0 ? (
                                <tr><td colSpan={10} className="px-4 py-14 text-center text-sm text-gray-500">Belum ada affiliate.</td></tr>
                            ) : items.map((a) => (
                                <tr key={a.id} className="hover:bg-gray-50/70">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-gray-900">{a.name}</p>
                                        <p className="text-gray-500">{a.email}</p>
                                    </td>
                                    <td className="px-4 py-3 font-mono font-semibold text-gray-900">{a.affiliateCode}</td>
                                    <td className="px-4 py-3 text-gray-700">{a.commissionRate}%</td>
                                    <td className="px-4 py-3 text-gray-700">{a.clicks.toLocaleString("id-ID")}</td>
                                    <td className="px-4 py-3 text-gray-700">{a.totalConversions ?? a.orders}</td>
                                    <td className="px-4 py-3 text-gray-700">{a.conversionRate ?? 0}%</td>
                                    <td className="px-4 py-3 text-gray-700">{rupiah(a.sales)}</td>
                                    <td className="px-4 py-3 font-medium text-emerald-600">{rupiah(a.totalCommission)}</td>
                                    <td className="px-4 py-3"><span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${statusClass(a.status)}`}>{a.status}</span></td>
                                    <td className="px-4 py-3 text-right">
                                        <Link href={`/admin/affiliate/manage/${a.id}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-700 transition hover:bg-gray-50">
                                            <FiEye size={12} /> Detail
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                        <p className="text-xs text-gray-500">Halaman {pagination.page} dari {pagination.totalPages}</p>
                        <div className="flex gap-1">
                            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"><FiChevronLeft size={14} /></button>
                            <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"><FiChevronRight size={14} /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
