"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
    FiArrowLeft,
    FiMinus,
    FiPlus,
    FiShoppingBag,
    FiTrash2,
} from "react-icons/fi";
import toast from "react-hot-toast";

/**
 * Cart item structure matches /api/cart GET response.
 * The API returns flat items — NOT nested variant/product objects.
 */
type CartItem = {
    id: number;
    productId: number;
    variantId: number;
    productName: string;
    variantName: string;
    productSlug: string;
    image: string | null;
    price: number;           // effectivePrice (marketing-adjusted)
    originalPrice: number;   // raw variant.price
    discount: number;        // discount amount
    hasDiscount: boolean;
    priceSource: string;     // ORIGINAL | FLASH_SALE | PRODUCT_DISCOUNT | CAMPAIGN | BULK_DISCOUNT
    flashSaleName: string | null;
    bulkDiscountName: string | null;
    quantity: number;
    stock: number;            // ProductVariant.stock (regular only)
    availableStock: number;   // actual stock (flash sale or variant)
    stockStatus: "OK" | "OUT_OF_STOCK" | "INSUFFICIENT_STOCK" | "VARIANT_NOT_FOUND";
    flashSaleId: number | null;
    weight: number;
};

type Cart = {
    id: number | null;
    userId: string;
    items: CartItem[];
    invalidCount: number;
};

