"use client";

import {
    FiSearch,
    FiSliders,
    FiX,
} from "react-icons/fi";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
    categories: string[];
};

export default function RealtimeProductFilter({
    categories,
}: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [q, setQ] = useState(
        searchParams.get("q") ?? ""
    );

    const [category, setCategory] =
        useState(
            searchParams.get("category") ?? "ALL"
        );

    const [status, setStatus] =
        useState(
            searchParams.get("status") ?? "ALL"
        );

    const [stock, setStock] =
        useState(
            searchParams.get("stock") ?? "ALL"
        );

    const [sort, setSort] =
        useState(
            searchParams.get("sort") ?? "NEWEST"
        );

    const firstRender = useRef(true);

    function updateUrl(
        values: {
            q?: string;
            category?: string;
            status?: string;
            stock?: string;
            sort?: string;
        }
    ) {
        const params = new URLSearchParams(
            searchParams.toString()
        );

        if (values.q !== undefined) {
            if (values.q.trim()) {
                params.set(
                    "q",
                    values.q.trim()
                );
            } else {
                params.delete("q");
            }
        }

        if (
            values.category !== undefined
        ) {
            if (
                values.category &&
                values.category !== "ALL"
            ) {
                params.set(
                    "category",
                    values.category
                );
            } else {
                params.delete("category");
            }
        }

        if (values.status !== undefined) {
            if (
                values.status &&
                values.status !== "ALL"
            ) {
                params.set(
                    "status",
                    values.status
                );
            } else {
                params.delete("status");
            }
        }

        if (values.stock !== undefined) {
            if (
                values.stock &&
                values.stock !== "ALL"
            ) {
                params.set(
                    "stock",
                    values.stock
                );
            } else {
                params.delete("stock");
            }
        }

        if (values.sort !== undefined) {
            if (
                values.sort &&
                values.sort !== "NEWEST"
            ) {
                params.set(
                    "sort",
                    values.sort
                );
            } else {
                params.delete("sort");
            }
        }

        const query = params.toString();

        router.replace(
            query
                ? `${pathname}?${query}`
                : pathname,
            {
                scroll: false,
            }
        );
    }

    /*
     * SEARCH DEBOUNCE
     */

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }

        const timer = setTimeout(() => {
            updateUrl({ q });
        }, 350);

        return () => {
            clearTimeout(timer);
        };
    }, [q]);

    function changeCategory(
        value: string
    ) {
        setCategory(value);

        updateUrl({
            category: value,
        });
    }

    function changeStatus(
        value: string
    ) {
        setStatus(value);

        updateUrl({
            status: value,
        });
    }

    function changeStock(
        value: string
    ) {
        setStock(value);

        updateUrl({
            stock: value,
        });
    }

    function changeSort(
        value: string
    ) {
        setSort(value);

        updateUrl({
            sort: value,
        });
    }

    function resetFilters() {
        setQ("");
        setCategory("ALL");
        setStatus("ALL");
        setStock("ALL");
        setSort("NEWEST");

        router.replace(pathname, {
            scroll: false,
        });
    }

    const hasFilter =
        q.trim() !== "" ||
        category !== "ALL" ||
        status !== "ALL" ||
        stock !== "ALL" ||
        sort !== "NEWEST";

    return (
        <div className="mb-5 border border-gray-200 bg-white">
            <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center">

                {/* SEARCH */}

                <div className="relative min-w-0 flex-1">
                    <FiSearch
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                        type="search"
                        value={q}
                        onChange={(event) =>
                            setQ(
                                event.target.value
                            )
                        }
                        placeholder="Cari produk..."
                        className="h-10 w-full border border-gray-200 bg-white pl-9 pr-9 text-[12px] text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-gray-400"
                    />

                    {q && (
                        <button
                            type="button"
                            onClick={() =>
                                setQ("")
                            }
                            className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-gray-400 hover:text-gray-700"
                            aria-label="Hapus pencarian"
                        >
                            <FiX size={14} />
                        </button>
                    )}
                </div>

                {/* FILTER ICON */}

                <div className="hidden h-10 w-px bg-gray-200 lg:block" />

                <div className="flex flex-1 flex-wrap gap-2 lg:flex-none">

                    {/* CATEGORY */}

                    <select
                        value={category}
                        onChange={(event) =>
                            changeCategory(
                                event.target.value
                            )
                        }
                        className="h-10 min-w-[145px] flex-1 border border-gray-200 bg-white px-3 text-[12px] text-gray-700 outline-none transition focus:border-gray-400 sm:flex-none"
                    >
                        <option value="ALL">
                            Semua kategori
                        </option>

                        {categories.map(
                            (item) => (
                                <option
                                    key={item}
                                    value={item}
                                >
                                    {item}
                                </option>
                            )
                        )}
                    </select>

                    {/* STATUS */}

                    <select
                        value={status}
                        onChange={(event) =>
                            changeStatus(
                                event.target.value
                            )
                        }
                        className="h-10 min-w-[125px] flex-1 border border-gray-200 bg-white px-3 text-[12px] text-gray-700 outline-none transition focus:border-gray-400 sm:flex-none"
                    >
                        <option value="ALL">
                            Semua status
                        </option>

                        <option value="BESTSELLER">
                            Bestseller
                        </option>

                        <option value="NORMAL">
                            Normal
                        </option>
                    </select>

                    {/* STOCK */}

                    <select
                        value={stock}
                        onChange={(event) =>
                            changeStock(
                                event.target.value
                            )
                        }
                        className="h-10 min-w-[125px] flex-1 border border-gray-200 bg-white px-3 text-[12px] text-gray-700 outline-none transition focus:border-gray-400 sm:flex-none"
                    >
                        <option value="ALL">
                            Semua stok
                        </option>

                        <option value="AVAILABLE">
                            Tersedia
                        </option>

                        <option value="LOW">
                            Menipis
                        </option>

                        <option value="EMPTY">
                            Habis
                        </option>
                    </select>

                    {/* SORT */}

                    <select
                        value={sort}
                        onChange={(event) =>
                            changeSort(
                                event.target.value
                            )
                        }
                        className="h-10 min-w-[130px] flex-1 border border-gray-200 bg-white px-3 text-[12px] text-gray-700 outline-none transition focus:border-gray-400 sm:flex-none"
                    >
                        <option value="NEWEST">
                            Terbaru
                        </option>

                        <option value="OLDEST">
                            Terlama
                        </option>

                        <option value="PRICE_LOW">
                            Harga terendah
                        </option>

                        <option value="PRICE_HIGH">
                            Harga tertinggi
                        </option>

                        <option value="STOCK_HIGH">
                            Stok terbanyak
                        </option>
                    </select>
                </div>

                {/* RESET */}

                {hasFilter && (
                    <button
                        type="button"
                        onClick={resetFilters}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 border border-gray-200 px-3 text-[12px] font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                    >
                        <FiX size={14} />
                        Reset
                    </button>
                )}
            </div>

            {/* ACTIVE FILTER INFO */}

            {hasFilter && (
                <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-2.5">
                    <FiSliders
                        size={13}
                        className="text-gray-400"
                    />

                    <span className="text-[11px] text-gray-400">
                        Filter aktif
                    </span>

                    {category !== "ALL" && (
                        <span className="border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600">
                            {category}
                        </span>
                    )}

                    {status !== "ALL" && (
                        <span className="border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600">
                            {status ===
                            "BESTSELLER"
                                ? "Bestseller"
                                : "Normal"}
                        </span>
                    )}

                    {stock !== "ALL" && (
                        <span className="border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600">
                            {stock ===
                            "AVAILABLE"
                                ? "Stok tersedia"
                                : stock ===
                                    "LOW"
                                  ? "Stok menipis"
                                  : "Stok habis"}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}