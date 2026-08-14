import Link from "next/link";

import { FiLock } from "react-icons/fi";

export default function GuestDivider() {
  return (
    <section className="mx-auto mb-16 mt-10 max-w-xl px-5">
      <div className="rounded-2xl border border-gray-200 p-8 text-center">
        <FiLock className="mx-auto mb-4 text-gray-400" size={28} />

        <h2 className="text-lg font-semibold text-gray-900">
          Lihat Semua Produk
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          Login atau daftar untuk melihat seluruh katalog,
          detail produk, wishlist, dan checkout.
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/login"
            className="flex-1 rounded-lg bg-gray-900 py-2.5 text-center text-sm font-semibold text-white transition-colors duration-150 hover:bg-gray-800"
          >
            Login
          </Link>

          <Link
            href="/register"
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-center text-sm font-semibold text-gray-700 transition-colors duration-150 hover:bg-gray-50"
          >
            Register
          </Link>
        </div>
      </div>
    </section>
  );
}