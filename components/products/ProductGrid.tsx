"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import ProductCard from "./ProductCard";
import ProductSkeleton from "../skeletons/ProductSkeleton";

import { useProduct } from "./ProductContext";

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

type ProductsResponse = {
    success: boolean;
    authenticated: boolean;
    products: Product[];
    message?: string;
};

export default function ProductGrid() {
    const {
        search,
        category,
    } = useProduct();

    const [products, setProducts] = useState<Product[]>(
        []
    );

    const [authenticated, setAuthenticated] =
        useState(false);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    async function loadProducts() {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(
                "/api/products",
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data: ProductsResponse =
                await response.json();

            // console.log(
            //     "PRODUCT AUTH STATUS:",
            //     data.authenticated
            // );

            // console.log(
            //     "PRODUCT RESPONSE:",
            //     data
            // );

            if (!response.ok) {
                throw new Error(
                    data.message ||
                        "Gagal mengambil produk."
                );
            }

            setAuthenticated(
                Boolean(data.authenticated)
            );

            /*
             * Pastikan setiap product mempunyai
             * variants berupa array.
             *
             * Ini mencegah error:
             * product.variants is undefined
             */
            const safeProducts =
                Array.isArray(data.products)
                    ? data.products.map(
                          (product) => ({
                              ...product,
                              variants:
                                  Array.isArray(
                                      product.variants
                                  )
                                      ? product.variants
                                      : [],
                          })
                      )
                    : [];

            setProducts(safeProducts);
        } catch (error) {
            console.error(
                "LOAD PRODUCTS ERROR:",
                error
            );

            setError(
                error instanceof Error
                    ? error.message
                    : "Gagal memuat produk."
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadProducts();
    }, []);

    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            const matchSearch =
                product.name
                    .toLowerCase()
                    .includes(
                        search.toLowerCase()
                    );

            const matchCategory =
                category === "Semua" ||
                product.category === category;

            return (
                matchSearch &&
                matchCategory
            );
        });
    }, [
        products,
        search,
        category,
    ]);

    if (loading) {
        return (
            <section className="mx-auto max-w-7xl px-5 py-8">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                    {Array.from({
                        length: 8,
                    }).map((_, index) => (
                        <ProductSkeleton
                            key={index}
                        />
                    ))}
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="mx-auto max-w-7xl px-5 py-10">
                <div className="rounded-3xl border border-red-100 bg-red-50 p-8 text-center">
                    <h2 className="font-semibold text-red-700">
                        Gagal memuat produk
                    </h2>

                    <p className="mt-2 text-sm text-red-600">
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={loadProducts}
                        className="mt-5 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                    >
                        Coba Lagi
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="mx-auto max-w-7xl px-5 pb-32 pt-8">
            {/* HEADER */}
            <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">
                        Produk Terlaris
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                        Pilihan favorit pelanggan
                    </p>
                </div>

                {authenticated && (
                    <span className="text-sm font-medium text-emerald-600">
                        Semua Produk
                    </span>
                )}
            </div>

            {/* PRODUCTS */}
            {filteredProducts.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white px-5 text-center">
                    <p className="text-lg font-semibold text-gray-700">
                        Produk tidak ditemukan
                    </p>

                    <p className="mt-2 text-sm text-gray-500">
                        Coba gunakan kata kunci atau
                        kategori lain.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                    {filteredProducts.map(
                        (product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                            />
                        )
                    )}
                </div>
            )}

            {/* GUEST LOGIN WALL */}
            {!authenticated && (
                <div className="relative mt-10 overflow-hidden rounded-3xl border border-gray-200 bg-white">
                    <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-rose-50 to-transparent" />

                    <div className="relative px-6 py-10 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-xl">
                            🔒
                        </div>

                        <h3 className="mt-4 text-lg font-bold text-gray-900">
                            Ingin melihat semua produk?
                        </h3>

                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                            Kamu sedang melihat produk
                            terlaris. Login atau daftar
                            untuk melihat seluruh katalog
                            produk dan melakukan pembelian.
                        </p>

                        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                            <Link
                                href="/login"
                                className="rounded-xl bg-rose-600 px-7 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
                            >
                                Login
                            </Link>

                            <Link
                                href="/register"
                                className="rounded-xl border border-gray-300 bg-white px-7 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                                Register
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}