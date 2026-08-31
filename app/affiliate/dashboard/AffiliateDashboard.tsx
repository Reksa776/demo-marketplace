"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import {
    FiArrowLeft,
    FiCopy,
    FiCheck,
    FiExternalLink,
    FiDollarSign,
    FiShoppingBag,
    FiMousePointer,
    FiSearch,
    FiChevronLeft,
    FiChevronRight,
    FiShare2,
    FiTrendingUp,
    FiGift,
    FiTarget,
    FiClock,
    FiLink,
    FiArrowUp,
    FiArrowDown,
    FiZap,
    FiInfo,
    FiRefreshCw,
    FiMessageCircle,
    FiSend,
} from "react-icons/fi";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

/* ==========================================
 * TYPES
 * ========================================== */

type Trend = {
    value: number;
    direction: "up" | "down" | "flat";
    percentage: number;
} | null;

type AffiliateData = {
    affiliate: {
        code: string;
        commissionRate: number;
        status: string;
        approvedAt: string | null;
    };
    stats: {
        totalClicks: number;
        totalOrders: number;
        totalConversions: number;
        totalSales: number;
        totalCommission: number;
        conversionRate: number;
        averageOrderValue: number;
    };
    trend: {
        clicks: Trend;
        conversions: Trend;
        sales: Trend;
        commission: Trend;
    } | null;
    funnel: {
        clicks: number;
        orders: number;
        conversions: number;
        commission: number;
        conversionRate: number;
    };
    commission: {
        pending: { count: number; amount: number; sales: number };
        approved: { count: number; amount: number; sales: number };
        paid: { count: number; amount: number; sales: number };
        cancelled: { count: number; amount: number; sales: number };
        total: number;
    };
    earnings: {
        monthlySales: number;
        commissionRate: number;
        estimatedCommission: number;
    };
    balance: {
        available: number;
        pending: number;
        paid: number;
        totalEarned: number;
    };
    payouts: Array<{
        id: number;
        amount: number;
        status: string;
        requestedAt: string;
        processedAt: string | null;
        rejectionReason: string | null;
    }>;
    chart: Array<{
        date: string;
        clicks: number;
        conversions: number;
        sales: number;
        commission: number;
    }>;
    conversions: {
        items: Array<{
            id: number;
            orderNumber: string;
            customerName: string;
            orderTotal: number;
            commissionRate: number;
            commissionAmount: number;
            status: string;
            orderStatus: string;
            paymentStatus: string;
            createdAt: string;
        }>;
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    };
    recentActivity: Array<{
        id: string;
        type: "click" | "conversion" | "commission";
        message: string;
        amount?: number;
        createdAt: string;
    }>;
};

/* ==========================================
 * HELPERS
 * ========================================== */

function rupiah(value: number) {
    if (value >= 1_000_000) {
        return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
    }
    return `Rp ${Number(value).toLocaleString("id-ID")}`;
}

function rupiahFull(value: number) {
    return `Rp ${Number(value).toLocaleString("id-ID")}`;
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function timeAgo(dateStr: string) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "Baru saja";
    if (diffMin < 60) return `${diffMin} menit lalu`;
    if (diffHour < 24) return `${diffHour} jam lalu`;
    if (diffDay < 7) return `${diffDay} hari lalu`;
    return formatDate(dateStr);
}

function conversionStatusLabel(status: string) {
    const map: Record<string, string> = {
        PENDING: "Menunggu",
        APPROVED: "Disetujui",
        PAID: "Dibayar",
        CANCELLED: "Dibatalkan",
        REVERSED: "Dikembalikan",
    };
    return map[status] || status;
}

function conversionStatusClass(status: string) {
    const map: Record<string, string> = {
        PENDING: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
        APPROVED: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
        PAID: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
        CANCELLED: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
        REVERSED: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
    };
    return map[status] || "bg-gray-50 text-gray-600";
}

function getStoreName() {
    if (typeof window !== "undefined") {
        return document.title.split(" - ")[0] || "Toko Kami";
    }
    return "Toko Kami";
}

/* ==========================================
 * MAIN COMPONENT
 * ========================================== */

