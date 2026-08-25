"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { FiSearch, FiChevronLeft, FiChevronRight, FiClock } from "react-icons/fi";

type AuditLogItem = {
    id: number;
    adminId: string;
    action: string;
    entityType: string;
    entityId: number | null;
    description: string;
    metadata: any;
    createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
    AFFILIATE_APPROVED: "Affiliate Disetujui",
    AFFILIATE_REJECTED: "Affiliate Ditolak",
    AFFILIATE_SUSPENDED: "Affiliate Suspended",
    AFFILIATE_RATE_UPDATED: "Rate Diubah",
    COMMISSION_APPROVED: "Komisi Disetujui",
    COMMISSION_CANCELLED: "Komisi Dibatalkan",
    COMMISSION_PAID: "Komisi Dibayarkan",
    PAYOUT_APPROVED: "Payout Disetujui",
    PAYOUT_REJECTED: "Payout Ditolak",
    PAYOUT_PAID: "Payout Dibayarkan",
    ORDER_CANCELLED: "Order Dibatalkan",
    ORDER_REFUNDED: "Order Refund",
    AFFILIATE_COMMISSION_AUTO_CANCELLED: "Komisi Auto-Cancel",
};

const ACTION_COLORS: Record<string, string> = {
    AFFILIATE_APPROVED: "bg-emerald-50 text-emerald-700",
    AFFILIATE_REJECTED: "bg-red-50 text-red-700",
    AFFILIATE_SUSPENDED: "bg-gray-100 text-gray-600",
    AFFILIATE_RATE_UPDATED: "bg-blue-50 text-blue-700",
    COMMISSION_APPROVED: "bg-emerald-50 text-emerald-700",
    COMMISSION_CANCELLED: "bg-red-50 text-red-700",
    COMMISSION_PAID: "bg-blue-50 text-blue-700",
    PAYOUT_APPROVED: "bg-emerald-50 text-emerald-700",
    PAYOUT_REJECTED: "bg-red-50 text-red-700",
    PAYOUT_PAID: "bg-blue-50 text-blue-700",
    ORDER_CANCELLED: "bg-red-50 text-red-700",
    ORDER_REFUNDED: "bg-amber-50 text-amber-700",
    AFFILIATE_COMMISSION_AUTO_CANCELLED: "bg-orange-50 text-orange-700",
};

function fmtDate(s: string) {
    return new Date(s).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function AdminAuditLogPage() {
    const [items, setItems] = useState<AuditLogItem[]>([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState("");

    const load = useCallback(async (p: number, action: string) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.set("page", String(p));
            params.set("limit", "20");
            if (action) params.set("action", action);

            const res = await fetch(`/api/admin/audit-log?${params.toString()}`, { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) { toast.error(data.message); return; }
            setItems(data.data?.items ?? []);
            setPagination(data.data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 });
        } catch { toast.error("Gagal memuat data."); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(page, actionFilter); }, [page, load]);

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">Riwayat Aktivitas</h1>
                <p className="text-sm text-gray-500">Audit trail untuk semua aksi admin pada affiliate system.</p>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-gray-500">Menampilkan {items.length} dari {pagination.total} aktivitas</p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                                className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs outline-none">
                                <option value="">Semua Aksi</option>
                                {Object.entries(ACTION_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="divide-y divide-gray-100">
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="px-5 py-4"><div className="h-4 animate-pulse rounded bg-gray-100" /></div>
                        ))
                    ) : items.length === 0 ? (
                        <div className="px-5 py-16 text-center text-sm text-gray-500">Belum ada aktivitas.</div>
                    ) : items.map((item) => (
                        <div key={item.id} className="px-5 py-3 hover:bg-gray-50/70">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-gray-900">{item.description}</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${ACTION_COLORS[item.action] || "bg-gray-100 text-gray-600"}`}>
                                            {ACTION_LABELS[item.action] || item.action}
                                        </span>
                                        <span className="text-[11px] text-gray-400">Admin: {item.adminId}</span>
                                        {item.entityId && (
                                            <span className="text-[11px] text-gray-400">{item.entityType} #{item.entityId}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1 text-[11px] text-gray-400">
                                    <FiClock size={12} />
                                    {fmtDate(item.createdAt)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                        <p className="text-xs text-gray-500">Halaman {pagination.page} dari {pagination.totalPages}</p>
                        <div className="flex gap-1">
                            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                                <FiChevronLeft size={14} />
                            </button>
                            <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                                className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                                <FiChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
