"use client";

import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

export type DailySale = {
    date: string;
    revenue: number;
    orders: number;
};

function formatRupiah(value: number) {
    return `Rp ${value.toLocaleString("id-ID")}`;
}

export default function SalesChart({
    data,
}: {
    data: DailySale[];
}) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-6">
                <p className="text-sm font-medium text-gray-500">
                    Performa Penjualan
                </p>

                <h2 className="mt-1 text-lg font-bold text-gray-900">
                    Penjualan Harian
                </h2>
            </div>

            <div className="h-[320px]">
                {data.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
                        Belum ada data penjualan.
                    </div>
                ) : (
                    <ResponsiveContainer
                        width="100%"
                        height="100%"
                    >
                        <AreaChart data={data}>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                            />

                            <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                            />

                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) =>
                                    `Rp ${Number(
                                        value
                                    ).toLocaleString(
                                        "id-ID"
                                    )}`
                                }
                            />

                            <Tooltip
                                formatter={(
                                    value,
                                    name
                                ) => {
                                    if (
                                        name ===
                                        "revenue"
                                    ) {
                                        return [
                                            formatRupiah(
                                                Number(
                                                    value
                                                )
                                            ),
                                            "Penjualan",
                                        ];
                                    }

                                    return [
                                        value,
                                        "Pesanan",
                                    ];
                                }}
                            />

                            <Area
                                type="monotone"
                                dataKey="revenue"
                                strokeWidth={2}
                                fillOpacity={0.12}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}