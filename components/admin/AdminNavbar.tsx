"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
    FiBox,
    FiGrid,
    FiLogOut,
    FiSettings,
    FiShoppingBag,
    FiUsers,
    FiMenu,
    FiX,
    FiFileText,
    FiTag,
} from "react-icons/fi";
import { useState } from "react";

const menuItems = [
    {
        label: "Dashboard",
        href: "/admin",
        icon: FiGrid,
    },
    {
        label: "Produk",
        href: "/admin/products",
        icon: FiBox,
    },
    {
        label: "Orderan",
        href: "/admin/orders",
        icon: FiShoppingBag,
    },
    {
        label: "Voucher",
        href: "/admin/vouchers",
        icon: FiTag,
    },
    {
        label: "Reports",
        href: "/admin/reports",
        icon: FiFileText,
    },
    {
        label: "Pengguna",
        href: "/admin/users",
        icon: FiUsers,
    },
    {
        label: "Pengaturan",
        href: "/admin/settings",
        icon: FiSettings,
    },
];

export default function AdminNavbar() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    function isActive(href: string) {
        if (href === "/admin") {
            return pathname === "/admin";
        }

        return pathname.startsWith(href);
    }

    async function handleLogout() {
        try {
            setLoggingOut(true);

            await signOut({
                callbackUrl: "/",
            });
        } catch (error) {
            console.error(
                "LOGOUT ERROR:",
                error
            );

            setLoggingOut(false);
        }
    }

    return (
        <>
            {/* MOBILE TOPBAR */}
            <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
                <Link
                    href="/admin"
                    className="text-lg font-bold text-gray-900"
                >
                    Admin
                    <span className="text-rose-600">
                        Panel
                    </span>
                </Link>

                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className="rounded-xl p-2 text-gray-700 hover:bg-gray-100"
                >
                    {open ? (
                        <FiX size={22} />
                    ) : (
                        <FiMenu size={22} />
                    )}
                </button>
            </header>

            {/* MOBILE MENU */}
            {open && (
                <div
                    className="fixed inset-0 z-40 bg-black/30 lg:hidden"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="absolute left-0 top-16 h-[calc(100vh-4rem)] w-72 border-r border-gray-200 bg-white p-4 shadow-xl"
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                    >
                        <AdminMenu
                            pathname={pathname}
                            isActive={isActive}
                            onNavigate={() =>
                                setOpen(false)
                            }
                        />

                        {/* MOBILE LOGOUT */}
                        <div className="mt-4 border-t border-gray-100 pt-4">
                            <button
                                type="button"
                                onClick={handleLogout}
                                disabled={loggingOut}
                                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <FiLogOut size={19} />

                                <span>
                                    {loggingOut
                                        ? "Keluar..."
                                        : "Logout"}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DESKTOP SIDEBAR */}
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-gray-200 bg-white lg:block">
                <div className="flex h-16 items-center border-b border-gray-200 px-6">
                    <Link
                        href="/admin"
                        className="text-xl font-bold text-gray-900"
                    >
                        Admin
                        <span className="text-rose-600">
                            Panel
                        </span>
                    </Link>
                </div>

                <div className="flex h-[calc(100vh-4rem)] flex-col p-4">
                    <AdminMenu
                        pathname={pathname}
                        isActive={isActive}
                    />

                    <div className="mt-auto space-y-2 border-t border-gray-100 pt-4">
                        {/* KEMBALI KE TOKO */}
                        <Link
                            href="/"
                            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                        >
                            <FiLogOut size={18} />

                            <span>
                                Kembali ke Toko
                            </span>
                        </Link>

                        {/* LOGOUT */}
                        <button
                            type="button"
                            onClick={handleLogout}
                            disabled={loggingOut}
                            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FiLogOut size={18} />

                            <span>
                                {loggingOut
                                    ? "Keluar..."
                                    : "Logout"}
                            </span>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}

function AdminMenu({
    pathname,
    isActive,
    onNavigate,
}: {
    pathname: string;
    isActive: (href: string) => boolean;
    onNavigate?: () => void;
}) {
    return (
        <nav className="space-y-1">
            {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(
                    item.href
                );

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                            active
                                ? "bg-rose-50 text-rose-600"
                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        }`}
                    >
                        <Icon size={19} />

                        <span>
                            {item.label}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}