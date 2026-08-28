"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    FiArrowLeft,
    FiDownload,
    FiFileText,
    FiRefreshCw,
    FiTrendingUp,
} from "react-icons/fi";

type ReportData = {
    period: string;
    periodStart: string;
    periodEnd: string;

    summary: {
        totalProducts: number;
        totalCustomers: number;
        totalOrders: number;
        periodOrderCount: number;
        paidOrderCount: number;
        revenue: number;
        paidSubtotal: number;
        paidShipping: number;
    };

    dailySales: {
        date: string;
        revenue: number;
        orders: number;
    }[];

    topProducts: {
        productId: number;
        productName: string;
        quantity: number;
        revenue: number;
    }[];

    paymentMethod: Record<string, number>;

    orderStatus: Record<string, number>;
};
function formatNumber(
    value: number | string | null | undefined
) {
    const amount = Number(value ?? 0);

    return new Intl.NumberFormat("id-ID").format(
        Number.isFinite(amount) ? amount : 0
    );
}

function formatRupiah(
    value: number | string | null | undefined
) {
    const amount = Number(value ?? 0);

    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(
        Number.isFinite(amount) ? amount : 0
    );
}

function formatDate(date: string) {
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(date));
}

export default function AdminReportsPage() {
    const [period, setPeriod] = useState("7d");
    const [data, setData] =
        useState<ReportData | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [downloading, setDownloading] =
        useState(false);

    async function loadReport() {
        try {
            setLoading(true);

            const response = await fetch(
                `/api/admin/reports?period=${period}`,
                {
                    cache: "no-store",
                }
            );

            const result =
                await response.json();

            if (
                !response.ok ||
                !result.success
            ) {
                throw new Error(
                    result.message ||
                    "Gagal mengambil laporan."
                );
            }

            setData(result.data);
        } catch (error) {
            console.error(
                "LOAD REPORT ERROR:",
                error
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadReport();
    }, [period]);

    async function downloadExcel() {
        try {
            setDownloading(true);

            const response = await fetch(
                `/api/admin/reports/excel?period=${period}`
            );

            if (!response.ok) {
                const result =
                    await response.json();

                throw new Error(
                    result.message ||
                    "Gagal download laporan."
                );
            }

            const blob =
                await response.blob();

            const url =
                window.URL.createObjectURL(
                    blob
                );

            const a =
                document.createElement("a");

            a.href = url;

            a.download =
                `laporan-penjualan-${period}.xlsx`;

            document.body.appendChild(a);

            a.click();

            a.remove();

            window.URL.revokeObjectURL(
                url
            );
        } catch (error) {
            console.error(
                "DOWNLOAD REPORT ERROR:",
                error
            );

            toast.error(
                error instanceof Error
                    ? error.message
                    : "Gagal download laporan."
            );
        } finally {
            setDownloading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* HEADER */}
            <div className="border-b border-gray-200 bg-white">
                <div className="mx-auto max-w-7xl px-5 py-7 sm:px-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <Link
                                href="/admin"
                                className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900"
                            >
                                <FiArrowLeft />
                                Kembali ke Dashboard
                            </Link>

                            <div className="mt-4 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                                    <FiFileText
                                        size={21}
                                    />
                                </div>

                                <div>
                                    <p className="text-sm font-semibold text-rose-600">
                                        Admin Reporting
                                    </p>

                                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                                        Laporan Penjualan
                                    </h1>
                                </div>
                            </div>

                            <p className="mt-3 text-sm text-gray-500">
                                Rekapitulasi penjualan,
                                pesanan, pembayaran,
                                dan produk terlaris.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <select
                                value={period}
                                onChange={(e) =>
                                    setPeriod(
                                        e.target.value
                                    )
                                }
                                className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-rose-500"
                            >
                                <option value="7d">
                                    7 Hari
                                </option>

                                <option value="30d">
                                    30 Hari
                                </option>

                                <option value="90d">
                                    90 Hari
                                </option>

                                <option value="1y">
                                    1 Tahun
                                </option>
                            </select>

                            <button
                                type="button"
                                onClick={downloadExcel}
                                disabled={
                                    downloading
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {downloading ? (
                                    <FiRefreshCw
                                        className="animate-spin"
                                        size={17}
                                    />
                                ) : (
                                    <FiDownload
                                        size={17}
                                    />
                                )}

                                {downloading
                                    ? "Menyiapkan..."
                                    : "Download Excel"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6">
                {loading ? (
                    <LoadingState />
                ) : !data ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-600">
                        Gagal mengambil laporan.
                    </div>
                ) : (
                    <>
                        {/* PERIOD */}
                        <div className="mb-5 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">
                                    Periode laporan
                                </p>

                                <p className="mt-1 font-semibold text-gray-900">
                                    {formatDate(
                                        data.periodStart
                                    )}{" "}
                                    —{" "}
                                    {formatDate(
                                        data.periodEnd
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* SUMMARY */}
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <SummaryCard
                                title="Pesanan"
                                value={formatNumber(
                                    data.summary.periodOrderCount ?? 0
                                )}
                                icon={<FiFileText />}
                            />

                            <SummaryCard
                                title="Pesanan Dibayar"
                                value={formatNumber(
                                    data.summary.paidOrderCount ?? 0
                                )}
                                icon={<FiFileText />}
                            />

                            <SummaryCard
                                title="Pesanan Dibatalkan"
                                value={formatNumber(
                                    data.orderStatus?.CANCELLED ?? 0
                                )}
                                icon={<FiFileText />}
                            />
                        </div>

                        {/* REVENUE BREAKDOWN */}
                        <div className="mt-6 grid gap-4 md:grid-cols-3">
                            <BreakdownCard
                                title="Subtotal Produk"
                                value={formatRupiah(
                                    data.summary.paidSubtotal ?? 0
                                )}
                            />

                            <BreakdownCard
                                title="Ongkos Kirim"
                                value={formatRupiah(
                                    data.summary.paidShipping ?? 0
                                )}
                            />

                            <BreakdownCard
                                title="Total Pendapatan"
                                value={formatRupiah(
                                    data.summary.revenue ?? 0
                                )}
                            />
                        </div>

                        {/* DAILY SALES */}
                        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                            <div className="mb-5">
                                <h2 className="text-lg font-bold text-gray-900">
                                    Penjualan Harian
                                </h2>

                                <p className="mt-1 text-sm text-gray-500">
                                    Rekap pendapatan dan
                                    jumlah pesanan.
                                </p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[600px] text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 text-gray-500">
                                            <th className="px-3 py-3 font-medium">
                                                Tanggal
                                            </th>

                                            <th className="px-3 py-3 text-right font-medium">
                                                Pesanan
                                            </th>

                                            <th className="px-3 py-3 text-right font-medium">
                                                Pendapatan
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {data.dailySales.map(
                                            (
                                                item
                                            ) => (
                                                <tr
                                                    key={
                                                        item.date
                                                    }
                                                    className="border-b border-gray-100 last:border-0"
                                                >
                                                    <td className="px-3 py-3 font-medium text-gray-900">
                                                        {formatDate(
                                                            item.date
                                                        )}
                                                    </td>

                                                    <td className="px-3 py-3 text-right text-gray-600">
                                                        {
                                                            item.orders
                                                        }
                                                    </td>

                                                    <td className="px-3 py-3 text-right font-semibold text-gray-900">
                                                        {formatRupiah(
                                                            item.revenue
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* TOP PRODUCTS */}
                        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                            <div className="mb-5">
                                <h2 className="text-lg font-bold text-gray-900">
                                    Produk Terlaris
                                </h2>

                                <p className="mt-1 text-sm text-gray-500">
                                    Produk dengan penjualan
                                    tertinggi pada periode
                                    ini.
                                </p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[650px] text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 text-gray-500">
                                            <th className="px-3 py-3 font-medium">
                                                Produk
                                            </th>

                                            <th className="px-3 py-3 text-right font-medium">
                                                Terjual
                                            </th>

                                            <th className="px-3 py-3 text-right font-medium">
                                                Pendapatan
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {data.topProducts.map(
                                            (
                                                item
                                            ) => (
                                                <tr
                                                    key={
                                                        item.productId
                                                    }
                                                    className="border-b border-gray-100 last:border-0"
                                                >
                                                    <td className="max-w-md px-3 py-3 font-medium text-gray-900">
                                                        {
                                                            item.productName
                                                        }
                                                    </td>

                                                    <td className="px-3 py-3 text-right text-gray-600">
                                                        {
                                                            item.quantity
                                                        }
                                                    </td>

                                                    <td className="px-3 py-3 text-right font-semibold text-gray-900">
                                                        {formatRupiah(
                                                            item.revenue
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* PAYMENT + STATUS */}
                        <div className="mt-6 grid gap-6 lg:grid-cols-2">
                            <ReportList
                                title="Metode Pembayaran"
                                data={
                                    data.paymentMethod
                                }
                            />

                            <ReportList
                                title="Status Pesanan"
                                data={
                                    data.orderStatus
                                }
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function SummaryCard({
    title,
    value,
    icon,
}: {
    title: string;
    value: string;
    icon: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">
                        {title}
                    </p>

                    <p className="mt-2 text-2xl font-bold text-gray-900">
                        {value}
                    </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                    {icon}
                </div>
            </div>
        </div>
    );
}

function BreakdownCard({
    title,
    value,
}: {
    title: string;
    value: string;
}) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
                {title}
            </p>

            <p className="mt-2 text-xl font-bold text-gray-900">
                {value}
            </p>
        </div>
    );
}

function ReportList({
    title,
    data,
}: {
    title: string;
    data: Record<string, number>;
}) {
    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">
                {title}
            </h2>

            <div className="mt-4 space-y-3">
                {Object.entries(data).map(
                    ([key, value]) => (
                        <div
                            key={key}
                            className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
                        >
                            <span className="text-sm font-medium text-gray-700">
                                {key}
                            </span>

                            <span className="font-bold text-gray-900">
                                {value}
                            </span>
                        </div>
                    )
                )}
            </div>
        </section>
    );
}

function LoadingState() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map(
                (item) => (
                    <div
                        key={item}
                        className="h-32 animate-pulse rounded-2xl bg-gray-200"
                    />
                )
            )}
        </div>
    );
}