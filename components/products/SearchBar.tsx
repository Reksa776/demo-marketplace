"use client";

import { FiSearch } from "react-icons/fi";

import { useProduct } from "./ProductContext";

export default function SearchBar() {
  const { search, setSearch } = useProduct();

  return (
    <div className="mx-auto mt-6 max-w-7xl px-5">
      <div className="relative">
        <FiSearch
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          size={17}
        />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari produk..."
          className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-900 outline-none transition-colors duration-150 placeholder:text-gray-400 focus:border-gray-400"
        />
      </div>
    </div>
  );
}