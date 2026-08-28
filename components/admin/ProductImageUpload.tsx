"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
    FiImage,
    FiUpload,
    FiX,
} from "react-icons/fi";
import toast from "react-hot-toast";

type Props = {
    value: string;
    onChange: (value: string) => void;
};

export default function ProductImageUpload({
    value,
    onChange,
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null);

    const [uploading, setUploading] =
        useState(false);

    const [mode, setMode] =
        useState<"upload" | "url">("upload");

    const [urlInput, setUrlInput] =
        useState(value);

    async function handleUpload(
        event: React.ChangeEvent<HTMLInputElement>
    ) {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        try {
            setUploading(true);

            const formData = new FormData();

            formData.append("file", file);

            const response = await fetch(
                "/api/admin/upload",
                {
                    method: "POST",
                    body: formData,
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                        "Upload gagal"
                );
            }

            onChange(data.url);
        } catch (error) {
            console.error(error);

            toast.error(
                error instanceof Error
                    ? error.message
                    : "Upload gagal"
            );
        } finally {
            setUploading(false);

            if (inputRef.current) {
                inputRef.current.value = "";
            }
        }
    }

    function handleUrlChange(
        value: string
    ) {
        setUrlInput(value);

        onChange(value);
    }

    function removeImage() {
        setUrlInput("");

        onChange("");

        if (inputRef.current) {
            inputRef.current.value = "";
        }
    }

    return (
        <div className="space-y-4">

            <div className="flex gap-2">

                <button
                    type="button"
                    onClick={() =>
                        setMode("upload")
                    }
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                        mode === "upload"
                            ? "bg-gray-900 text-white"
                            : "bg-gray-100 text-gray-600"
                    }`}
                >
                    Upload
                </button>

                <button
                    type="button"
                    onClick={() =>
                        setMode("url")
                    }
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                        mode === "url"
                            ? "bg-gray-900 text-white"
                            : "bg-gray-100 text-gray-600"
                    }`}
                >
                    URL
                </button>

            </div>

            {mode === "upload" && (
                <div>

                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleUpload}
                        className="hidden"
                        id="product-image"
                    />

                    <label
                        htmlFor="product-image"
                        className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 text-center transition hover:border-gray-400 hover:bg-gray-100"
                    >

                        {uploading ? (
                            <>
                                <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />

                                <p className="text-sm font-medium text-gray-700">
                                    Mengupload...
                                </p>
                            </>
                        ) : (
                            <>
                                <FiUpload
                                    size={28}
                                    className="mb-3 text-gray-400"
                                />

                                <p className="text-sm font-semibold text-gray-700">
                                    Upload gambar produk
                                </p>

                                <p className="mt-1 text-xs text-gray-500">
                                    JPG, PNG, WEBP • maksimal 5MB
                                </p>
                            </>
                        )}

                    </label>

                </div>
            )}

            {mode === "url" && (
                <div>

                    <input
                        value={urlInput}
                        onChange={(event) =>
                            handleUrlChange(
                                event.target.value
                            )
                        }
                        placeholder="https://example.com/product.jpg"
                        className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-rose-500"
                    />

                </div>
            )}

            {value && (
                <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">

                    <div className="relative aspect-video w-full">

                        <Image
                            src={value}
                            alt="Preview produk"
                            fill
                            className="object-contain"
                            unoptimized
                        />

                    </div>

                    <button
                        type="button"
                        onClick={removeImage}
                        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-700 shadow-md transition hover:bg-gray-100"
                        aria-label="Hapus gambar"
                    >
                        <FiX size={18} />
                    </button>

                </div>
            )}

        </div>
    );
}