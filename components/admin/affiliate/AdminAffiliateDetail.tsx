"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { useDialog } from "@/components/ui/Dialog";
import Link from "next/link";
import { FiArrowLeft, FiDollarSign, FiShoppingBag, FiMousePointer, FiTarget, FiEdit, FiCheck } from "react-icons/fi";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type DetailData = {
    profile: {
        id: number; name: string; email: string; phone: string;
        affiliateCode: string; commissionRate: number; status: string;
        approvedAt: string | null; bankName: string; bankAccountName: string; bankAccountNumber: string;
        socialMediaPlatform?: string; socialMediaUsername?: string; socialMediaUrl?: string;
        ktpImageUrl?: string;
    };
    stats: {
        clicks: number; orders: number; conversions: number; totalSales: number;
        totalCommission: number; conversionRate: number; averageOrderValue: number; monthlySales: number;
    };
    commission: {
        pending: { count: number; amount: number; sales: number };
        approved: { count: number; amount: number; sales: number };
        paid: { count: number; amount: number; sales: number };
        cancelled: { count: number; amount: number; sales: number };
        total: number;
    };
    conversions: Array<{
        id: number; orderNumber: string; orderDate: string; orderSubtotal: number;
        commissionRate: number; commissionAmount: number; status: string; createdAt: string;
    }>;
    pendingPayouts: Array<{ id: number; amount: number; status: string; requestedAt: string }>;
    balance: { available: number; pending: number; approved: number; paid: number; totalEarned: number };
    allPayouts: Array<{ id: number; amount: number; status: string; bankName: string; bankAccountName: string; bankAccountNumber: string; requestedAt: string; processedAt: string | null; processedBy: string | null; rejectionReason: string | null }>;
    chart: Array<{ date: string; clicks: number; conversions: number; sales: number; commission: number }>;
    auditLogs: Array<{ id: number; adminId: string; action: string; description: string; metadata: any; createdAt: string }>;
};

function rupiah(v: number) { return `Rp ${Number(v).toLocaleString("id-ID")}`; }
function fmtDate(s: string) { return new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }); }

const statusLabel: Record<string, string> = { PENDING: "Menunggu", APPROVED: "Disetujui", PAID: "Dibayar", CANCELLED: "Dibatalkan", REVERSED: "Dikembalikan" };
const statusClass: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700", APPROVED: "bg-emerald-50 text-emerald-700",
    PAID: "bg-blue-50 text-blue-700", CANCELLED: "bg-red-50 text-red-700",
};