export default function AffiliateDashboard() {
    const [data, setData] = useState<AffiliateData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<"link" | "code" | null>(null);

    // Filters
    const [convPage, setConvPage] = useState(1);
    const [convSearch, setConvSearch] = useState("");
    const [convStatus, setConvStatus] = useState("");
    const [chartDays, setChartDays] = useState(30);
    const [chartMetric, setChartMetric] = useState<"clicks" | "conversions" | "sales" | "commission">("clicks");

    const loadDashboard = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams();
            params.set("page", String(convPage));
            params.set("limit", "10");
            if (convSearch) params.set("search", convSearch);
            if (convStatus) params.set("status", convStatus);
            params.set("days", String(chartDays));

            const res = await fetch(
                `/api/affiliate/dashboard?${params.toString()}`,
                { cache: "no-store" }
            );
            const result = await res.json();

            if (result.success) {
                setData(result.data);
            } else {
                setError(result.message || "Gagal memuat dashboard.");
            }
        } catch {
            setError("Terjadi kesalahan. Silakan coba lagi.");
        } finally {
            setLoading(false);
        }
    }, [convPage, convSearch, convStatus, chartDays]);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    function getReferralUrl() {
        if (!data) return "";
        const base = typeof window !== "undefined" ? window.location.origin : "";
        return `${base}/?ref=${data.affiliate.code}`;
    }

    async function copyToClipboard(text: string, type: "link" | "code") {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(type);
            toast.success(type === "link" ? "Link referral berhasil disalin!" : "Kode berhasil disalin!");
            setTimeout(() => setCopied(null), 2000);
        } catch {
            toast.error("Gagal menyalin.");
        }
    }

    function shareWhatsApp() {
        const url = getReferralUrl();
        const text = `Yuk belanja di ${getStoreName()} menggunakan link referral saya: ${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    }

    function shareFacebook() {
        const url = getReferralUrl();
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
    }

    function shareTelegram() {
        const url = getReferralUrl();
        const text = `Belanja di ${getStoreName()} pakai link saya: ${url}`;
        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank");
    }

    async function shareNative() {
        const url = getReferralUrl();
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Belanja di ${getStoreName()}`,
                    text: "Gunakan link referral saya:",
                    url,
                });
            } catch { /* cancelled */ }
        } else {
            copyToClipboard(url, "link");
        }
    }

    /* ==========================================
     * LOADING SKELETON
     * ========================================== */

    if (loading && !data) {
        return (
            <main className="mx-auto min-h-screen max-w-6xl bg-gray-50 p-4 sm:p-6">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 w-48 rounded-lg bg-gray-200" />
                    <div className="h-36 rounded-2xl bg-gray-200" />
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-28 rounded-2xl bg-gray-200" />
                        ))}
                    </div>
                    <div className="h-72 rounded-2xl bg-gray-200" />
                    <div className="grid gap-6 lg:grid-cols-3">
                        <div className="h-64 rounded-2xl bg-gray-200 lg:col-span-2" />
                        <div className="h-64 rounded-2xl bg-gray-200" />
                    </div>
                    <div className="h-48 rounded-2xl bg-gray-200" />
                    <div className="h-64 rounded-2xl bg-gray-200" />
                </div>
            </main>
        );
    }

    /* ==========================================
     * ERROR STATE
     * ========================================== */

    if (error && !data) {
        return (
            <main className="mx-auto min-h-screen max-w-6xl bg-gray-50 p-4 sm:p-6">
                <Link href="/affiliate" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
                    <FiArrowLeft size={14} /> Kembali
                </Link>
                <div className="mt-16 flex flex-col items-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                        <FiInfo size={24} className="text-red-400" />
                    </div>
                    <p className="mt-4 text-sm font-medium text-gray-900">{error}</p>
                    <button
                        type="button"
                        onClick={loadDashboard}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
                    >
                        <FiRefreshCw size={14} />
                        Coba Lagi
                    </button>
                </div>
            </main>
        );
    }

    if (!data) return null;

    /* ==========================================
     * RENDER
     * ========================================== */

    const { affiliate, stats, trend, funnel, commission, earnings, chart, conversions, recentActivity } = data;

    return (
        <main className="mx-auto min-h-screen max-w-6xl bg-gray-50 p-4 sm:p-6">
            {/* ===== HEADER ===== */}
            <div className="mb-6">
                <Link href="/affiliate" className="inline-flex items-center gap-1 text-sm text-gray-500 transition hover:text-gray-900">
                    <FiArrowLeft size={14} /> Kembali
                </Link>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Affiliate Dashboard</h1>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                {affiliate.status}
                            </span>
                            <span>•</span>
                            <span className="font-mono font-semibold text-gray-900">{affiliate.code}</span>
                            <span>•</span>
                            <span>{affiliate.commissionRate}% komisi</span>
                            {affiliate.approvedAt && (
                                <>
                                    <span>•</span>
                                    <span>Sejak {formatDate(affiliate.approvedAt)}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== KPI CARDS ===== */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard icon={FiMousePointer} label="Total Klik" value={stats.totalClicks.toLocaleString("id-ID")} trend={trend?.clicks ?? null} color="blue" />
                <KpiCard icon={FiShoppingBag} label="Total Order" value={stats.totalOrders.toLocaleString("id-ID")} sub={`${stats.totalConversions} konversi`} trend={trend?.conversions ?? null} color="violet" />
                <KpiCard icon={FiTrendingUp} label="Total Penjualan" value={rupiah(stats.totalSales)} sub={`Rata-rata ${rupiah(stats.averageOrderValue)}/order`} trend={trend?.sales ?? null} color="amber" />
                <KpiCard icon={FiDollarSign} label="Total Komisi" value={rupiah(stats.totalCommission)} sub={`${affiliate.commissionRate}% rate`} trend={trend?.commission ?? null} color="emerald" />
            </div>

            {/* ===== PERFORMANCE CHART + FUNNEL ===== */}
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">Performa</h3>
                        <div className="flex gap-1">
                            {(["clicks", "conversions", "sales", "commission"] as const).map((m) => (
                                <button key={m} type="button" onClick={() => setChartMetric(m)}
                                    className={`rounded-lg px-3 py-1 text-xs font-medium transition ${chartMetric === m ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                                    {m === "clicks" ? "Klik" : m === "conversions" ? "Konversi" : m === "sales" ? "Penjualan" : "Komisi"}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-1">
                            {[7, 30, 90].map((d) => (
                                <button key={d} type="button" onClick={() => setChartDays(d)}
                                    className={`rounded-lg px-2 py-1 text-[11px] font-medium transition ${chartDays === d ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}>
                                    {d}H
                                </button>
                            ))}
                        </div>
                    </div>

                    {chart.length > 0 ? (
                        <div className="mt-4 h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
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
                                        labelFormatter={(v) => formatDate(String(v))}
                                        formatter={(value: any) => { const v = Number(value); return chartMetric === "sales" || chartMetric === "commission" ? rupiahFull(v) : v.toLocaleString("id-ID"); }}
                                    />
                                    <Area type="monotone" dataKey={chartMetric} stroke="#6366f1" strokeWidth={2}
                                        fillOpacity={1} fill="url(#colorMetric)" name={chartMetric === "clicks" ? "Klik" : chartMetric === "conversions" ? "Konversi" : chartMetric === "sales" ? "Penjualan" : "Komisi"} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="mt-4 flex h-64 items-center justify-center rounded-xl bg-gray-50">
                            <p className="text-sm text-gray-400">Belum ada data performa</p>
                        </div>
                    )}
                </div>

                {/* Funnel */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Conversion Funnel</h3>
                    <p className="mt-1 text-xs text-gray-400">{chartDays} hari terakhir</p>
                    <div className="mt-5 space-y-3">
                        <FunnelStep label="Klik" value={funnel.clicks} pct={100} color="bg-blue-500" w="100%" />
                        <FunnelStep label="Order" value={funnel.orders}
                            pct={funnel.clicks > 0 ? Math.round((funnel.orders / funnel.clicks) * 100) : 0}
                            color="bg-violet-500"
                            w={funnel.clicks > 0 ? `${Math.round((funnel.orders / funnel.clicks) * 100)}%` : "0%"} />
                        <FunnelStep label="Konversi" value={funnel.conversions}
                            pct={funnel.clicks > 0 ? Math.round((funnel.conversions / funnel.clicks) * 100) : 0}
                            color="bg-emerald-500"
                            w={funnel.clicks > 0 ? `${Math.max(5, Math.round((funnel.conversions / funnel.clicks) * 100))}%` : "0%"} />
                    </div>
                    <div className="mt-5 rounded-xl bg-gray-50 p-3 text-center">
                        <p className="text-xs text-gray-500">Conversion Rate</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{funnel.conversionRate}%</p>
                    </div>
                </div>
            </div>

            {/* ===== REFERRAL LINK CENTER ===== */}
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <FiLink size={16} className="text-gray-400" />
                            <p className="text-xs font-medium text-gray-500">Referral Link Anda</p>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                            <p className="font-mono text-2xl font-bold tracking-wider text-gray-900">{affiliate.code}</p>
                        </div>
                        <div className="mt-2 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                            <code className="min-w-0 flex-1 truncate text-xs text-gray-500">{getReferralUrl()}</code>
                        </div>
                        <p className="mt-2 text-[11px] text-gray-400">Komisi {affiliate.commissionRate}% per order dari subtotal</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => copyToClipboard(getReferralUrl(), "link")}
                            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800">
                            {copied === "link" ? <FiCheck size={14} /> : <FiCopy size={14} />}
                            {copied === "link" ? "Tersalin!" : "Copy Link"}
                        </button>
                        <button type="button" onClick={() => copyToClipboard(affiliate.code, "code")}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                            {copied === "code" ? <FiCheck size={14} /> : <FiCopy size={14} />}
                            {copied === "code" ? "Tersalin!" : "Copy Kode"}
                        </button>
                        <button type="button" onClick={shareWhatsApp}
                            className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-600">
                            <FiMessageCircle size={14} /> WhatsApp
                        </button>
                        <button type="button" onClick={shareFacebook}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700">
                            <FiExternalLink size={14} /> Facebook
                        </button>
                        <button type="button" onClick={shareTelegram}
                            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-600">
                            <FiSend size={14} /> Telegram
                        </button>
                        <button type="button" onClick={shareNative}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                            <FiShare2 size={14} /> Share
                        </button>
                        <Link href="/affiliate/payouts"
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100">
                            <FiDollarSign size={14} /> Pencairan
                        </Link>
                    </div>
                </div>
            </div>

            {/* ===== BALANCE + PAYOUT ===== */}
            {data.balance && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                        <div className="flex items-center gap-2">
                            <FiDollarSign size={16} className="text-emerald-600" />
                            <h3 className="text-sm font-semibold text-emerald-800">Saldo Tersedia</h3>
                        </div>
                        <p className="mt-3 text-3xl font-bold text-emerald-700">{rupiahFull(data.balance.available)}</p>
                        <p className="mt-1 text-xs text-emerald-600">Dapat dicairkan kapan saja</p>
                        <Link href="/affiliate/payouts" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700">
                            <FiDollarSign size={14} /> Ajukan Pencairan
                        </Link>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-900">Rincian Saldo</h3>
                        <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2.5">
                                <p className="text-xs text-amber-700">Pending</p>
                                <p className="text-sm font-semibold text-amber-800">{rupiahFull(data.balance.pending)}</p>
                            </div>
                            <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2.5">
                                <p className="text-xs text-blue-700">Sudah Dibayar</p>
                                <p className="text-sm font-semibold text-blue-800">{rupiahFull(data.balance.paid)}</p>
                            </div>
                            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
                                <p className="text-xs text-gray-600">Total Earned</p>
                                <p className="text-sm font-semibold text-gray-900">{rupiahFull(data.balance.totalEarned)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== PAYOUT HISTORY ===== */}
            {data.payouts && data.payouts.length > 0 && (
                <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">Riwayat Pencairan</h3>
                        <Link href="/affiliate/payouts" className="text-xs font-medium text-gray-500 hover:text-gray-900">Lihat Semua →</Link>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {data.payouts.slice(0, 5).map((p) => (
                            <div key={p.id} className="flex items-center justify-between px-5 py-3">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{rupiahFull(p.amount)}</p>
                                    <p className="text-xs text-gray-500">{formatDate(p.requestedAt)}</p>
                                </div>
                                <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${conversionStatusClass(p.status)}`}>
                                    {conversionStatusLabel(p.status)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ===== COMMISSION CENTER ===== */}
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900">Commission Center</h3>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <CommissionCard label="Pending" count={commission.pending.count} amount={commission.pending.amount}
                        desc="Menunggu order selesai/valid" color="amber" />
                    <CommissionCard label="Disetujui" count={commission.approved.count} amount={commission.approved.amount}
                        desc="Komisi sudah disetujui" color="emerald" />
                    <CommissionCard label="Dibayar" count={commission.paid.count} amount={commission.paid.amount}
                        desc="Komisi sudah dibayarkan" color="blue" />
                    <CommissionCard label="Dibatalkan" count={commission.cancelled.count} amount={commission.cancelled.amount}
                        desc="Komisi dibatalkan" color="red" />
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                    <p className="text-sm font-medium text-gray-600">Total Komisi</p>
                    <p className="text-lg font-bold text-emerald-600">{rupiahFull(commission.total)}</p>
                </div>
            </div>

            {/* ===== EARNINGS ESTIMATION + HOW TO EARN ===== */}
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Potensi Komisi</h3>
                    <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
                            <p className="text-xs text-gray-600">Sales bulan ini</p>
                            <p className="text-sm font-semibold text-gray-900">{rupiahFull(earnings.monthlySales)}</p>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
                            <p className="text-xs text-gray-600">Commission Rate</p>
                            <p className="text-sm font-semibold text-gray-900">{earnings.commissionRate}%</p>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2.5">
                            <p className="text-xs font-medium text-emerald-700">Estimasi Komisi</p>
                            <p className="text-sm font-bold text-emerald-700">{rupiahFull(earnings.estimatedCommission)}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Cara Mendapatkan Komisi</h3>
                    <div className="mt-4 space-y-3">
                        <HowToStep n={1} t="Bagikan Link" d="Salin link referral dan bagikan ke media sosial, WhatsApp, dll." />
                        <HowToStep n={2} t="Customer Berbelanja" d="Customer membuka link Anda dan berbelanja." />
                        <HowToStep n={3} t="Order Tercatat" d="Order otomatis tercatat melalui referral Anda." />
                        <HowToStep n={4} t="Komisi Masuk" d="Komisi masuk ke dashboard sesuai rate yang berlaku." />
                    </div>
                </div>
            </div>

            {/* ===== CONVERSION TABLE ===== */}
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">Riwayat Konversi</h3>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="relative">
                                <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="text" value={convSearch} onChange={(e) => { setConvSearch(e.target.value); setConvPage(1); }}
                                    placeholder="Cari nomor order..."
                                    className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-gray-400 sm:w-48" />
                            </div>
                            <select value={convStatus} onChange={(e) => { setConvStatus(e.target.value); setConvPage(1); }}
                                className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 outline-none focus:border-gray-400">
                                <option value="">Semua Status</option>
                                <option value="PENDING">Pending</option>
                                <option value="APPROVED">Disetujui</option>
                                <option value="PAID">Dibayar</option>
                                <option value="CANCELLED">Dibatalkan</option>
                            </select>
                        </div>
                    </div>
                </div>

                {conversions.items.length === 0 ? (
                    <div className="px-5 py-16 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                            <FiGift size={20} className="text-gray-400" />
                        </div>
                        <p className="mt-4 text-sm font-medium text-gray-900">Belum ada konversi</p>
                        <p className="mt-1 text-xs text-gray-500">Bagikan link referral Anda untuk mulai mendapatkan komisi.</p>
                    </div>
                ) : (
                    <>
                        <div className="hidden overflow-x-auto sm:block">
                            <table className="w-full text-left">
                                <thead className="border-b border-gray-100 bg-gray-50/70">
                                    <tr>
                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Order</th>
                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Tanggal</th>
                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Subtotal</th>
                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Rate</th>
                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Komisi</th>
                                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {conversions.items.map((c) => (
                                        <tr key={c.id} className="transition-colors hover:bg-gray-50/70">
                                            <td className="px-5 py-3">
                                                <p className="text-sm font-medium text-gray-900">{c.orderNumber}</p>
                                                <p className="text-xs text-gray-500">{c.customerName}</p>
                                            </td>
                                            <td className="px-5 py-3 text-xs text-gray-500">{formatDate(c.createdAt)}</td>
                                            <td className="px-5 py-3 text-sm text-gray-700">{rupiahFull(c.orderTotal)}</td>
                                            <td className="px-5 py-3 text-sm text-gray-500">{c.commissionRate}%</td>
                                            <td className="px-5 py-3 text-sm font-medium text-emerald-600">{rupiahFull(c.commissionAmount)}</td>
                                            <td className="px-5 py-3">
                                                <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${conversionStatusClass(c.status)}`}>
                                                    {conversionStatusLabel(c.status)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="divide-y divide-gray-100 sm:hidden">
                            {conversions.items.map((c) => (
                                <div key={c.id} className="px-5 py-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{c.orderNumber}</p>
                                            <p className="mt-0.5 text-xs text-gray-500">{formatDate(c.createdAt)}</p>
                                        </div>
                                        <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${conversionStatusClass(c.status)}`}>
                                            {conversionStatusLabel(c.status)}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <p className="text-xs text-gray-500">Subtotal: {rupiahFull(c.orderTotal)}</p>
                                        <p className="text-sm font-medium text-emerald-600">+{rupiahFull(c.commissionAmount)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {conversions.pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                                <p className="text-xs text-gray-500">
                                    Halaman {conversions.pagination.page} dari {conversions.pagination.totalPages} ({conversions.pagination.total} data)
                                </p>
                                <div className="flex gap-1">
                                    <button type="button" disabled={convPage <= 1} onClick={() => setConvPage((p) => Math.max(1, p - 1))}
                                        className="rounded-lg border border-gray-200 p-1.5 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                                        <FiChevronLeft size={14} />
                                    </button>
                                    <button type="button" disabled={convPage >= conversions.pagination.totalPages}
                                        onClick={() => setConvPage((p) => Math.min(conversions.pagination.totalPages, p + 1))}
                                        className="rounded-lg border border-gray-200 p-1.5 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                                        <FiChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ===== RECENT ACTIVITY ===== */}
            {recentActivity.length > 0 && (
                <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-900">Aktivitas Terbaru</h3>
                    <div className="mt-4 space-y-3">
                        {recentActivity.map((a) => (
                            <div key={a.id} className="flex items-start gap-3">
                                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                                    a.type === "click" ? "bg-blue-50" : a.type === "conversion" ? "bg-emerald-50" : "bg-amber-50"
                                }`}>
                                    {a.type === "click" ? <FiMousePointer size={12} className="text-blue-600" /> :
                                     a.type === "conversion" ? <FiShoppingBag size={12} className="text-emerald-600" /> :
                                     <FiDollarSign size={12} className="text-amber-600" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-gray-700">
                                        {a.message}
                                        {a.amount != null && (
                                            <span className="font-medium text-emerald-600"> {rupiahFull(a.amount)}</span>
                                        )}
                                    </p>
                                    <p className="mt-0.5 text-xs text-gray-400">{timeAgo(a.createdAt)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>
    );
}

/* ==========================================
 * SUB-COMPONENTS
 * ========================================== */

function KpiCard({ icon: Icon, label, value, sub, trend, color }: {
    icon: any; label: string; value: string; sub?: string; trend: Trend; color: string;
}) {
    const bgMap: Record<string, string> = {
        blue: "bg-blue-50", violet: "bg-violet-50", amber: "bg-amber-50", emerald: "bg-emerald-50",
    };
    const textMap: Record<string, string> = {
        blue: "text-blue-600", violet: "text-violet-600", amber: "text-amber-600", emerald: "text-emerald-600",
    };

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bgMap[color]}`}>
                    <Icon size={16} className={textMap[color]} />
                </div>
                <p className="text-xs text-gray-500">{label}</p>
            </div>
            <p className="mt-3 text-xl font-bold text-gray-900">{value}</p>
            {sub && <p className="mt-1 text-[11px] text-gray-400">{sub}</p>}
            {trend && trend.direction !== "flat" && (
                <div className={`mt-1.5 flex items-center gap-1 text-[11px] font-medium ${
                    trend.direction === "up" ? "text-emerald-600" : "text-red-500"
                }`}>
                    {trend.direction === "up" ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />}
                    {trend.percentage}% vs periode sebelumnya
                </div>
            )}
        </div>
    );
}

function FunnelStep({ label, value, pct, color, w }: {
    label: string; value: number; pct: number; color: string; w: string;
}) {
    return (
        <div>
            <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600">{label}</p>
                <p className="text-xs font-semibold text-gray-900">{value.toLocaleString("id-ID")}</p>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${color} transition-all`} style={{ width: w }} />
            </div>
            <p className="mt-0.5 text-right text-[10px] text-gray-400">{pct}%</p>
        </div>
    );
}

function CommissionCard({ label, count, amount, desc, color }: {
    label: string; count: number; amount: number; desc: string; color: string;
}) {
    const borderMap: Record<string, string> = {
        amber: "border-l-amber-400", emerald: "border-l-emerald-400",
        blue: "border-l-blue-400", red: "border-l-red-400",
    };
    return (
        <div className={`rounded-xl border border-gray-100 border-l-4 bg-gray-50 p-3 ${borderMap[color]}`}>
            <p className="text-[11px] font-medium text-gray-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{count}</p>
            <p className="text-xs text-gray-500">{rupiah(amount)}</p>
            <p className="mt-1 text-[10px] text-gray-400">{desc}</p>
        </div>
    );
}

function HowToStep({ n, t, d }: { n: number; t: string; d: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">{n}</div>
            <div>
                <p className="text-sm font-medium text-gray-900">{t}</p>
                <p className="mt-0.5 text-xs text-gray-500">{d}</p>
            </div>
        </div>
    );
}
