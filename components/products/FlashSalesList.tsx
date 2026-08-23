"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiShoppingBag } from "react-icons/fi";

type FlashSaleItem = {
    id: number;
    name: string;
    salePrice: number;
    saleStock: number;
    soldCount: number;
    remainingStock: number;
    purchaseLimit: number | null;
    startAt: string;
    endAt: string;
    product: {
        id: number;
        name: string;
        slug: string;
        image: string | null;
    };
    variant: {
        id: number;
        name: string;
        originalPrice: number;
        image: string | null;
    };
    discount: number;
};

export default function FlashSalesList() {
    const [items, setItems] = useState<FlashSaleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch("/api/flash-sales", {
                    cache: "no-store",
                });
                const data = await res.json();

                if (!res.ok || !data.success) {
                    throw new Error(data.message || "Gagal mengambil data flash sale.");
                }

                setItems(data.data?.items ?? []);
            } catch (err: any) {
                console.error("LOAD FLASH SALES ERROR:", err);
                setError(err?.message ?? "Gagal memuat flash sale.");
            } finally {
                setLoading(false);
            }
        }

        load();
    }, []);

    if (loading) {
        return (
            <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-40 animate-pulse rounded-2xl bg-white" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-600">
                {error}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-3xl">
                    🔥
                </div>

                <h2 className="mt-4 text-lg font-bold text-gray-900">
                    Belum ada flash sale
                </h2>

                <p className="mt-1 max-w-sm text-sm text-gray-500">
                    Flash sale akan muncul di sini saat tersedia.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => {
                const stockPercent = item.saleStock > 0
                    ? Math.min(100, (item.soldCount / item.saleStock) * 100)
                    : 100;

                return (
                    <Link
                        key={item.id}
                        href={`/products/${item.product.slug}`}
                        className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-lg"
                    >
                        <div className="relative aspect-square overflow-hidden bg-gray-100">
                            {item.product.image ? (
                                <img
                                    src={item.product.image}
                                    alt={item.product.name}
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center text-gray-400">
                                    <FiShoppingBag size={32} />
                                </div>
                            )}

                            <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                FLASH SALE
                            </span>

                            <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-red-500">
                                -{Math.round(((item.variant.originalPrice - item.salePrice) / item.variant.originalPrice) * 100)}%
                            </span>
                        </div>

                        <div className="p-3">
                            <h3 className="line-clamp-2 min-h-[36px] text-xs font-semibold text-gray-900">
                                {item.product.name}
                            </h3>

                            <div className="mt-2">
                                <span className="text-sm font-bold text-rose-600">
                                    Rp {item.salePrice.toLocaleString("id-ID")}
                                </span>

                                <span className="ml-1.5 text-[11px] text-gray-400 line-through">
                                    Rp {item.variant.originalPrice.toLocaleString("id-ID")}
                                </span>
                            </div>

                            {/* Stock progress bar */}
                            <div className="mt-2">
                                <div className="flex items-center justify-between text-[10px] text-gray-400">
                                    <span>Terjual {item.soldCount}</span>
                                    <span>Sisa {item.remainingStock}</span>
                                </div>
                                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                                    <div
                                        className="h-full rounded-full bg-rose-500"
                                        style={{ width: `${stockPercent}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}
