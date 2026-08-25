"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import {
    FiArrowLeft,
    FiDollarSign,
    FiClock,
    FiCheck,
    FiX,
    FiAlertCircle,
    FiChevronLeft,
    FiChevronRight,
    FiFileText,
    FiExternalLink,
} from "react-icons/fi";

/* ==========================================
 * TYPES
 * ========================================== */

type PayoutItem = {
    id: number;
    amount: number;
    status: string;
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    requestedAt: string;
    processedAt: string | null;
    paidAt: string | null;
    providerReference: string | null;
    proofFilePath: string | null;
    rejectionReason: string | null;
    failureReason: string | null;
};

type BalanceData = {
    available: number;
    pending: number;
    paid: number;
    totalEarned: number;
};

/* ==========================================
 * HELPERS
 * ========================================== */

function rupiah(value: number) {
    return `Rp ${Number(value).toLocaleString("id-ID")}`;
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function statusLabel(status: string) {
    const map: Record<string, string> = {
        PENDING: "Menunggu persetujuan admin",
        PROCESSING: "Disetujui — sedang diproses",
        PAID: "Pembayaran berhasil",
        FAILED: "Pembayaran gagal",
        REJECTED: "Pengajuan ditolak",
        CANCELLED: "Pengajuan dibatalkan",
    };
    return map[status] || status;
}

function statusClass(status: string) {
    const map: Record<string, string> = {
        PENDING: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
        PROCESSING: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
        PAID: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
        FAILED: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
        REJECTED: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
        CANCELLED: "bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-200",
    };
    return map[status] || "bg-gray-50 text-gray-600";
}

/* ==========================================
 * MAIN COMPONENT
 * ========================================== */

export default function AffiliatePayoutsPage() {
    const [payouts, setPayouts] = useState<PayoutItem[]>([]);
    const [balance, setBalance] = useState<BalanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [withdrawAmount, setWithdrawAmount] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [proofModal, setProofModal] = useState<PayoutItem | null>(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [payoutsRes, dashRes] = await Promise.all([
                fetch("/api/affiliate/payouts", { cache: "no-store" }),
                fetch("/api/affiliate/dashboard?limit=1", { cache: "no-store" }),
            ]);

            const payoutsData = await payoutsRes.json();
            if (payoutsRes.ok && payoutsData.success) {
                setPayouts(payoutsData.data ?? []);
            }

            const dashData = await dashRes.json();
            if (dashRes.ok && dashData.success && dashData.data.balance) {
                setBalance(dashData.data.balance);
            }
        } catch {
            toast.error("Gagal memuat data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    async function handleWithdraw() {
        const amount = parseFloat(withdrawAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error("Jumlah tidak valid.");
            return;
        }

        if (balance && amount > balance.available) {
            toast.error(`Saldo tidak mencukupi. Tersedia: ${rupiah(balance.available)}`);
            return;
        }

        if (!confirming) {
            setConfirming(true);
            return;
        }

        try {
            setSubmitting(true);
            const res = await fetch("/api/affiliate/payouts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || "Gagal mengajukan pencairan.");
            }
            toast.success("Permintaan pencairan berhasil diajukan!");
            setWithdrawAmount("");
            setConfirming(false);
            loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Gagal mengajukan pencairan.");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <main className="mx-auto min-h-screen max-w-4xl bg-gray-50 p-4 sm:p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-48 rounded-lg bg-gray-200" />
                    <div className="h-36 rounded-2xl bg-gray-200" />
                    <div className="h-64 rounded-2xl bg-gray-200" />
                </div>
            </main>
        );
    }

    return (
        <main className="mx-auto min-h-screen max-w-4xl bg-gray-50 p-4 sm:p-6">
            <Link href="/affiliate/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
                <FiArrowLeft size={14} /> Kembali ke Dashboard
            </Link>

            <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">Pencairan Komisi</h1>

            {/* Balance Card */}
            {balance && (
                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                        <FiDollarSign size={18} className="text-emerald-600" />
                        <h2 className="text-sm font-semibold text-emerald-800">Saldo Tersedia</h2>
                    </div>
                    <p className="mt-2 text-4xl font-bold text-emerald-700">{rupiah(balance.available)}</p>
                    <p className="mt-1 text-xs text-emerald-600">Dapat dicairkan kapan saja</p>
                </div>
            )}

            {/* Withdrawal Form */}
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900">Ajukan Pencairan</h3>
                <div className="mt-4 space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">Jumlah (Rp)</label>
                        <input
                            type="number"
                            min="1"
                            step="1000"
                            value={withdrawAmount}
                            onChange={(e) => { setWithdrawAmount(e.target.value); setConfirming(false); }}
                            placeholder="Masukkan jumlah pencairan"
                            className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        />
                        {balance && (
                            <p className="mt-1 text-xs text-gray-400">
                                Maksimal: {rupiah(balance.available)}
                                <button
                                    type="button"
                                    onClick={() => { setWithdrawAmount(String(Math.floor(balance.available))); setConfirming(false); }}
                                    className="ml-2 font-medium text-emerald-600 hover:text-emerald-700"
                                >
                                    Gunakan Semua
                                </button>
                            </p>
                        )}
                    </div>
                    {balance && balance.available < 10000 && (
                        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3">
                            <FiAlertCircle size={16} className="mt-0.5 text-amber-500" />
                            <p className="text-xs text-amber-700">Saldo minimum untuk pencairan adalah Rp 10.000</p>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={handleWithdraw}
                        disabled={submitting || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                        className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {submitting ? "Memproses..." : confirming ? "Konfirmasi Pencairan" : "Ajukan Pencairan"}
                    </button>
                    {confirming && (
                        <p className="text-xs text-center text-amber-600">
                            Klik sekali lagi untuk konfirmasi pencairan sebesar {rupiah(parseFloat(withdrawAmount) || 0)}
                        </p>
                    )}
                </div>
            </div>

            {/* Payout History */}
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-4">
                    <h3 className="text-sm font-semibold text-gray-900">Riwayat Pencairan</h3>
                </div>
                {payouts.length === 0 ? (
                    <div className="px-5 py-16 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                            <FiDollarSign size={20} className="text-gray-400" />
                        </div>
                        <p className="mt-4 text-sm font-medium text-gray-900">Belum ada riwayat pencairan</p>
                        <p className="mt-1 text-xs text-gray-500">Ajukan pencairan pertama Anda di atas.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-gray-100 bg-gray-50/70">
                                <tr>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Jumlah</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Bank</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Status</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Tanggal</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Catatan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {payouts.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50/70">
                                        <td className="px-5 py-3">
                                            <p className="font-semibold text-gray-900">{rupiah(p.amount)}</p>
                                            <p className="text-[10px] text-gray-400">#{p.id}</p>
                                        </td>
                                        <td className="px-5 py-3 text-gray-700">{p.bankName} • {p.bankAccountName}</td>
                                        <td className="px-5 py-3">
                                            <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${statusClass(p.status)}`}>
                                                {statusLabel(p.status)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-gray-500">{formatDate(p.requestedAt)}</td>
                                        <td className="px-5 py-3 text-gray-500">
                                            {p.processedAt && <p>Diproses: {formatDate(p.processedAt)}</p>}
                                            {p.paidAt && <p className="text-emerald-600">Dibayar: {formatDate(p.paidAt)}</p>}
                                            {p.providerReference && <p className="text-xs text-gray-400">Ref: {p.providerReference}</p>}
                                            {p.rejectionReason && <p className="text-red-500">Alasan: {p.rejectionReason}</p>}
                                            {p.failureReason && <p className="text-red-500">Gagal: {p.failureReason}</p>}
                                            {p.status === "PAID" && p.proofFilePath && (
                                                <button onClick={() => setProofModal(p)} className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 hover:text-emerald-700">
                                                    <FiFileText size={10} /> Lihat Bukti
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Payment Proof Modal */}
            {proofModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                            <h3 className="text-base font-semibold text-gray-900">Bukti Pembayaran</h3>
                            <button onClick={() => setProofModal(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                                <FiX size={18} />
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div className="rounded-xl bg-emerald-50 p-4">
                                <div className="flex items-center gap-2">
                                    <FiCheck size={16} className="text-emerald-600" />
                                    <span className="text-sm font-semibold text-emerald-700">Pembayaran Berhasil</span>
                                </div>
                                <p className="mt-2 text-2xl font-bold text-emerald-700">{rupiah(proofModal.amount)}</p>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Payout ID</span>
                                    <span className="font-mono text-gray-900">#{proofModal.id}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Tanggal Pembayaran</span>
                                    <span className="text-gray-900">{proofModal.paidAt ? formatDate(proofModal.paidAt) : "-"}</span>
                                </div>
                                {proofModal.providerReference && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Referensi</span>
                                        <span className="font-mono text-gray-900">{proofModal.providerReference}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Rekening Tujuan</span>
                                    <span className="text-gray-900">{proofModal.bankName} • {proofModal.bankAccountNumber}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Nama Pemilik</span>
                                    <span className="text-gray-900">{proofModal.bankAccountName}</span>
                                </div>
                            </div>
                            {proofModal.proofFilePath && (
                                <div className="border-t border-gray-100 pt-4">
                                    <p className="mb-2 text-xs font-medium text-gray-500">Bukti Transfer:</p>
                                    <a
                                        href={`/api/affiliate/payouts/${proofModal.id}/proof`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                                    >
                                        <FiExternalLink size={14} />
                                        Lihat Bukti Pembayaran
                                    </a>
                                </div>
                            )}
                        </div>
                        <div className="border-t border-gray-100 px-6 py-4">
                            <button onClick={() => setProofModal(null)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
