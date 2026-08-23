"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PromotionItem = {
    id: number;
    title: string;
    imageUrl: string;
    link: string | null;
    placement: string;
    priority: number;
    startAt: string | null;
    endAt: string | null;
};

export default function PromotionsList() {
    const [items, setItems] = useState<PromotionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch("/api/promotions", {
                    cache: "no-store",
                });
                const data = await res.json();

                if (!res.ok || !data.success) {
                    throw new Error(data.message || "Gagal mengambil data promosi.");
                }

                setItems(data.data?.items ?? []);
            } catch (err: any) {
                console.error("LOAD PROMOTIONS ERROR:", err);
                setError(err?.message ?? "Gagal memuat promosi.");
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
                    🎯
                </div>

                <h2 className="mt-4 text-lg font-bold text-gray-900">
                    Belum ada promosi
                </h2>

                <p className="mt-1 max-w-sm text-sm text-gray-500">
                    Promosi akan muncul di sini saat tersedia.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {items.map((item) => {
                const Wrapper = item.link ? "a" : Link;
                const wrapperProps = item.link
                    ? { href: item.link, target: "_blank", rel: "noopener noreferrer" }
                    : { href: "#" };

                return (
                    <Wrapper
                        key={item.id}
                        {...wrapperProps}
                        className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-md"
                    >
                        <div className="relative aspect-[16/6] overflow-hidden bg-gray-100 sm:aspect-[16/5]">
                            {item.imageUrl ? (
                                <img
                                    src={item.imageUrl}
                                    alt={item.title}
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center text-gray-400">
                                    No image
                                </div>
                            )}
                        </div>

                        <div className="p-4">
                            <h3 className="text-sm font-semibold text-gray-900">
                                {item.title}
                            </h3>

                            <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                                <span className="rounded-full bg-gray-100 px-2 py-0.5">
                                    {item.placement}
                                </span>

                                {item.endAt && (
                                    <span>
                                        Berakhir {new Date(item.endAt).toLocaleDateString("id-ID", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                        })}
                                    </span>
                                )}
                            </div>
                        </div>
                    </Wrapper>
                );
            })}
        </div>
    );
}
