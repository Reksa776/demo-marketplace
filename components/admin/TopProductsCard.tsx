type TopProduct = {
    productId: number;
    productName: string;
    quantity: number;
    revenue: number;
};

export default function TopProductsCard({
    data,
}: {
    data: TopProduct[];
}) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">
                        Produk Terlaris
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                        Produk dengan penjualan tertinggi.
                    </p>
                </div>
            </div>

            <div className="mt-5 divide-y divide-gray-100">
                {data.map((product, index) => (
                    <div
                        key={product.productId}
                        className="flex gap-4 py-4"
                    >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-sm font-bold text-rose-600">
                            {index + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">
                                {product.productName}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                                {product.quantity} unit terjual
                            </p>
                        </div>

                        <p className="shrink-0 text-sm font-bold text-gray-900">
                            Rp{" "}
                            {product.revenue.toLocaleString(
                                "id-ID"
                            )}
                        </p>
                    </div>
                ))}

                {data.length === 0 && (
                    <p className="py-6 text-center text-sm text-gray-400">
                        Belum ada data produk.
                    </p>
                )}
            </div>
        </div>
    );
}