"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { FiSearch, FiChevronLeft, FiChevronRight, FiCheck, FiX } from "react-icons/fi";

type PayoutItem = {
    id: number; affiliateId: number; affiliateName: string; affiliateEmail: string;
    affiliateCode: string; amount: number; status: string;
    bankName: string; bankAccountName: string; bankAccountNumber: string;
    requestedAt: string; processedAt: string | null; processedBy: string | null; rejectionReason: string | null;
};

function rupiah(v: number) { return `Rp ${Number(v).toLocaleString("id-ID")}`; }
function fmtDate(s: string) { return new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

const statusLabel: Record<string, string> = { PENDING: "Menunggu", PROCESSING: "Diproses", PAID: "Dibayar", FAILED: "Gagal", REJECTED: "Ditolak", CANCELLED: "Dibatalkan" };
const statusClass: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    PROCESSING: "bg-blue-50 text-blue-700",
    PAID: "bg-emerald-50 text-emerald-700",
    FAILED: "bg-red-50 text-red-700",
    REJECTED: "bg-red-50 text-red-700",
    CANCELLED: "bg-gray-50 text-gray-600",
};

export default function AdminPayoutsPage() {
    const [items, setItems] = useState<PayoutItem[]>([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    // Modal state
    const [modal, setModal] = useState<{ payoutId: number; action: string } | null>(null);
    const [reason, setReason] = useState("");
    const [refNumber, setRefNumber] = useState("");
    const [saving, setSaving] = useState(false);

    const load = useCallback(async (p: number, status: string, q: string) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.set("page", String(p));
            params.set("limit", "20");
            if (status !== "ALL") params.set("status", status);
            if (q.trim()) params.set("search", q.trim());
            const res = await fetch(`/api/admin/affiliate/payouts?${params.toString()}`, { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) { toast.error(data.message); return; }
            setItems(data.data?.items ?? []);
            setPagination(data.data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 });
        } catch { toast.error("Gagal memuat data."); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(page, statusFilter, search); }, [page, load]);

    function handleSearch(e: React.FormEvent) { e.preventDefault(); setPage(1); load(1, statusFilter, search); }
    function handleStatus(v: string) { setStatusFilter(v); setPage(1); load(1, v, search); }

    async function handleAction() {
        if (!modal) return;
        try {
            setSaving(true);
            const body: any = { action: modal.action };
            if (modal.action === "REJECT") body.reason = reason.trim();
            if (modal.action === "CONFIRM_PAID" && refNumber.trim()) body.proofFilePath = refNumber.trim();
            const res = await fetch(`/api/admin/affiliate/payouts/${modal.payoutId}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
            });
            const r = await res.json();
            if (!res.ok) { toast.error(r.message); return; }
            toast.success(r.message);
            setModal(null); setReason(""); setRefNumber("");
            load(page, statusFilter, search);
        } catch { toast.error("Gagal memproses."); }
        finally { setSaving(false); }
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">Payout Management</h1>
                <p className="text-sm text-gray-500">Kelola permintaan pencairan komisi affiliate.</p>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-gray-500">Menampilkan {items.length} dari {pagination.total} payout</p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <form onSubmit={handleSearch} className="relative">
                                <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, kode, rekening..." className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-gray-400 sm:w-56" />
                            </form>
                            <select value={statusFilter} onChange={(e) => handleStatus(e.target.value)} className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs outline-none">
                                <option value="ALL">Semua Status</option>
                                <option value="PENDING">Pending</option>
                                <option value="PROCESSING">Processing</option>
                                <option value="PAID">Paid</option>
                                <option value="FAILED">Failed</option>
                                <option value="REJECTED">Rejected</option>
                                <option value="CANCELLED">Cancelled</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-xs">
                        <thead className="border-b border-gray-100 bg-gray-50/70">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-gray-500">Affiliator</th>
                                <th className="px-4 py-3 font-semibold text-gray-500">Jumlah</th>
                                <th className="px-4 py-3 font-semibold text-gray-500">Bank</th>
                                <th className="px-4 py-3 font-semibold text-gray-500">Rekening</th>
                                <th className="px-4 py-3 font-semibold text-gray-500">Status</th>
                                <th className="px-4 py-3 font-semibold text-gray-500">Tanggal</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-500">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}><td colSpan={7} className="px-4 py-4"><div className="h-4 animate-pulse rounded bg-gray-100" /></td></tr>
                                ))
                            ) : items.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-gray-500">Belum ada payout request.</td></tr>
                            ) : items.map((p) => (
                                <tr key={p.id} className="hover:bg-gray-50/70">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-gray-900">{p.affiliateName}</p>
                                        <p className="font-mono text-gray-500">{p.affiliateCode}</p>
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-gray-900">{rupiah(p.amount)}</td>
                                    <td className="px-4 py-3 text-gray-700">{p.bankName}</td>
                                    <td className="px-4 py-3 font-mono text-gray-700">{p.bankAccountNumber}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${statusClass[p.status] || "bg-gray-50 text-gray-600"}`}>
                                            {statusLabel[p.status] || p.status}
                                        </span>
                                        {p.rejectionReason && <p className="mt-0.5 text-[10px] text-red-500">{p.rejectionReason}</p>}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">{fmtDate(p.requestedAt)}</td>
                                    <td className="px-4 py-3 text-right">
                                        {p.status === "PENDING" && (
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => setModal({ payoutId: p.id, action: "APPROVE" })} className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100">
                                                    <FiCheck size={10} /> Approve & Process
                                                </button>
                                                <button onClick={() => setModal({ payoutId: p.id, action: "REJECT" })} className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-100">
                                                    <FiX size={10} /> Reject
                                                </button>
                                            </div>
                                        )}
                                        {p.status === "PROCESSING" && (
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => setModal({ payoutId: p.id, action: "STATUS" })} className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-100">
                                                    <FiCheck size={10} /> Check Status
                                                </button>
                                                <button onClick={() => setModal({ payoutId: p.id, action: "CONFIRM_PAID" })} className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100">
                                                    <FiCheck size={10} /> Confirm Paid
                                                </button>
                                            </div>
                                        )}
                                        {p.status === "PAID" && (
                                            <button onClick={() => setModal({ payoutId: p.id, action: "SETTLE" })} className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-100">
                                                <FiCheck size={10} /> Settle
                                            </button>
                                        )}
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

            {/* Action Modal */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
                        <div className="border-b border-gray-100 px-6 py-4">
                            <h3 className="text-base font-semibold text-gray-900">
                                {modal.action === "APPROVE" ? "Approve & Process Payout" : modal.action === "REJECT" ? "Reject Payout" : modal.action === "STATUS" ? "Check Provider Status" : modal.action === "CONFIRM_PAID" ? "Confirm Payment Success" : "Retry Settlement"}
                            </h3>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            {modal.action === "REJECT" && (
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Alasan Penolakan *</label>
                                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-rose-400" placeholder="Contoh: Data rekening tidak valid..." />
                                </div>
                            )}
                            {modal.action === "APPROVE" && (
                                <p className="text-sm text-gray-600">Konfirmasi approve payout ini? Dana akan dikirim ke rekening affiliator melalui payment provider.</p>
                            )}
                            {modal.action === "CONFIRM_PAID" && (
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-600">Konfirmasi bahwa pembayaran sudah berhasil? Payout akan berubah ke status PAID dan komisi akan di-settle.</p>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Bukti Pembayaran (opsional)</label>
                                        <p className="text-xs text-gray-400">Path file bukti transfer (jika ada)</p>
                                        <input type="text" value={refNumber} onChange={(e) => setRefNumber(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" placeholder="storage/uploads/affiliate/payout-proof/..." />
                                    </div>
                                </div>
                            )}
                            {modal.action === "STATUS" && (
                                <p className="text-sm text-gray-600">Cek status payout ini dengan provider? Jika provider mengkonfirmasi success, payout akan otomatis menjadi PAID.</p>
                            )}
                            {modal.action === "SETTLE" && (
                                <p className="text-sm text-gray-600">Retry commission settlement? Ini tidak mengirim uang lagi, hanya menyelesaikan pencatatan commission.</p>
                            )}
                        </div>
                        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                            <button onClick={() => { setModal(null); setReason(""); setRefNumber(""); }} className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
                            <button onClick={handleAction} disabled={saving || (modal.action === "REJECT" && !reason.trim())}
                                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${
                                    modal.action === "APPROVE" ? "bg-emerald-600 hover:bg-emerald-700" :
                                    modal.action === "STATUS" ? "bg-blue-600 hover:bg-blue-700" :
                                    modal.action === "CONFIRM_PAID" ? "bg-emerald-600 hover:bg-emerald-700" :
                                    modal.action === "SETTLE" ? "bg-gray-600 hover:bg-gray-700" :
                                    "bg-red-600 hover:bg-red-700"
                                }`}>
                                {saving ? "Memproses..." : modal.action === "APPROVE" ? "Approve & Process" : modal.action === "STATUS" ? "Check Status" : modal.action === "CONFIRM_PAID" ? "Confirm Paid" : modal.action === "SETTLE" ? "Retry Settlement" : "Reject"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
