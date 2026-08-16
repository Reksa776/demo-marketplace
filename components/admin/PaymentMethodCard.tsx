export type OrderStatusData = {
    PENDING: number;
    PAID: number;
    PROCESSING: number;
    SHIPPED: number;
    COMPLETED: number;
    CANCELLED: number;
};

export default function OrderStatusCard({
    data,
}: {
    data: OrderStatusData;
}) {
    const statuses = [
        ["PENDING", data.PENDING],
        ["PAID", data.PAID],
        ["PROCESSING", data.PROCESSING],
        ["SHIPPED", data.SHIPPED],
        ["COMPLETED", data.COMPLETED],
        ["CANCELLED", data.CANCELLED],
    ];

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">
                Status Pesanan
            </h2>

            <p className="mt-1 text-sm text-gray-500">
                Rekap status pesanan periode aktif.
            </p>

            <div className="mt-5 space-y-3">
                {statuses.map(([name, value]) => (
                    <div
                        key={name}
                        className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
                    >
                        <span className="text-sm font-medium text-gray-700">
                            {name}
                        </span>

                        <span className="text-sm font-bold text-gray-900">
                            {value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}