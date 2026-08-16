import {
    FiBox,
    FiShoppingBag,
    FiTrendingUp,
    FiUsers,
} from "react-icons/fi";

export type DashboardSummary = {
    totalProducts: number;
    totalCustomers: number;
    totalOrders: number;
    periodOrderCount: number;
    paidOrderCount: number;
    revenue: number;
    paidSubtotal: number;
    paidShipping: number;
};

function formatRupiah(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(value);
}

export default function DashboardStats({
    summary,
}: {
    summary: DashboardSummary;
}) {
    const stats = [
        {
            title: "Total Penjualan",
            value: formatRupiah(summary.revenue),
            description: "Pesanan yang sudah dibayar",
            icon: FiTrendingUp,
        },
        {
            title: "Pesanan",
            value: summary.totalOrders.toLocaleString("id-ID"),
            description: `${summary.periodOrderCount} pesanan periode ini`,
            icon: FiShoppingBag,
        },
        {
            title: "Pesanan Dibayar",
            value: summary.paidOrderCount.toLocaleString("id-ID"),
            description: "Transaksi berhasil dibayar",
            icon: FiShoppingBag,
        },
        {
            title: "Customer",
            value: summary.totalCustomers.toLocaleString("id-ID"),
            description: "Customer terdaftar",
            icon: FiUsers,
        },
    ];

    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => {
                const Icon = stat.icon;

                return (
                    <div
                        key={stat.title}
                        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">
                                    {stat.title}
                                </p>

                                <p className="mt-2 text-2xl font-bold text-gray-900">
                                    {stat.value}
                                </p>

                                <p className="mt-1 text-xs text-gray-400">
                                    {stat.description}
                                </p>
                            </div>

                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                                <Icon size={20} />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}