export default function AdminAffiliateDetail({ id }: { id: string }) {
    const dialog = useDialog();
    const [data, setData] = useState<DetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingRate, setEditingRate] = useState(false);
    const [newRate, setNewRate] = useState("");
    const [saving, setSaving] = useState(false);

    // Commission action state
    const [actionModal, setActionModal] = useState<{ convId: number; action: string } | null>(null);
    const [actionReason, setActionReason] = useState("");
    const [actionRef, setActionRef] = useState("");

    // Chart state
    const [chartMetric, setChartMetric] = useState<"clicks" | "conversions" | "sales" | "commission">("clicks");

    // Image preview state
    const [previewImage, setPreviewImage] = useState<{ url: string; label: string } | null>(null);
    const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/admin/affiliate/${id}`, { cache: "no-store" });
            const result = await res.json();
            if (result.success) setData(result.data);
            else toast.error(result.message);
        } catch { toast.error("Gagal memuat data."); }
        finally { setLoading(false); }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const [confirmRate, setConfirmRate] = useState(false);

    async function saveRate() {
        const rate = parseFloat(newRate);
        if (isNaN(rate) || rate < 0 || rate > 50) { toast.error("Rate harus 0-50%."); return; }
        if (!confirmRate) {
            setConfirmRate(true);
            return;
        }
        try {
            setSaving(true);
            const res = await fetch(`/api/admin/affiliate/${id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "UPDATE_RATE", rate }),
            });
            const r = await res.json();
            if (!res.ok) { toast.error(r.message); return; }
            toast.success(r.message);
            setEditingRate(false);
            setConfirmRate(false);
            load();
        } catch { toast.error("Gagal update rate."); }
        finally { setSaving(false); }
    }

    async function handleConvAction() {
        if (!actionModal) return;
        const { convId, action } = actionModal;
        try {
            setSaving(true);
            const body: any = { action };
            if (action === "CANCEL" && actionReason.trim()) body.reason = actionReason.trim();
            const res = await fetch(`/api/admin/affiliate/commissions/${convId}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
            });
            const r = await res.json();
            if (!res.ok) { toast.error(r.message); return; }
            toast.success(r.message);
            setActionModal(null); setActionReason("");
            load();
        } catch { toast.error("Gagal memproses."); }
        finally { setSaving(false); }
    }

    if (loading) return <main className="p-6"><div className="animate-pulse space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-gray-100" />)}</div></main>;
    if (!data) return <main className="p-6 text-center text-gray-500">Data tidak ditemukan.</main>;

    const { profile, stats, commission, conversions, pendingPayouts, auditLogs } = data;

    return (
        <main className="p-4 sm:p-6">
            <Link href="/admin/affiliate" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"><FiArrowLeft size={14} /> Kembali</Link>

            {/* Profile */}
            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">{profile.name}</h2>
                        <p className="text-sm text-gray-500">{profile.email} • {profile.phone}</p>
                        <div className="mt-2 flex items-center gap-3">
                            <span className="font-mono text-sm font-bold text-gray-900">{profile.affiliateCode}</span>
                            <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${statusClass[profile.status] || "bg-gray-50 text-gray-600"}`}>{profile.status}</span>
                            {profile.approvedAt && <span className="text-xs text-gray-400">Sejak {fmtDate(profile.approvedAt)}</span>}
                        </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                        <p>Bank: {profile.bankName}</p>
                        <p>Rekening: {profile.bankAccountName} • {profile.bankAccountNumber}</p>
                        {profile.socialMediaPlatform && (
                            <p className="mt-1">Social: {profile.socialMediaPlatform} • {profile.socialMediaUsername}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* KYC Documents */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {/* KTP Preview */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Foto KTP</h3>
                    {profile.ktpImageUrl && !imageErrors["ktp"] ? (
                        <div className="mt-3">
                            <button type="button" onClick={() => setPreviewImage({ url: profile.ktpImageUrl!, label: "Foto KTP" })}
                                className="block w-full overflow-hidden rounded-xl border border-gray-200 transition hover:opacity-90">
                                <img src={profile.ktpImageUrl} alt="KTP" className="h-48 w-full object-cover"
                                    onError={() => setImageErrors((prev) => ({ ...prev, ktp: true }))} />
                            </button>
                            <p className="mt-2 text-xs text-gray-400">Klik untuk memperbesar</p>
                        </div>
                    ) : (
                        <div className="mt-3 flex h-48 items-center justify-center rounded-xl bg-gray-50">
                            <p className="text-sm text-gray-400">File tidak tersedia</p>
                        </div>
                    )}
                </div>

                {/* Social Media Preview */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Foto Social Media</h3>
                    {profile.socialMediaPlatform && (
                        <p className="mt-1 text-xs text-gray-500">{profile.socialMediaPlatform} • {profile.socialMediaUsername}</p>
                    )}
                    {profile.socialMediaUrl && !imageErrors["social"] ? (
                        <div className="mt-3">
                            <button type="button" onClick={() => setPreviewImage({ url: profile.socialMediaUrl!, label: "Foto Social Media" })}
                                className="block w-full overflow-hidden rounded-xl border border-gray-200 transition hover:opacity-90">
                                <img src={profile.socialMediaUrl} alt="Social Media" className="h-48 w-full object-cover"
                                    onError={() => setImageErrors((prev) => ({ ...prev, social: true }))} />
                            </button>
                            <p className="mt-2 text-xs text-gray-400">Klik untuk memperbesar</p>
                        </div>
                    ) : (
                        <div className="mt-3 flex h-48 items-center justify-center rounded-xl bg-gray-50">
                            <p className="text-sm text-gray-400">File tidak tersedia</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewImage(null)}>
                    <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setPreviewImage(null)} className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg text-gray-600 hover:text-gray-900">✕</button>
                        <img src={previewImage.url} alt={previewImage.label} className="max-h-[85vh] max-w-[85vw] rounded-xl object-contain" />
                        <p className="mt-2 text-center text-sm text-white/80">{previewImage.label}</p>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={FiMousePointer} label="Klik" value={stats.clicks.toLocaleString("id-ID")} />
                <StatCard icon={FiShoppingBag} label="Order" value={String(stats.orders)} sub={`${stats.conversions} konversi`} />
                <StatCard icon={FiDollarSign} label="Penjualan" value={rupiah(stats.totalSales)} sub={`Rata-rata ${rupiah(stats.averageOrderValue)}`} />
                <StatCard icon={FiTarget} label="Conv. Rate" value={`${stats.conversionRate}%`} />
            </div>

            {/* Commission Rate */}
            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Commission Rate</h3>
                    {!editingRate ? (
                        <button onClick={() => { setEditingRate(true); setNewRate(String(profile.commissionRate)); }} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                            <FiEdit size={12} /> Edit
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <input type="number" step="0.01" min="0" max="50" value={newRate} onChange={(e) => { setNewRate(e.target.value); setConfirmRate(false); }} className="h-8 w-20 rounded-lg border border-gray-200 px-2 text-xs" />
                            <span className="text-xs text-gray-500">%</span>
                            {confirmRate ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-amber-600 font-medium">Yakin ubah rate?</span>
                                    <button onClick={saveRate} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                                        <FiCheck size={12} /> {saving ? "..." : "Ya, Simpan"}
                                    </button>
                                    <button onClick={() => setConfirmRate(false)} className="text-xs text-gray-500 hover:text-gray-700">Batal</button>
                                </div>
                            ) : (
                                <button onClick={saveRate} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                                    <FiCheck size={12} /> {saving ? "..." : "Simpan"}
                                </button>
                            )}
                            <button onClick={() => { setEditingRate(false); setConfirmRate(false); }} className="text-xs text-gray-500 hover:text-gray-700">Batal</button>
                        </div>
                    )}
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">{profile.commissionRate}%</p>
                <p className="mt-1 text-xs text-gray-400">Rate baru berlaku untuk order berikutnya. Historical commission tidak berubah.</p>
            </div>

            {/* Commission Breakdown */}
            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900">Commission Breakdown</h3>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <CommCard label="Pending" count={commission.pending.count} amount={commission.pending.amount} color="amber" />
                    <CommCard label="Approved" count={commission.approved.count} amount={commission.approved.amount} color="emerald" />
                    <CommCard label="Paid" count={commission.paid.count} amount={commission.paid.amount} color="blue" />
                    <CommCard label="Cancelled" count={commission.cancelled.count} amount={commission.cancelled.amount} color="red" />
                </div>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                    <p className="text-sm font-medium text-gray-600">Total Komisi</p>
                    <p className="text-lg font-bold text-emerald-600">{rupiah(commission.total)}</p>
                </div>
            </div>

            {/* Financial Summary */}
            {data.balance && (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Ringkasan Keuangan</h3>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-xl bg-emerald-50 p-3">
                            <p className="text-[11px] font-medium text-emerald-600">Saldo Tersedia</p>
                            <p className="mt-1 text-lg font-bold text-emerald-700">{rupiah(data.balance.available)}</p>
                        </div>
                        <div className="rounded-xl bg-amber-50 p-3">
                            <p className="text-[11px] font-medium text-amber-600">Pending</p>
                            <p className="mt-1 text-lg font-bold text-amber-700">{rupiah(data.balance.pending)}</p>
                        </div>
                        <div className="rounded-xl bg-blue-50 p-3">
                            <p className="text-[11px] font-medium text-blue-600">Sudah Dibayar</p>
                            <p className="mt-1 text-lg font-bold text-blue-700">{rupiah(data.balance.paid)}</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-3">
                            <p className="text-[11px] font-medium text-gray-600">Total Earned</p>
                            <p className="mt-1 text-lg font-bold text-gray-900">{rupiah(data.balance.totalEarned)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Payout History */}
            {data.allPayouts && data.allPayouts.length > 0 && (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-100 px-5 py-4">
                        <h3 className="text-sm font-semibold text-gray-900">Riwayat Payout</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] text-left text-xs">
                            <thead className="border-b border-gray-100 bg-gray-50/70">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-gray-500">ID</th>
                                    <th className="px-4 py-3 font-semibold text-gray-500">Jumlah</th>
                                    <th className="px-4 py-3 font-semibold text-gray-500">Bank</th>
                                    <th className="px-4 py-3 font-semibold text-gray-500">Status</th>
                                    <th className="px-4 py-3 font-semibold text-gray-500">Tanggal</th>
                                    <th className="px-4 py-3 font-semibold text-gray-500">Catatan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.allPayouts.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50/70">
                                        <td className="px-4 py-2.5 font-medium text-gray-900">#{p.id}</td>
                                        <td className="px-4 py-2.5 font-semibold text-gray-900">{rupiah(p.amount)}</td>
                                        <td className="px-4 py-2.5 text-gray-700">{p.bankName} • {p.bankAccountNumber}</td>
                                        <td className="px-4 py-2.5"><span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${statusClass[p.status] || "bg-gray-50 text-gray-600"}`}>{statusLabel[p.status] || p.status}</span></td>
                                        <td className="px-4 py-2.5 text-gray-500">{fmtDate(p.requestedAt)}</td>
                                        <td className="px-4 py-2.5 text-gray-500">
                                            {p.processedAt && <p>Diproses: {fmtDate(p.processedAt)}</p>}
                                            {p.rejectionReason && <p className="text-red-500">{p.rejectionReason}</p>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Admin Actions */}
            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900">Admin Actions</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                    {profile.status !== "SUSPENDED" && (
                        <button onClick={async () => {
                            if (!(await dialog.confirm({ title: "Suspend Affiliate", message: `Suspend affiliate ${profile.name}?`, variant: "danger", confirmText: "Suspend" }))) return;
                            try {
                                setSaving(true);
                                const res = await fetch(`/api/admin/affiliate/${id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "UPDATE_STATUS", status: "SUSPENDED" }),
                                });
                                const r = await res.json();
                                if (!res.ok) { toast.error(r.message); return; }
                                toast.success(r.message);
                                load();
                            } catch { toast.error("Gagal suspend."); }
                            finally { setSaving(false); }
                        }} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">Suspend</button>
                    )}
                    {profile.status === "SUSPENDED" && (
                        <button onClick={async () => {
                            if (!(await dialog.confirm({ title: "Activate Affiliate", message: `Activate affiliate ${profile.name}?`, variant: "info", confirmText: "Activate" }))) return;
                            try {
                                setSaving(true);
                                const res = await fetch(`/api/admin/affiliate/${id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "UPDATE_STATUS", status: "APPROVED" }),
                                });
                                const r = await res.json();
                                if (!res.ok) { toast.error(r.message); return; }
                                toast.success(r.message);
                                load();
                            } catch { toast.error("Gagal activate."); }
                            finally { setSaving(false); }
                        }} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">Activate</button>
                    )}
                </div>
            </div>

            {/* Performance Chart */}
            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Grafik Performa (90 Hari)</h3>
                    <div className="flex gap-1">
                        {(["clicks", "conversions", "sales", "commission"] as const).map((m) => (
                            <button key={m} type="button" onClick={() => setChartMetric(m)}
                                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${chartMetric === m ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                                {m === "clicks" ? "Klik" : m === "conversions" ? "Konversi" : m === "sales" ? "Penjualan" : "Komisi"}
                            </button>
                        ))}
                    </div>
                </div>
                {data.chart.length > 0 ? (
                    <div className="mt-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.chart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorMetricAdmin" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }}
                                    tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; }}
                                    stroke="#e5e7eb" />
                                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} stroke="#e5e7eb" />
                                <Tooltip
                                    contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                                    labelFormatter={(v) => fmtDate(String(v))}
                                    formatter={(value: any) => { const v = Number(value); return chartMetric === "sales" || chartMetric === "commission" ? rupiah(v) : v.toLocaleString("id-ID"); }}
                                />
                                <Area type="monotone" dataKey={chartMetric} stroke="#6366f1" strokeWidth={2}
                                    fillOpacity={1} fill="url(#colorMetricAdmin)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="mt-4 flex h-64 items-center justify-center rounded-xl bg-gray-50">
                        <p className="text-sm text-gray-400">Belum ada data performa</p>
                    </div>
                )}
            </div>

            {/* Pending Payouts */}
            {pendingPayouts.length > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <h3 className="text-sm font-semibold text-amber-800">Pending Payouts</h3>
                    {pendingPayouts.map((p) => (
                        <div key={p.id} className="mt-2 flex items-center justify-between text-xs">
                            <span className="text-amber-700">Payout #{p.id} — {fmtDate(p.requestedAt)}</span>
                            <span className="font-semibold text-amber-900">{rupiah(p.amount)} ({p.status})</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Conversion History */}
            <div className="mt-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-4">
                    <h3 className="text-sm font-semibold text-gray-900">Riwayat Konversi (50 terbaru)</h3>
                </div>
                {conversions.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-gray-500">Belum ada konversi.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] text-left text-xs">
                            <thead className="border-b border-gray-100 bg-gray-50/70">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-gray-500">Order</th>
                                    <th className="px-4 py-3 font-semibold text-gray-500">Tanggal</th>
                                    <th className="px-4 py-3 font-semibold text-gray-500">Subtotal</th>
                                    <th className="px-4 py-3 font-semibold text-gray-500">Rate</th>
                                    <th className="px-4 py-3 font-semibold text-gray-500">Komisi</th>
                                    <th className="px-4 py-3 font-semibold text-gray-500">Status</th>
                                    <th className="px-4 py-3 text-right font-semibold text-gray-500">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {conversions.map((c) => (
                                    <tr key={c.id} className="hover:bg-gray-50/70">
                                        <td className="px-4 py-2.5 font-medium text-gray-900">{c.orderNumber}</td>
                                        <td className="px-4 py-2.5 text-gray-500">{fmtDate(c.createdAt)}</td>
                                        <td className="px-4 py-2.5 text-gray-700">{rupiah(c.orderSubtotal)}</td>
                                        <td className="px-4 py-2.5 text-gray-500">{c.commissionRate}%</td>
                                        <td className="px-4 py-2.5 font-medium text-emerald-600">{rupiah(c.commissionAmount)}</td>
                                        <td className="px-4 py-2.5"><span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${statusClass[c.status] || "bg-gray-50 text-gray-600"}`}>{statusLabel[c.status] || c.status}</span></td>
                                        <td className="px-4 py-2.5 text-right">
                                            {(c.status === "PENDING" || c.status === "APPROVED") && (
                                                <div className="flex justify-end gap-1">
                                                    {c.status === "PENDING" && (
                                                        <button onClick={() => { setActionModal({ convId: c.id, action: "APPROVE" }); }} className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100">Approve</button>
                                                    )}
                                                    <button onClick={() => { setActionModal({ convId: c.id, action: "CANCEL" }); }} className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-100">Cancel</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Audit Log */}
            {auditLogs && auditLogs.length > 0 && (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-100 px-5 py-4">
                        <h3 className="text-sm font-semibold text-gray-900">Riwayat Aktivitas</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {auditLogs.map((log) => (
                            <div key={log.id} className="px-5 py-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-gray-900">{log.description}</p>
                                        <p className="mt-0.5 text-[11px] text-gray-400">Admin: {log.adminId}</p>
                                    </div>
                                    <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                                        {log.action}
                                    </span>
                                </div>
                                <p className="mt-0.5 text-[10px] text-gray-400">{fmtDate(log.createdAt)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Modal */}
            {actionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
                        <div className="border-b border-gray-100 px-6 py-4">
                            <h3 className="text-base font-semibold text-gray-900">
                                {actionModal.action === "APPROVE" ? "Approve Komisi" : "Cancel Komisi"}
                            </h3>
                        </div>
                        <div className="px-6 py-5">
                            {actionModal.action === "CANCEL" && (
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Alasan Pembatalan *</label>
                                    <textarea value={actionReason} onChange={(e) => setActionReason(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-rose-400" placeholder="Contoh: Order dibatalkan oleh customer..." />
                                </div>
                            )}
                            {actionModal.action === "APPROVE" && (
                                <p className="text-sm text-gray-600">Konfirmasi approve komisi ini?</p>
                            )}
                        </div>
                        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                            <button onClick={() => { setActionModal(null); setActionReason(""); }} className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
                            <button onClick={handleConvAction} disabled={saving || (actionModal.action === "CANCEL" && !actionReason.trim())}
                                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${actionModal.action === "APPROVE" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
                                {saving ? "Memproses..." : actionModal.action === "APPROVE" ? "Approve" : "Cancel"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2"><Icon size={14} className="text-gray-400" /><p className="text-xs text-gray-500">{label}</p></div>
            <p className="mt-2 text-xl font-bold text-gray-900">{value}</p>
            {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
        </div>
    );
}

function CommCard({ label, count, amount, color }: { label: string; count: number; amount: number; color: string }) {
    const c: Record<string, string> = { amber: "border-l-amber-400", emerald: "border-l-emerald-400", blue: "border-l-blue-400", red: "border-l-red-400" };
    return (
        <div className={`rounded-xl border border-gray-100 border-l-4 bg-gray-50 p-3 ${c[color]}`}>
            <p className="text-[11px] font-medium text-gray-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{count}</p>
            <p className="text-xs text-gray-500">{rupiah(amount)}</p>
        </div>
    );
}
