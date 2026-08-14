"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

import {
    FiArrowLeft,
    FiPlus,
    FiTrash2,
} from "react-icons/fi";

import ProductImageUpload from "@/components/admin/ProductImageUpload";

type Variant = {
    name: string;
    price: string;
    stock: string;
    weight: string;
};

function createSlug(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

export default function NewProductPage() {
    const router = useRouter();

    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] =
        useState("");
    const [category, setCategory] =
        useState("");

    const [image, setImage] = useState("");

    const [bestseller, setBestseller] =
        useState(false);

    const [variants, setVariants] =
        useState<Variant[]>([
            {
                name: "",
                price: "",
                stock: "",
                weight: "",
            },
        ]);

    const [loading, setLoading] =
        useState(false);

    function handleNameChange(
        value: string
    ) {
        setName(value);

        setSlug(createSlug(value));
    }

    function updateVariant(
        index: number,
        field: keyof Variant,
        value: string
    ) {
        setVariants((current) =>
            current.map((variant, variantIndex) =>
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
            },
        ]);
    }

    function removeVariant(index: number) {
        if (variants.length === 1) {
            return;
        }

        setVariants((current) =>
            current.filter(
                (_, variantIndex) =>
                    variantIndex !== index
            )
        );
    }

    async function handleSubmit(
        event: React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (!name.trim()) {
            toast.error(
                "Nama produk wajib diisi."
            );

            return;
        }

        if (!slug.trim()) {
            toast.error(
                "Slug produk wajib diisi."
            );

            return;
        }

        if (!category.trim()) {
            toast.error(
                "Kategori wajib diisi."
            );

            return;
        }

        if (variants.length === 0) {
            toast.error(
                "Produk minimal memiliki satu variant."
            );

            return;
        }

        const invalidVariant =
            variants.some(
                (variant) =>
                    !variant.name.trim() ||
                    !variant.price ||
                    !variant.stock ||
                    !variant.weight
            );

        if (invalidVariant) {
            toast.error(
                "Lengkapi nama, harga, stok, dan berat semua variant."
            );

            return;
        }

        try {
            setLoading(true);

            const response = await fetch(
                "/api/admin/products",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body: JSON.stringify({
                        name: name.trim(),

                        slug: slug.trim(),

                        description:
                            description.trim() ||
                            null,

                        category:
                            category.trim(),

                        image:
                            image.trim() ||
                            null,

                        bestseller,

                        variants:
                            variants.map(
                                (variant) => ({
                                    name: variant.name,
                                    price: Number(variant.price),
                                    stock: Number(variant.stock),
                                    weight: Number(variant.weight),
                                    // image: variant.image || null,
                                })
                            ),
                    }),
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Gagal membuat produk."
                );
            }

            toast.success(
                "Produk berhasil dibuat."
            );

            router.push(
                "/admin/products"
            );

            router.refresh();
        } catch (error) {
            console.error(error);

            toast.error(
                error instanceof Error
                    ? error.message
                    : "Gagal membuat produk."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">

            <div className="mx-auto max-w-4xl">

                {/* HEADER */}

                <div className="mb-8">

                    <Link
                        href="/admin/products"
                        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
                    >
                        <FiArrowLeft
                            size={16}
                        />

                        Kembali ke Produk
                    </Link>

                    <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                        Tambah Produk
                    </h1>

                    <p className="mt-2 text-sm text-gray-500">
                        Tambahkan produk baru beserta
                        variant, harga, stok, dan gambar.
                    </p>

                </div>

                {/* FORM */}

                <form
                    onSubmit={handleSubmit}
                    className="space-y-6"
                >

                    {/* INFORMASI PRODUK */}

                    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">

                        <div className="mb-6">

                            <h2 className="text-lg font-semibold text-gray-900">
                                Informasi Produk
                            </h2>

                            <p className="mt-1 text-sm text-gray-500">
                                Informasi dasar produk yang
                                akan ditampilkan kepada customer.
                            </p>

                        </div>

                        <div className="space-y-5">

                            {/* NAME */}

                            <div>

                                <label
                                    htmlFor="name"
                                    className="mb-2 block text-sm font-semibold text-gray-700"
                                >
                                    Nama Produk
                                </label>

                                <input
                                    id="name"
                                    value={name}
                                    onChange={(event) =>
                                        handleNameChange(
                                            event.target
                                                .value
                                        )
                                    }
                                    placeholder="Contoh: Keripik Singkong Bumbu Rujak"
                                    className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                                />

                            </div>

                            {/* SLUG */}

                            <div>

                                <label
                                    htmlFor="slug"
                                    className="mb-2 block text-sm font-semibold text-gray-700"
                                >
                                    Slug
                                </label>

                                <input
                                    id="slug"
                                    value={slug}
                                    onChange={(event) =>
                                        setSlug(
                                            event.target
                                                .value
                                        )
                                    }
                                    placeholder="keripik-singkong-bumbu-rujak"
                                    className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                                />

                                <p className="mt-2 text-xs text-gray-400">
                                    Digunakan sebagai URL produk.
                                </p>

                            </div>

                            {/* CATEGORY */}

                            <div>

                                <label
                                    htmlFor="category"
                                    className="mb-2 block text-sm font-semibold text-gray-700"
                                >
                                    Kategori
                                </label>

                                <input
                                    id="category"
                                    value={category}
                                    onChange={(event) =>
                                        setCategory(
                                            event.target
                                                .value
                                        )
                                    }
                                    placeholder="Contoh: Keripik"
                                    className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                                />

                            </div>

                            {/* DESCRIPTION */}

                            <div>

                                <label
                                    htmlFor="description"
                                    className="mb-2 block text-sm font-semibold text-gray-700"
                                >
                                    Deskripsi Produk
                                </label>

                                <textarea
                                    id="description"
                                    value={description}
                                    onChange={(event) =>
                                        setDescription(
                                            event.target
                                                .value
                                        )
                                    }
                                    rows={6}
                                    placeholder="Jelaskan detail produk, bahan, ukuran, rasa, dan informasi lainnya..."
                                    className="w-full resize-none rounded-xl border border-gray-300 bg-white p-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                                />

                            </div>

                            {/* BESTSELLER */}

                            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-4">

                                <input
                                    type="checkbox"
                                    checked={
                                        bestseller
                                    }
                                    onChange={(event) =>
                                        setBestseller(
                                            event.target
                                                .checked
                                        )
                                    }
                                    className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                                />

                                <div>

                                    <p className="text-sm font-semibold text-gray-800">
                                        Tandai sebagai Best Seller
                                    </p>

                                    <p className="mt-1 text-xs text-gray-500">
                                        Produk akan masuk ke daftar
                                        produk terlaris.
                                    </p>

                                </div>

                            </label>

                        </div>

                    </section>

                    {/* GAMBAR */}

                    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">

                        <div className="mb-6">

                            <h2 className="text-lg font-semibold text-gray-900">
                                Gambar Produk
                            </h2>

                            <p className="mt-1 text-sm text-gray-500">
                                Upload gambar atau masukkan URL gambar.
                            </p>

                        </div>

                        <ProductImageUpload
                            value={image}
                            onChange={setImage}
                        />

                    </section>

                    {/* VARIANTS */}

                    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">

                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                            <div>

                                <h2 className="text-lg font-semibold text-gray-900">
                                    Variant Produk
                                </h2>

                                <p className="mt-1 text-sm text-gray-500">
                                    Setiap variant dapat memiliki harga
                                    dan stok yang berbeda.
                                </p>

                            </div>

                            <button
                                type="button"
                                onClick={addVariant}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition hover:bg-gray-800"
                            >
                                <FiPlus
                                    size={16}
                                />

                                Tambah Variant
                            </button>

                        </div>

                        <div className="space-y-4">

                            {variants.map(
                                (
                                    variant,
                                    index
                                ) => (

                                    <div
                                        key={index}
                                        className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                                    >

                                        <div className="mb-4 flex items-center justify-between">

                                            <p className="text-sm font-semibold text-gray-800">
                                                Variant{" "}
                                                {index +
                                                    1}
                                            </p>

                                            {variants.length >
                                                1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            removeVariant(
                                                                index
                                                            )
                                                        }
                                                        className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                                                        aria-label="Hapus variant"
                                                    >
                                                        <FiTrash2
                                                            size={
                                                                17
                                                            }
                                                        />
                                                    </button>
                                                )}

                                        </div>

                                        <div className="grid gap-4 md:grid-cols-4">

                                            {/* VARIANT NAME */}

                                            <div>

                                                <label className="mb-2 block text-xs font-semibold text-gray-600">
                                                    Nama Variant
                                                </label>

                                                <input
                                                    value={
                                                        variant.name
                                                    }
                                                    onChange={(
                                                        event
                                                    ) =>
                                                        updateVariant(
                                                            index,
                                                            "name",
                                                            event
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    placeholder="Contoh: 1 Kg"
                                                    className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-rose-500"
                                                />

                                            </div>

                                            {/* PRICE */}

                                            <div>

                                                <label className="mb-2 block text-xs font-semibold text-gray-600">
                                                    Harga
                                                </label>

                                                <div className="relative">

                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                                                        Rp
                                                    </span>

                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={
                                                            variant.price
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            updateVariant(
                                                                index,
                                                                "price",
                                                                event
                                                                    .target
                                                                    .value
                                                            )
                                                        }
                                                        placeholder="28900"
                                                        className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-rose-500"
                                                    />

                                                </div>

                                            </div>

                                            {/* STOCK */}

                                            <div>

                                                <label className="mb-2 block text-xs font-semibold text-gray-600">
                                                    Stok
                                                </label>

                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={
                                                        variant.stock
                                                    }
                                                    onChange={(
                                                        event
                                                    ) =>
                                                        updateVariant(
                                                            index,
                                                            "stock",
                                                            event
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    placeholder="100"
                                                    className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-rose-500"
                                                />

                                            </div>
                                            {/* WEIGHT */}

                                            <div>
                                                <label className="mb-2 block text-xs font-semibold text-gray-600">
                                                    Berat
                                                </label>

                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={variant.weight}
                                                        onChange={(event) =>
                                                            updateVariant(
                                                                index,
                                                                "weight",
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="1000"
                                                        className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 pr-14 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-rose-500"
                                                    />

                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                                        gram
                                                    </span>
                                                </div>

                                                <p className="mt-1 text-xs text-gray-400">
                                                    Contoh: 1 Kg = 1000 gram
                                                </p>
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
                            className="flex h-12 items-center justify-center rounded-xl border border-gray-300 bg-white px-6 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                        >
                            Batal
                        </Link>

                        <button
                            type="submit"
                            disabled={loading}
                            className="flex h-12 items-center justify-center rounded-xl bg-rose-600 px-7 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading
                                ? "Menyimpan..."
                                : "Simpan Produk"}
                        </button>

                    </div>

                </form>

            </div>

        </main>
    );
}