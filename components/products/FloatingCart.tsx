"use client";

import Link from "next/link";

import { FiShoppingCart } from "react-icons/fi";

export default function FloatingCart() {
  return (
    <Link
      href="/cart"
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-gray-900 px-5 py-3 text-white shadow-lg transition-colors duration-150 hover:bg-gray-800"
    >
      <FiShoppingCart size={18} />

      <div className="text-left leading-tight">
        <p className="text-[11px] text-gray-300">2 Produk</p>
        <p className="text-sm font-semibold">Rp45.000</p>
      </div>
    </Link>
  );
}