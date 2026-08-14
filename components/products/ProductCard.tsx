"use client";

import Link from "next/link";
import Image from "next/image";

import {
    FiPlus,
    FiStar,
} from "react-icons/fi";

type ProductVariant = {
    id: number;
    name: string;
    price: string | number;
    stock: number;
    image: string | null;
};

type Product = {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    image: string | null;
    category: string | null;
    rating: number;
    sold: number;
    bestseller: boolean;
    variants: ProductVariant[];
};

type Props = {
    product: Product;
};

export default function ProductCard({
    product,
}: Props) {
    /*
     * Safety guard.
     *
     * Kalau API lama / data lama belum mempunyai
     * variants, kita tetap anggap sebagai array kosong.
     */
    const variants = Array.isArray(
        product?.variants
    )
        ? product.variants
        : [];

    /*
     * Ambil semua harga variant.
     */
    const prices = variants
        .map((variant) =>
            Number(variant.price)
        )
        .filter(
            (price) =>
                Number.isFinite(price)
        );

    const lowestPrice =
        prices.length > 0
            ? Math.min(...prices)
            : 0;

    const highestPrice =
        prices.length > 0
            ? Math.max(...prices)
            : 0;

    const hasPriceRange =
        lowestPrice !== highestPrice;

    return (
        <Link
            href={`/products/${product.slug}`}
            className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
        >
            {/* IMAGE */}
            <div className="relative aspect-square overflow-hidden bg-gray-100">
                {product.image ? (
                    <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                        className="object-cover transition duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
                        Tidak ada gambar
                    </div>
                )}

                {product.bestseller && (
                    <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-semibold text-white">
                        Terlaris
                    </span>
                )}
            </div>

            {/* CONTENT */}
            <div className="p-4">
                <h3 className="line-clamp-2 min-h-[2.75rem] text-sm font-medium text-gray-900">
                    {product.name}
                </h3>

                {/* RATING */}
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                    <FiStar
                        className="text-amber-500"
                        size={13}
                    />

                    <span>
                        5
                    </span>

                    <span className="text-gray-300">
                        ·
                    </span>

                    <span>
                        10rb+
                        terjual
                    </span>
                </div>

                {/* PRICE */}
                <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                        {prices.length === 0 ? (
                            <p className="text-sm font-medium text-gray-400">
                                Harga belum tersedia
                            </p>
                        ) : hasPriceRange ? (
                            <p className="text-sm font-semibold text-gray-900">
                                Rp{" "}
                                {lowestPrice.toLocaleString(
                                    "id-ID"
                                )}

                                <span className="mx-1 text-gray-400">
                                    -
                                </span>

                                Rp{" "}
                                {highestPrice.toLocaleString(
                                    "id-ID"
                                )}
                            </p>
                        ) : (
                            <p className="text-base font-semibold text-gray-900">
                                Rp{" "}
                                {lowestPrice.toLocaleString(
                                    "id-ID"
                                )}
                            </p>
                        )}

                        {variants.length > 0 && (
                            <p className="mt-1 text-[11px] text-gray-400">
                                {variants.length}{" "}
                                varian
                            </p>
                        )}
                    </div>

                    {/* ADD BUTTON
                    <button
                        type="button"
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                        }}
                        aria-label={`Tambah ${product.name} ke keranjang`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white transition hover:bg-gray-800"
                    >
                        <FiPlus size={14} />
                    </button> */}
                </div>
            </div>
        </Link>
    );
}