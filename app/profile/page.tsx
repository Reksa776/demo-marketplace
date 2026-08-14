import { auth } from "@/auth";

import { redirect } from "next/navigation";

import Link from "next/link";

import {
    FiUser,
    FiPackage,
    FiHeart,
    FiMapPin,
    FiSettings,
    FiChevronRight,
} from "react-icons/fi";

import LogoutButton from "@/components/profile/LogoutButton";
import BottomNavbar from "@/components/products/BottomNavbar";
import { ProductProvider } from "@/components/products/ProductContext";

const menuItems = [
    { href: "/orders", label: "Pesanan Saya", icon: FiPackage },
    { href: "/wishlist", label: "Wishlist", icon: FiHeart },
    { href: "/address", label: "Alamat", icon: FiMapPin },
    { href: "/settings", label: "Pengaturan", icon: FiSettings },
];

export default async function ProfilePage() {

    const session = await auth();

    if (!session) {

        redirect("/login");

    }

    return (
        <ProductProvider>
            <main className="mx-auto min-h-screen max-w-lg bg-white p-5">

                <div className="flex items-center gap-4 border-b border-gray-100 pb-6">

                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                        <FiUser size={24} />
                    </div>

                    <div className="min-w-0">

                        <h1 className="truncate text-base font-semibold text-gray-900">

                            {session.user?.name}

                        </h1>

                        <p className="truncate text-sm text-gray-500">

                            {session.user?.email}

                        </p>

                    </div>

                </div>

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