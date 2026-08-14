"use client";

import { FiChevronDown, FiMapPin } from "react-icons/fi";

export default function LocationHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white px-5 pb-3 pt-4">
      <div className="mx-auto max-w-7xl">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left transition-colors duration-150 hover:border-gray-300"
        >
          <FiMapPin className="shrink-0 text-gray-400" size={18} />

          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-gray-900">
              Shell Cirebon
            </h2>
            <p className="truncate text-xs text-gray-500">
              Jl. Kesambi No. 130, Sunyaragi, Kec Kesambi, Kota Cirebon
            </p>
          </div>

          <FiChevronDown className="shrink-0 text-gray-400" size={16} />
        </button>
      </div>
    </header>
  );
}