export default function CartPage() {
    const [cart, setCart] = useState<Cart | null>(null);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<number | null>(null);

    async function loadCart() {
        try {
            setLoading(true);

            const response = await fetch("/api/cart", {
                method: "GET",
                cache: "no-store",
            });

            const data = await response.json();

            if (!response.ok) {
                toast.error(
                    data.message ??
                    "Gagal mengambil keranjang."
                );

                return;
            }

            setCart(data.cart);
        } catch (error) {
            console.error(error);

            toast.error(
                "Terjadi kesalahan saat mengambil keranjang."
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadCart();
    }, []);

    async function updateQuantity(
        item: CartItem,
        quantity: number
    ) {
        if (quantity < 1) {
            return;
        }

        if (quantity > item.stock) {
            toast.error(
                `Stok tersedia hanya ${item.stock}.`
            );

            return;
        }

        try {
            setUpdatingId(item.id);

            const response = await fetch("/api/cart", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    itemId: item.id,
                    quantity,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                toast.error(
                    data.message ??
                    "Gagal memperbarui keranjang."
                );

                return;
            }

            setCart(data.cart);

        } catch (error) {
            console.error(error);

            toast.error(
                "Terjadi kesalahan."
            );
        } finally {
            setUpdatingId(null);
        }
    }

    async function removeItem(itemId: number) {
        try {
            setUpdatingId(itemId);

            const response = await fetch("/api/cart", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    itemId,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                toast.error(
                    data.message ??
                    "Gagal menghapus produk."
                );

                return;
            }

            setCart(data.cart);

            toast.success(
                "Produk dihapus dari keranjang."
            );

        } catch (error) {
            console.error(error);

            toast.error(
                "Terjadi kesalahan."
            );
        } finally {
            setUpdatingId(null);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-gray-50">
                <div className="mx-auto max-w-6xl px-4 py-8">
                    <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-200" />

                    <div className="mt-6 space-y-4">
                        {Array.from({ length: 3 }).map(
                            (_, index) => (
                                <div
                                    key={index}
                                    className="h-32 animate-pulse rounded-2xl bg-white"
                                />
                            )
                        )}
                    </div>
                </div>
            </main>
        );
    }

    const items = cart?.items ?? [];
    const invalidCount = cart?.invalidCount ?? 0;
    const hasInvalidItems = invalidCount > 0;

    /**
     * Subtotal uses effectivePrice (marketing-adjusted),
     * NOT the raw variant price.
     */
    const subtotal = items.reduce(
        (total, item) => {
            return (
                total +
                item.price *
                item.quantity
            );
        },
        0
    );

    if (items.length === 0) {
        return (
            <main className="min-h-screen bg-gray-50">
                <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-5 py-12 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                        <FiShoppingBag size={32} />
                    </div>

                    <h1 className="mt-6 text-2xl font-bold text-gray-900">
                        Keranjang masih kosong
                    </h1>

                    <p className="mt-2 max-w-md text-sm text-gray-500">
                        Yuk pilih produk yang kamu suka
                        dan tambahkan ke keranjang.
                    </p>

                    <Link
                        href="/products"
                        className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-rose-600 px-6 text-sm font-semibold text-white transition hover:bg-rose-700"
                    >
                        Mulai Belanja
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 pb-32">
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">

                {/* Header */}
                <div className="mb-6 flex items-center gap-4">
                    <Link
                        href="/products"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm transition hover:bg-gray-100"
                    >
                        <FiArrowLeft size={20} />
                    </Link>

                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Keranjang
                        </h1>

                        <p className="mt-1 text-sm text-gray-500">
                            {items.length} produk
                            dalam keranjang
                        </p>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">

                    {/* ITEMS */}
                    <div className="space-y-4">
                        {items.map((item) => {
                            /**
                             * Use effectivePrice for display and subtotal.
                             * originalPrice shown as strikethrough if discounted.
                             */
                            const price = item.price;
                            const originalPrice = item.originalPrice;
                            const itemTotal = price * item.quantity;
                            const image = item.image;

                            return (
                                <div
                                    key={item.id}
                                    className={`rounded-2xl border bg-white p-4 shadow-sm ${
                                        item.stockStatus !== "OK"
                                            ? "border-amber-200"
                                            : "border-gray-100"
                                    }`}
                                >
                                    <div className="flex gap-4">

                                        {/* IMAGE */}
                                        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                                            {image ? (
                                                <img
                                                    src={image}
                                                    alt={item.productName}
                                                    className="h-full w-full object-cover"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="flex h-full items-center justify-center text-gray-400">
                                                    <FiShoppingBag size={28} />
                                                </div>
                                            )}
                                        </div>

                                        {/* CONTENT */}
                                        <div className="min-w-0 flex-1">

                                            <div className="flex justify-between gap-3">
                                                <div>
                                                    <Link
                                                        href={`/products/${item.productSlug}`}
                                                        className="line-clamp-2 text-sm font-semibold text-gray-900 hover:text-rose-600"
                                                    >
                                                        {item.productName}
                                                    </Link>

                                                    <p className="mt-1 text-xs text-gray-500">
                                                        Varian:{" "}
                                                        {item.variantName}
                                                    </p>

                                                    {item.flashSaleName && (
                                                        <p className="mt-0.5 text-xs font-medium text-rose-500">
                                                            🔥 {item.flashSaleName}
                                                        </p>
                                                    )}

                                                    {item.bulkDiscountName && (
                                                        <p className="mt-0.5 text-xs font-medium text-blue-500">
                                                            📦 {item.bulkDiscountName}
                                                        </p>
                                                    )}

                                                    {item.stockStatus === "OUT_OF_STOCK" && (
                                                        <p className="mt-0.5 text-xs font-medium text-red-500">
                                                            ❌ Stok habis
                                                        </p>
                                                    )}

                                                    {item.stockStatus === "INSUFFICIENT_STOCK" && (
                                                        <p className="mt-0.5 text-xs font-medium text-amber-500">
                                                            ⚠️ Stok hanya tersedia {item.availableStock}
                                                        </p>
                                                    )}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeItem(
                                                            item.id
                                                        )
                                                    }
                                                    disabled={
                                                        updatingId ===
                                                        item.id
                                                    }
                                                    className="shrink-0 text-gray-400 transition hover:text-red-500 disabled:opacity-40"
                                                >
                                                    <FiTrash2
                                                        size={
                                                            18
                                                        }
                                                    />
                                                </button>
                                            </div>

                                            <div className="mt-4 flex items-center justify-between gap-3">

                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-gray-900">
                                                        Rp{" "}
                                                        {price.toLocaleString(
                                                            "id-ID"
                                                        )}
                                                    </p>

                                                    {item.hasDiscount && originalPrice > price && (
                                                        <p className="text-xs text-gray-400 line-through">
                                                            Rp{" "}
                                                            {originalPrice.toLocaleString(
                                                                "id-ID"
                                                            )}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex items-center rounded-xl border border-gray-200">

                                                    <button
                                                        type="button"
                                                        disabled={
                                                            item.quantity <=
                                                            1 ||
                                                            updatingId ===
                                                            item.id
                                                        }
                                                        onClick={() =>
                                                            updateQuantity(
                                                                item,
                                                                item.quantity -
                                                                1
                                                            )
                                                        }
                                                        className="flex h-9 w-9 items-center justify-center text-gray-600 transition hover:bg-gray-50 disabled:opacity-30"
                                                    >
                                                        <FiMinus
                                                            size={
                                                                15
                                                            }
                                                        />
                                                    </button>

                                                    <span className="w-9 text-center text-sm font-semibold text-gray-900">
                                                        {
                                                            item.quantity
                                                        }
                                                    </span>

                                                    <button
                                                        type="button"
                                                        disabled={
                                                            item.quantity >=
                                                            item.stock ||
                                                            updatingId ===
                                                            item.id
                                                        }
                                                        onClick={() =>
                                                            updateQuantity(
                                                                item,
                                                                item.quantity +
                                                                1
                                                            )
                                                        }
                                                        className="flex h-9 w-9 items-center justify-center text-gray-600 transition hover:bg-gray-50 disabled:opacity-30"
                                                    >
                                                        <FiPlus
                                                            size={
                                                                15
                                                            }
                                                        />
                                                    </button>

                                                </div>
                                            </div>

                                            <p className="mt-2 text-right text-sm font-bold text-rose-600">
                                                Rp{" "}
                                                {itemTotal.toLocaleString(
                                                    "id-ID"
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* SUMMARY */}
                    <div className="h-fit rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:sticky lg:top-6">

                        <h2 className="text-lg font-bold text-gray-900">
                            Ringkasan Belanja
                        </h2>

                        <div className="mt-5 space-y-4">

                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">
                                    Subtotal
                                </span>

                                <span className="font-medium text-gray-900">
                                    Rp{" "}
                                    {subtotal.toLocaleString(
                                        "id-ID"
                                    )}
                                </span>
                            </div>

                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">
                                    Ongkos kirim
                                </span>

                                <span className="text-gray-500">
                                    Dihitung saat checkout
                                </span>
                            </div>

                            <div className="border-t border-gray-100 pt-4">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-gray-900">
                                        Total
                                    </span>

                                    <span className="text-xl font-bold text-rose-600">
                                        Rp{" "}
                                        {subtotal.toLocaleString(
                                            "id-ID"
                                        )}
                                    </span>
                                </div>
                            </div>

                            {hasInvalidItems ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                    <p className="text-sm font-medium text-amber-800">
                                        ⚠️ {invalidCount} produk memiliki stok tidak mencukupi.
                                    </p>
                                    <p className="mt-1 text-xs text-amber-600">
                                        Kurangi jumlah atau hapus item sebelum checkout.
                                    </p>
                                </div>
                            ) : null}

                            <Link
                                href="/checkout"
                                className={`flex h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold text-white transition ${
                                    hasInvalidItems
                                        ? "cursor-not-allowed bg-gray-300"
                                        : "bg-rose-600 hover:bg-rose-700"
                                }`}
                                onClick={(e) => {
                                    if (hasInvalidItems) {
                                        e.preventDefault();
                                        toast.error("Hapus atau kurangi item yang stoknya tidak mencukupi terlebih dahulu.");
                                    }
                                }}
                            >
                                Lanjut ke Checkout
                            </Link>

                            <Link
                                href="/products"
                                className="flex h-11 w-full items-center justify-center rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                                Lanjut Belanja
                            </Link>

                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
