"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    FiArrowLeft,
    FiPlus,
    FiTrash2,
    FiSave,
} from "react-icons/fi";

type Variant = {
    id?: number;
    name: string;
    price: string;
    stock: string;
    weight: string;
    image: string;
};

type Product = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    category: string | null;
    image: string | null;
    bestseller: boolean;
    variants: Variant[];
};

export default function EditProductPage() {
    const params = useParams();

    const router = useRouter();

    const id = params.id as string;

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState("");

    const [form, setForm] = useState({
        name: "",
        slug: "",
        description: "",
        category: "",
        image: "",
        bestseller: false,
    });

    const [variants, setVariants] =
        useState<Variant[]>([]);

    useEffect(() => {
        loadProduct();
    }, [id]);

    async function loadProduct() {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(
                `/api/admin/products/${id}`,
                {
                    cache: "no-store",
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Gagal mengambil produk."
                );
            }

            const product: Product =
                data.product;

            setForm({
                name: product.name || "",
                slug: product.slug || "",
                description:
                    product.description || "",
                category:
                    product.category || "",
                image: product.image || "",
                bestseller:
                    Boolean(
                        product.bestseller
                    ),
            });

            setVariants(
                product.variants.map(
                    (variant) => ({
                        id: variant.id,
                        name:
                            variant.name || "",
                        price: String(
                            variant.price
                        ),
                        stock: String(
                            variant.stock
                        ),
                        weight: String(
                            variant.weight
                        ),
                        image:
                            variant.image || "",
                    })
                )
            );
        } catch (error) {
            console.error(
                "LOAD PRODUCT ERROR:",
                error
            );

            setError(
                error instanceof Error
                    ? error.message
                    : "Gagal mengambil produk."
            );
        } finally {
            setLoading(false);
        }
    }

    function updateVariant(
        index: number,
        field: keyof Variant,
        value: string
    ) {
        setVariants((current) =>
            current.map(
                (variant, variantIndex) =>
                    variantIndex === index
                        ? {
                            ...variant,
                            [field]: value,
                        }
                        : variant
            )
        );
    }

    function addVariant() {
        setVariants((current) => [
            ...current,
            {
                name: "",
                price: "",
                stock: "",
                weight: "",
                image: "",
            },
        ]);
    }

    function removeVariant(index: number) {
        if (variants.length <= 1) {
            alert(
                "Produk minimal harus memiliki satu variant."
            );

            return;
        }

        setVariants((current) =>
            current.filter(
                (_, i) => i !== index
            )
        );
    }

    async function handleSubmit(
        event: React.FormEvent
    ) {
        event.preventDefault();

        try {
            setSaving(true);
            setError("");

            const payload = {
                ...form,

                variants: variants.map(
                    (variant) => ({
                        id: variant.id,
                        name: variant.name,
                        price: Number(
                            variant.price
                        ),
                        stock: Number(
                            variant.stock
                        ),
                        weight: Number(
                            variant.weight
                        ),
                        image:
                            variant.image ||
                            null,
                    })
                ),
            };

            const response = await fetch(
                `/api/admin/products/${id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify(
                        payload
                    ),
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Gagal memperbarui produk."
                );
            }

            alert(
                "Produk berhasil diperbarui."
            );

            router.push(
                "/admin/products"
            );

            router.refresh();
        } catch (error) {
            console.error(
                "UPDATE PRODUCT ERROR:",
                error
            );

            setError(
                error instanceof Error
                    ? error.message
                    : "Gagal memperbarui produk."
            );
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-gray-50 px-4 py-10">
                <div className="mx-auto max-w-4xl text-center text-sm text-gray-500">
                    Memuat produk...
                </div>
            </main>
        );
    }

    if (error && !form.name) {
        return (
            <main className="min-h-screen bg-gray-50 px-4 py-10">
                <div className="mx-auto max-w-4xl">
                    <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-600">
                        {error}
                    </div>

                    <Link
                        href="/admin/products"
                        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-gray-700"
                    >
                        <FiArrowLeft />
                        Kembali
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
                {/* HEADER */}

                <div className="mb-6 flex items-center gap-4">
                    <Link
                        href="/admin/products"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    >
                        <FiArrowLeft
                            size={20}
                        />
                    </Link>

                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Edit Produk
                        </h1>

                        <p className="mt-1 text-sm text-gray-500">
                            Perbarui informasi
                            produk dan variant.
                        </p>
                    </div>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-5"
                >
                    {/* ERROR */}

                    {error && (
                        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    {/* PRODUCT INFO */}

                    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                        <h2 className="font-semibold text-gray-900">
                            Informasi Produk
                        </h2>

                        <div className="mt-5 grid gap-5">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Nama Produk
                                </label>

                                <input
                                    value={
                                        form.name
                                    }
                                    onChange={(e) =>
                                        setForm(
                                            {
                                                ...form,
                                                name: e
                                                    .target
                                                    .value,
                                            }
                                        )
                                    }
                                    required
                                    className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:border-rose-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Slug
                                </label>

                                <input
                                    value={
                                        form.slug
                                    }
                                    onChange={(e) =>
                                        setForm(
                                            {
                                                ...form,
                                                slug: e
                                                    .target
                                                    .value,
                                            }
                                        )
                                    }
                                    required
                                    className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:border-rose-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Kategori
                                </label>

                                <input
                                    value={
                                        form.category
                                    }
                                    onChange={(e) =>
                                        setForm(
                                            {
                                                ...form,
                                                category:
                                                    e
                                                        .target
                                                        .value,
                                            }
                                        )
                                    }
                                    required
                                    className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:border-rose-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    URL / Path Image
                                </label>

                                <input
                                    value={
                                        form.image
                                    }
                                    onChange={(e) =>
                                        setForm(
                                            {
                                                ...form,
                                                image: e
                                                    .target
                                                    .value,
                                            }
                                        )
                                    }
                                    placeholder="/uploads/products/..."
                                    className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:border-rose-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Deskripsi
                                </label>

                                <textarea
                                    value={
                                        form.description
                                    }
                                    onChange={(e) =>
                                        setForm(
                                            {
                                                ...form,
                                                description:
                                                    e
                                                        .target
                                                        .value,
                                            }
                                        )
                                    }
                                    rows={7}
                                    className="w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-rose-500"
                                />
                            </div>

                            <label className="flex cursor-pointer items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={
                                        form.bestseller
                                    }
                                    onChange={(e) =>
                                        setForm(
                                            {
                                                ...form,
                                                bestseller:
                                                    e
                                                        .target
                                                        .checked,
                                            }
                                        )
                                    }
                                    className="h-4 w-4 rounded border-gray-300 text-rose-600"
                                />

                                <span className="text-sm font-medium text-gray-700">
                                    Tandai sebagai
                                    Bestseller
                                </span>
                            </label>
                        </div>
                    </section>

                    {/* VARIANTS */}

                    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="font-semibold text-gray-900">
                                    Variant
                                </h2>

                                <p className="mt-1 text-xs text-gray-500">
                                    Berat digunakan
                                    untuk
                                    perhitungan
                                    pengiriman.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    addVariant
                                }
                                className="flex h-10 items-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-800"
                            >
                                <FiPlus
                                    size={16}
                                />

                                Variant
                            </button>
                        </div>

                        <div className="mt-5 space-y-4">
                            {variants.map(
                                (
                                    variant,
                                    index
                                ) => (
                                    <div
                                        key={
                                            variant.id ??
                                            `new-${index}`
                                        }
                                        className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                                    >
                                        <div className="mb-4 flex items-center justify-between">
                                            <p className="text-sm font-semibold text-gray-800">
                                                Variant{" "}
                                                {index +
                                                    1}
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeVariant(
                                                        index
                                                    )
                                                }
                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                                            >
                                                <FiTrash2
                                                    size={
                                                        16
                                                    }
                                                />
                                            </button>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                            <div>
                                                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                                                    Nama
                                                </label>

                                                <input
                                                    value={
                                                        variant.name
                                                    }
                                                    onChange={(
                                                        e
                                                    ) =>
                                                        updateVariant(
                                                            index,
                                                            "name",
                                                            e
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    required
                                                    className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus:border-rose-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                                                    Harga
                                                </label>

                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="9999999999"
                                                    value={
                                                        variant.price
                                                    }
                                                    onChange={(
                                                        e
                                                    ) =>
                                                        updateVariant(
                                                            index,
                                                            "price",
                                                            e
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    required
                                                    className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus:border-rose-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                                                    Stok
                                                </label>

                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={
                                                        variant.stock
                                                    }
                                                    onChange={(
                                                        e
                                                    ) =>
                                                        updateVariant(
                                                            index,
                                                            "stock",
                                                            e
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    required
                                                    className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus:border-rose-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                                                    Berat
                                                    (gram)
                                                </label>

                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={
                                                        variant.weight
                                                    }
                                                    onChange={(
                                                        e
                                                    ) =>
                                                        updateVariant(
                                                            index,
                                                            "weight",
                                                            e
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    required
                                                    className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus:border-rose-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </section>

                    {/* ACTION */}

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <Link
                            href="/admin/products"
                            className="flex h-11 items-center justify-center rounded-xl border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                            Batal
                        </Link>

                        <button
                            type="submit"
                            disabled={saving}
                            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FiSave
                                size={17}
                            />

                            {saving
                                ? "Menyimpan..."
                                : "Simpan Perubahan"}
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}