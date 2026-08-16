import Link from "next/link";

type RecentOrder = {
    id: number;
    orderNumber: string;
    recipientName: string;
    total: string;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    createdAt: string;
    items: {
        productName: string;
        variantName: string;
        quantity: number;
    }[];
};

function formatRupiah(value: number) {
    return `Rp ${value.toLocaleString("id-ID")}`;
}

export default function RecentOrdersCard({
    data,
}: {
    data: RecentOrder[];
}) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">
                        Pesanan Terbaru
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                        Transaksi terbaru di toko.
                    </p>
                </div>

                <Link
                    href="/admin/orders"
                    className="text-sm font-semibold text-rose-600 hover:text-rose-700"
                >
                    Lihat semua
                </Link>
            </div>

            <div className="mt-5 divide-y divide-gray-100">
                {data.map((order) => (
                    <div
                        key={order.id}
                        className="py-4"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="font-semibold text-gray-900">
                                    {order.orderNumber}
                                </p>

                                <p className="mt-1 text-sm text-gray-500">
                                    {order.recipientName}
                                </p>

                                {order.items[0] && (
                                    <p className="mt-1 truncate text-xs text-gray-400">
                                        {
                                            order.items[0]
                                                .productName
                                        }{" "}
                                        ×{" "}
                                        {
                                            order.items[0]
                                                .quantity
                                        }
                                    </p>
                                )}
                            </div>

                            <div className="shrink-0 text-right">
                                <p className="text-sm font-bold text-gray-900">
                                    {formatRupiah(
                                        Number(
                                            order.total
                                        )
                                    )}
                                </p>

                                <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                                    {order.status}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}

                {data.length === 0 && (
                    <p className="py-6 text-center text-sm text-gray-400">
                        Belum ada pesanan.
                    </p>
                )}
            </div>
        </div>
    );
}