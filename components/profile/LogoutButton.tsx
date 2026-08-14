"use client";

import { signOut } from "next-auth/react";

import { useRouter } from "next/navigation";

import { FiLogOut } from "react-icons/fi";

export default function LogoutButton() {

    const router = useRouter();

    async function handleLogout() {

        await signOut({
            redirect: false,
        });

        router.replace("/");

        router.refresh();

    }

    return (

        <button
            onClick={handleLogout}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition-colors duration-150 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
            <FiLogOut size={16} />
            Keluar Akun
        </button>

    );

}