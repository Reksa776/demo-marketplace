"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import toast from "react-hot-toast";

import {
    FiArrowLeft,
    FiMinus,
    FiPlus,
    FiTrash2,
} from "react-icons/fi";

type CartItem = {
    id: number;
    quantity: number;

    product: {
        id: number;
        name: string;
        slug: string;
        image: string | null;
    };

    variant: {
        id: number;
        name: string;
        price: number;
        stock: number;
    };
};

type Props = {
    initialItems: CartItem[];
};

export default function CartPageClient({
    initialItems,
}: Props) {
    const [items, setItems] =
        useState(initialItems);

    const [loadingId, setLoadingId] =
        useState<number | null>(
            null
        );

    const subtotal = items.reduce(
        (total, item) =>
            total +
            item.variant.price *
                item.quantity,
        0
    );

    async function updateQuantity(
        item: CartItem,
        quantity: number
    ) {
        if (quantity < 1) {
            return;
        }

        if (
            quantity >
            item.variant.stock
        ) {
            toast.error(
                `Stok tersedia hanya ${item.variant.stock}.`
            );

            return;
        }

        setLoadingId(item.id);

        try {
            const response =
                await fetch(
                    `/api/cart/${item.id}`,
                    {
                        method: "PATCH",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body: JSON.stringify({
                            quantity,
                        }),
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                toast.error(
                    data.message ??
                        "Gagal mengubah quantity."
                );

                return;
            }

            setItems((current) =>
                current.map(
                    (currentItem) =>
                        currentItem.id ===
                        item.id
                            ? {
                                  ...currentItem,
                                  quantity,
                              }
                            : currentItem
                )
            );
        } catch (error) {
            console.error(error);

            toast.error(
                "Terjadi kesalahan."
            );
        } finally {
            setLoadingId(null);
        }
    }

    async function removeItem(
        itemId: number
    ) {
        setLoadingId(itemId);

        try {
            const response =
                await fetch(
                    `/api/cart/${itemId}`,
                    {
                        method: "DELETE",
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                toast.error(
                    data.message ??
                        "Gagal menghapus item."
                );

                return;
            }

            setItems((current) =>
                current.filter(
                    (item) =>
                        item.id !==
                        itemId
                )
            );

            toast.success(
                "Produk dihapus dari keranjang."
            );
        } catch (error) {
            console.error(error);

            toast.error(
                "Terjadi kesalahan."
            );
        } finally {
            setLoadingId(null);
        }
    }

    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
            {/* HEADER */}
            <div className="mb-6">
                <Link
                    href="/products"
                    className="mb-4 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-500 hover:bg-white hover:text-gray-900"
                >
                    <FiArrowLeft
                        size={17}
                    />

                    Kembali
                </Link>

                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                    Keranjang
                </h1>

                <p className="mt-1 text-sm text-gray-500">
                    Periksa kembali
                    produk sebelum
                    checkout.
                </p>
            </div>

            {items.length === 0 ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-gray-200 bg-white px-6 text-center shadow-sm">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-2xl">
                        🛒
                    </div>

                    <h2 className="mt-5 text-lg font-bold text-gray-900">
                        Keranjang masih
                        kosong
                    </h2>

                    <p className="mt-2 max-w-sm text-sm text-gray-500">
                        Yuk pilih produk
                        favoritmu dan
                        tambahkan ke
                        keranjang.
                    </p>

                    <Link
                        href="/products"
                        className="mt-6 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-700"
                    >
                        Belanja Sekarang
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
                    {/* ITEMS */}
                    <div className="space-y-3">
                        {items.map(
                            (item) => {
                                const itemTotal =
                                    item.variant
                                        .price *
                                    item.quantity;

                                const isLoading =
                                    loadingId ===
                                    item.id;

                                return (
                                    <div
                                        key={
                                            item.id
                                        }
                                        className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
                                    >
                                        <div className="flex gap-4">
                                            {/* IMAGE */}
                                            <Link
                                                href={`/products/${item.product.slug}`}
                                                className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-28 sm:w-28"
                                            >
                                                {item.product
                                                    .image ? (
                                                    <Image
                                                        src={
                                                            item.product
                                                                .image
                                                        }
                                                        alt={
                                                            item.product
                                                                .name
                                                        }
                                                        fill
                                                        sizes="112px"
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center text-xs text-gray-400">
                                                        No
                                                        image
                                                    </div>
                                                )}
                                            </Link>

                                            {/* INFO */}
                                            <div className="min-w-0 flex-1">
                                                <Link
                                                    href={`/products/${item.product.slug}`}
                                                    className="line-clamp-2 text-sm font-semibold text-gray-900 hover:text-rose-600 sm:text-base"
                                                >
                                                    {
                                                        item.product
                                                            .name
                                                    }
                                                </Link>

                                                <p className="mt-1 text-xs text-gray-500 sm:text-sm">
                                                    Varian:{" "}
                                                    <span className="font-medium text-gray-700">
                                                        {
                                                            item
                                                                .variant
                                                                .name
                                                        }
                                                    </span>
                                                </p>

                                                <p className="mt-2 text-sm font-bold text-gray-900">
                                                    Rp{" "}
                                                    {item.variant.price.toLocaleString(
                                                        "id-ID"
                                                    )}
                                                </p>

                                                <div className="mt-3 flex items-center justify-between gap-3">
                                                    {/* QUANTITY */}
                                                    <div className="flex h-9 items-center overflow-hidden rounded-lg border border-gray-200">
                                                        <button
                                                            type="button"
                                                            disabled={
                                                                isLoading ||
                                                                item.quantity <=
                                                                    1
                                                            }
                                                            onClick={() =>
                                                                updateQuantity(
                                                                    item,
                                                                    item.quantity -
                                                                        1
                                                                )
                                                            }
                                                            className="flex h-full w-9 items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                                                        >
                                                            <FiMinus
                                                                size={
                                                                    14
                                                                }
                                                            />
                                                        </button>

                                                        <span className="flex w-9 justify-center text-xs font-semibold">
                                                            {
                                                                item.quantity
                                                            }
                                                        </span>

                                                        <button
                                                            type="button"
                                                            disabled={
                                                                isLoading ||
                                                                item.quantity >=
                                                                    item
                                                                        .variant
                                                                        .stock
                                                            }
                                                            onClick={() =>
                                                                updateQuantity(
                                                                    item,
                                                                    item.quantity +
                                                                        1
                                                                )
                                                            }
                                                            className="flex h-full w-9 items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                                                        >
                                                            <FiPlus
                                                                size={
                                                                    14
                                                                }
                                                            />
                                                        </button>
                                                    </div>

                                                    {/* DELETE */}
                                                    <button
                                                        type="button"
                                                        disabled={
                                                            isLoading
                                                        }
                                                        onClick={() =>
                                                            removeItem(
                                                                item.id
                                                            )
                                                        }
                                                        className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-red-500 disabled:opacity-40"
                                                    >
                                                        <FiTrash2
                                                            size={
                                                                15
                                                            }
                                                        />

                                                        Hapus
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ITEM TOTAL */}
                                        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                                            <span className="text-xs text-gray-500">
                                                Total item
                                            </span>

                                            <span className="text-sm font-bold text-gray-900">
                                                Rp{" "}
                                                {itemTotal.toLocaleString(
                                                    "id-ID"
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                );
                            }
                        )}
                    </div>

                    {/* SUMMARY */}
                    <div className="lg:sticky lg:top-5">
                        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                            <h2 className="text-lg font-bold text-gray-900">
                                Ringkasan
                                Belanja
                            </h2>

                            <div className="mt-5 space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">
                                        Total produk
                                    </span>

                                    <span className="font-medium text-gray-900">
                                        {items.reduce(
                                            (
                                                total,
                                                item
                                            ) =>
                                                total +
                                                item.quantity,
                                            0
                                        )}{" "}
                                        item
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
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

                                <div className="border-t border-gray-100 pt-3">
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
                            </div>

                            <Link
                                href="/checkout"
                                className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700"
                            >
                                Lanjut ke
                                Checkout
                            </Link>

                            <p className="mt-3 text-center text-xs leading-5 text-gray-400">
                                Ongkos kirim
                                akan dihitung
                                pada halaman
                                checkout.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}