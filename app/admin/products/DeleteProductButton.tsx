"use client";

import { useState } from "react";
import { FiTrash2 } from "react-icons/fi";
import { useRouter } from "next/navigation";

export default function DeleteProductButton({
    productId,
    productName,
}: {
    productId: number;
    productName: string;
}) {
    const router = useRouter();

    const [loading, setLoading] =
        useState(false);

    async function handleDelete() {
        const confirmed = window.confirm(
            `Hapus produk "${productName}"?\n\nJika produk ini punya history pesanan, produk akan diarsipkan (disembunyikan dari katalog) alih-alih dihapus permanen.`
        );

        if (!confirmed) {
            return;
        }

        try {
            setLoading(true);

            const url =
                `/api/admin/products/${productId}`;

            console.log("DELETE URL:", url);

            const response = await fetch(url, {
                method: "DELETE",
                headers: {
                    "Content-Type":
                        "application/json",
                },
                cache: "no-store",
            });

            console.log(
                "DELETE STATUS:",
                response.status
            );

            const text =
                await response.text();

            console.log(
                "DELETE RESPONSE:",
                text
            );

            let data: any = {};

            try {
                data = text
                    ? JSON.parse(text)
                    : {};
            } catch {
                console.error(
                    "Response bukan JSON:",
                    text
                );
            }

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    `Gagal menghapus produk. HTTP ${response.status}`
                );
            }

            alert(
                data.message ||
                "Produk berhasil dihapus."
            );

            router.refresh();
        } catch (error) {
            console.error(
                "DELETE PRODUCT ERROR:",
                error
            );

            alert(
                error instanceof Error
                    ? error.message
                    : "Gagal menghapus produk."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-100 px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
            <FiTrash2 size={14} />

            {loading
                ? "Menghapus..."
                : "Hapus"}
        </button>
    );
}