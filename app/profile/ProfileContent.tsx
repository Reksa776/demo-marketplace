"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    FiUser,
    FiPackage,
    FiMapPin,
    FiChevronRight,
    FiEdit3,
    FiCheck,
    FiX,
} from "react-icons/fi";

import LogoutButton from "@/components/profile/LogoutButton";
import BottomNavbar from "@/components/products/BottomNavbar";
import { ProductProvider } from "@/components/products/ProductContext";

type Props = {
    user: {
        name?: string | null;
        email?: string | null;
        phone?: string | null;
    };
};

const menuItems = [
    { href: "/orders", label: "Pesanan Saya", icon: FiPackage },
    { href: "/addresses", label: "Alamat Saya", icon: FiMapPin },
];

export default function ProfileContent({ user }: Props) {
    const [phone, setPhone] = useState(user.phone || "");
    const [editingPhone, setEditingPhone] = useState(false);
    const [phoneInput, setPhoneInput] = useState(user.phone || "");
    const [saving, setSaving] = useState(false);

    async function savePhone() {
        const trimmed = phoneInput.trim();

        if (trimmed === phone) {
            setEditingPhone(false);
            return;
        }

        try {
            setSaving(true);

            const response = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: trimmed }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Gagal menyimpan nomor telepon.");
            }

            setPhone(result.data?.phone || "");
            setEditingPhone(false);
            toast.success("Nomor telepon berhasil diperbarui.");
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Gagal menyimpan nomor telepon."
            );
        } finally {
            setSaving(false);
        }
    }

    function cancelEditPhone() {
        setPhoneInput(phone);
        setEditingPhone(false);
    }

    return (
        <ProductProvider>
            <main className="mx-auto min-h-screen max-w-lg bg-white p-5">
                {/* USER INFO */}
                <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                        <FiUser size={24} />
                    </div>

                    <div className="min-w-0">
                        <h1 className="truncate text-base font-semibold text-gray-900">
                            {user.name}
                        </h1>
                        <p className="truncate text-sm text-gray-500">
                            {user.email}
                        </p>
                    </div>
                </div>

                {/* PHONE SECTION */}
                <div className="border-b border-gray-100 py-4">
                    <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-400">
                                Nomor Telepon
                            </p>

                            {editingPhone ? (
                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        type="tel"
                                        value={phoneInput}
                                        onChange={(e) => setPhoneInput(e.target.value)}
                                        placeholder="08xxxxxxxxxx"
                                        autoFocus
                                        className="h-10 min-w-0 flex-1 rounded-xl border border-gray-300 px-3 text-sm outline-none focus:border-rose-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={savePhone}
                                        disabled={saving}
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white transition hover:bg-rose-700 disabled:opacity-50"
                                    >
                                        <FiCheck size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={cancelEditPhone}
                                        disabled={saving}
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <FiX size={16} />
                                    </button>
                                </div>
                            ) : (
                                <p className="mt-0.5 text-sm font-medium text-gray-900">
                                    {phone || (
                                        <span className="italic text-gray-400">
                                            Belum diisi
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>

                        {!editingPhone && (
                            <button
                                type="button"
                                onClick={() => {
                                    setPhoneInput(phone);
                                    setEditingPhone(true);
                                }}
                                className="ml-3 flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100"
                            >
                                <FiEdit3 size={14} />
                                {phone ? "Ubah" : "Tambah"}
                            </button>
                        )}
                    </div>
                </div>

                {/* MENU */}
                <div className="mt-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="flex items-center justify-between border-b border-gray-100 py-4 transition-colors duration-150 hover:bg-gray-50"
                            >
                                <span className="flex items-center gap-3 text-sm font-medium text-gray-700">
                                    <Icon className="text-gray-400" size={18} />
                                    {item.label}
                                </span>

                                <FiChevronRight className="text-gray-300" size={18} />
                            </Link>
                        );
                    })}
                </div>

                <LogoutButton />
                <BottomNavbar />
            </main>
        </ProductProvider>
    );
}
