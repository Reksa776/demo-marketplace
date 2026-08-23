"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CampaignItem = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    bannerUrl: string | null;
    type: string;
    status: string;
    startAt: string;
    endAt: string;
    discountType: string | null;
    discountValue: number | null;
    maxDiscount: number | null;
    priority: number;
    productCount: number;
    categoryCount: number;
    categories: string[];
};

export default function CampaignsList() {
    const [items, setItems] = useState<CampaignItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch("/api/campaigns", {
                    cache: "no-store",
                });
                const data = await res.json();

                if (!res.ok || !data.success) {
                    throw new Error(data.message || "Gagal mengambil data kampanye.");
                }

                setItems(data.data?.items ?? []);
            } catch (err: any) {
                console.error("LOAD CAMPAIGNS ERROR:", err);
                setError(err?.message ?? "Gagal memuat kampanye.");
            } finally {
                setLoading(false);
            }
        }

        load();
    }, []);

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    }

    function getStatusBadge(status: string) {
        switch (status) {
            case "ACTIVE":
                return <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">AKTIF</span>;
            case "SCHEDULED":
                return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">MENDATANG</span>;
            default:
                return null;
        }
    }

    function getDiscountLabel(type: string | null, value: number | null) {
        if (!type || !value) return null;
        if (type === "PERCENTAGE") return `${value}% OFF`;
        return `Rp ${Number(value).toLocaleString("id-ID")} OFF`;
    }

    if (loading) {
        return (
            <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-48 animate-pulse rounded-2xl bg-white" />
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
                    📢
                </div>

                <h2 className="mt-4 text-lg font-bold text-gray-900">
                    Belum ada kampanye
                </h2>

                <p className="mt-1 max-w-sm text-sm text-gray-500">
                    Kampanye akan muncul di sini saat tersedia.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {items.map((item) => {
                const discountLabel = getDiscountLabel(item.discountType, item.discountValue);

                return (
                    <Link
                        key={item.id}
                        href={`/products`}
                        className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-md"
                    >
                        {/* Banner */}
                        {item.bannerUrl && (
                            <div className="relative aspect-[16/5] overflow-hidden bg-gray-100">
                                <img
                                    src={item.bannerUrl}
                                    alt={item.name}
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                    loading="lazy"
                                />
                            </div>
                        )}

                        <div className="p-4">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-gray-900">
                                    {item.name}
                                </h3>

                                {getStatusBadge(item.status)}
                            </div>

                            {item.description && (
                                <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                                    {item.description}
                                </p>
                            )}

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                                <span className="rounded-full bg-gray-100 px-2 py-0.5">
                                    {item.type.replace("_", " ")}
                                </span>

                                {discountLabel && (
                                    <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-600">
                                        {discountLabel}
                                    </span>
                                )}

                                <span>
                                    {formatDate(item.startAt)} — {formatDate(item.endAt)}
                                </span>
                            </div>

                            {item.categories.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {item.categories.map((cat) => (
                                        <span
                                            key={cat}
                                            className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600"
                                        >
                                            {cat}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}
