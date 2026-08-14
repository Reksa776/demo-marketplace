import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
    FiArrowLeft,
    FiEdit2,
    FiPlus,
} from "react-icons/fi";

import DeleteProductButton from "./DeleteProductButton";

export default async function AdminProductsPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const role = (session.user as any).role;

    if (role !== "ADMIN") {
        redirect("/products");
    }

    const products =
        await prisma.product.findMany({
            orderBy: {
                createdAt: "desc",
            },

            include: {
                variants: {
                    orderBy: {
                        price: "asc",
                    },
                },
            },
        });

    return (
        <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                {/* HEADER */}

                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        >
                            <FiArrowLeft
                                size={20}
                            />
                        </Link>

                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                                Produk
                            </h1>

                            <p className="mt-1 text-sm text-gray-500">
                                Kelola produk dan
                                variant toko.
                            </p>
                        </div>
                    </div>

                    <Link
                        href="/admin/products/new"
                        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700"
                    >
                        <FiPlus size={18} />

                        Tambah Produk
                    </Link>
                </div>

                {/* EMPTY */}

                {products.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-20 text-center">
                        <h2 className="text-lg font-semibold text-gray-800">
                            Belum ada produk
                        </h2>

                        <p className="mt-2 text-sm text-gray-500">
                            Tambahkan produk
                            pertama untuk mulai
                            berjualan.
                        </p>

                        <Link
                            href="/admin/products/new"
                            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white hover:bg-rose-700"
                        >
                            <FiPlus size={17} />

                            Tambah Produk
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* MOBILE */}

                        <div className="space-y-4 md:hidden">
                            {products.map(
                                (product) => {
                                    const lowestPrice =
                                        product
                                            .variants
                                            .length >
                                        0
                                            ? product
                                                  .variants[0]
                                                  .price
                                            : null;

                                    const totalStock =
                                        product.variants.reduce(
                                            (
                                                total,
                                                variant
                                            ) =>
                                                total +
                                                variant.stock,
                                            0
                                        );

                                    return (
                                        <div
                                            key={
                                                product.id
                                            }
                                            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                                        >
                                            <div className="flex gap-3">
                                                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                                                    {product.image ? (
                                                        <img
                                                            src={
                                                                product.image
                                                            }
                                                            alt={
                                                                product.name
                                                            }
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : null}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                            <h2 className="font-semibold text-gray-900">
                                                                {
                                                                    product.name
                                                                }
                                                            </h2>

                                                            <p className="mt-1 text-xs text-gray-500">
                                                                {
                                                                    product.category
                                                                }
                                                            </p>
                                                        </div>

                                                        {product.bestseller && (
                                                            <span className="shrink-0 rounded-full bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-600">
                                                                Bestseller
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4">
                                                <div>
                                                    <p className="text-xs text-gray-400">
                                                        Harga
                                                    </p>

                                                    <p className="mt-1 text-sm font-semibold text-gray-900">
                                                        {lowestPrice
                                                            ? `Rp ${Number(
                                                                  lowestPrice
                                                              ).toLocaleString(
                                                                  "id-ID"
                                                              )}`
                                                            : "-"}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-gray-400">
                                                        Variant
                                                    </p>

                                                    <p className="mt-1 text-sm font-semibold text-gray-900">
                                                        {
                                                            product
                                                                .variants
                                                                .length
                                                        }
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-gray-400">
                                                        Stok
                                                    </p>

                                                    <p className="mt-1 text-sm font-semibold text-gray-900">
                                                        {
                                                            totalStock
                                                        }
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex gap-2">
                                                <Link
                                                    href={`/admin/products/${product.id}/edit`}
                                                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                                >
                                                    <FiEdit2
                                                        size={
                                                            16
                                                        }
                                                    />
                                                    Edit
                                                </Link>

                                                <DeleteProductButton
                                                    productId={
                                                        product.id
                                                    }
                                                    productName={
                                                        product.name
                                                    }
                                                />
                                            </div>
                                        </div>
                                    );
                                }
                            )}
                        </div>

                        {/* DESKTOP TABLE */}

                        <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1000px] text-left">
                                    <thead className="border-b border-gray-200 bg-gray-50">
                                        <tr>
                                            <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Produk
                                            </th>

                                            <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Kategori
                                            </th>

                                            <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Variant
                                            </th>

                                            <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Harga
                                            </th>

                                            <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Stok
                                            </th>

                                            <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Status
                                            </th>

                                            <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Aksi
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100">
                                        {products.map(
                                            (
                                                product
                                            ) => {
                                                const lowestPrice =
                                                    product
                                                        .variants
                                                        .length >
                                                    0
                                                        ? product
                                                              .variants[0]
                                                              .price
                                                        : null;

                                                const totalStock =
                                                    product.variants.reduce(
                                                        (
                                                            total,
                                                            variant
                                                        ) =>
                                                            total +
                                                            variant.stock,
                                                        0
                                                    );

                                                return (
                                                    <tr
                                                        key={
                                                            product.id
                                                        }
                                                        className="transition hover:bg-gray-50"
                                                    >
                                                        {/* PRODUCT */}

                                                        <td className="px-5 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                                                                    {product.image ? (
                                                                        <img
                                                                            src={
                                                                                product.image
                                                                            }
                                                                            alt={
                                                                                product.name
                                                                            }
                                                                            className="h-full w-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                                                                            No
                                                                            Image
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="min-w-0">
                                                                    <p className="max-w-xs truncate font-semibold text-gray-900">
                                                                        {
                                                                            product.name
                                                                        }
                                                                    </p>

                                                                    <p className="mt-1 max-w-xs truncate text-xs text-gray-400">
                                                                        /products/
                                                                        {
                                                                            product.slug
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* CATEGORY */}

                                                        <td className="px-5 py-4">
                                                            <span className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600">
                                                                {
                                                                    product.category
                                                                }
                                                            </span>
                                                        </td>

                                                        {/* VARIANTS */}

                                                        <td className="px-5 py-4">
                                                            <div className="flex max-w-xs flex-wrap gap-1.5">
                                                                {product.variants.map(
                                                                    (
                                                                        variant
                                                                    ) => (
                                                                        <span
                                                                            key={
                                                                                variant.id
                                                                            }
                                                                            className="rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-600 ring-1 ring-gray-200"
                                                                        >
                                                                            {
                                                                                variant.name
                                                                            }
                                                                        </span>
                                                                    )
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* PRICE */}

                                                        <td className="px-5 py-4">
                                                            <p className="font-semibold text-gray-900">
                                                                {lowestPrice
                                                                    ? `Rp ${Number(
                                                                          lowestPrice
                                                                      ).toLocaleString(
                                                                          "id-ID"
                                                                      )}`
                                                                    : "-"}
                                                            </p>

                                                            <p className="mt-1 text-xs text-gray-400">
                                                                harga
                                                                mulai
                                                            </p>
                                                        </td>

                                                        {/* STOCK */}

                                                        <td className="px-5 py-4">
                                                            <p
                                                                className={`font-semibold ${
                                                                    totalStock ===
                                                                    0
                                                                        ? "text-red-600"
                                                                        : totalStock <=
                                                                            5
                                                                          ? "text-amber-600"
                                                                          : "text-gray-900"
                                                                }`}
                                                            >
                                                                {
                                                                    totalStock
                                                                }
                                                            </p>

                                                            <p className="mt-1 text-xs text-gray-400">
                                                                total
                                                                stok
                                                            </p>
                                                        </td>

                                                        {/* STATUS */}

                                                        <td className="px-5 py-4">
                                                            {product.bestseller ? (
                                                                <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">
                                                                    Bestseller
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                                                                    Normal
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* ACTION */}

                                                        <td className="px-5 py-4">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Link
                                                                    href={`/admin/products/${product.id}/edit`}
                                                                    className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                                >
                                                                    <FiEdit2
                                                                        size={
                                                                            14
                                                                        }
                                                                    />
                                                                    Edit
                                                                </Link>

                                                                <DeleteProductButton
                                                                    productId={
                                                                        product.id
                                                                    }
                                                                    productName={
                                                                        product.name
                                                                    }
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}