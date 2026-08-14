"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type TrackingItem = {
    date: string;
    description: string;
    location?: string | null;
};

type Props = {
    orderId: number;
};

export default function TrackingTimeline({
    orderId,
}: Props) {
    const [loading, setLoading] =
        useState(true);

    const [tracking, setTracking] =
        useState<TrackingItem[]>([]);

    useEffect(() => {
        async function loadTracking() {
            try {
                const response =
                    await fetch(
                        `/api/orders/${orderId}/tracking`,
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
                            "Gagal mengambil tracking."
                    );
                }

                setTracking(
                    result.data.tracking ??
                        []
                );
            } catch (error) {
                console.error(error);

                toast.error(
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil tracking."
                );
            } finally {
                setLoading(false);
            }
        }

        loadTracking();
    }, [orderId]);

    if (loading) {
        return (
            <div className="mt-6 rounded-2xl bg-gray-50 p-5">
                <p className="text-sm text-gray-500">
                    Mengambil status pengiriman...
                </p>
            </div>
        );
    }

    if (!tracking.length) {
        return (
            <div className="mt-6 rounded-2xl bg-gray-50 p-5">
                <p className="text-sm text-gray-500">
                    Belum ada riwayat tracking.
                </p>
            </div>
        );
    }

    return (
        <div className="mt-6">
            <h3 className="font-semibold">
                Riwayat Pengiriman
            </h3>

            <div className="mt-5 space-y-5">
                {tracking.map(
                    (item, index) => (
                        <div
                            key={index}
                            className="relative flex gap-4"
                        >
                            <div className="flex flex-col items-center">
                                <div
                                    className={`mt-1 h-3 w-3 rounded-full ${
                                        index === 0
                                            ? "bg-rose-600"
                                            : "bg-gray-300"
                                    }`}
                                />

                                {index <
                                    tracking.length -
                                        1 && (
                                    <div className="mt-1 h-full w-px bg-gray-200" />
                                )}
                            </div>

                            <div className="pb-4">
                                <p className="text-sm font-semibold text-gray-900">
                                    {
                                        item.description
                                    }
                                </p>

                                <p className="mt-1 text-xs text-gray-500">
                                    {item.date}
                                </p>

                                {item.location && (
                                    <p className="mt-1 text-xs text-gray-500">
                                        {
                                            item.location
                                        }
                                    </p>
                                )}
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}