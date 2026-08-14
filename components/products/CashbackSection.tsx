"use client";

import { FiPercent } from "react-icons/fi";

const cashbackItems = [
  { percent: "40%", label: "blu by BCA", initial: "blu" },
  { percent: "50%", label: "ShopeePay", initial: "SP" },
  { percent: "60%", label: "OVO", initial: "O" },
];

export default function CashbackSection() {
  return (
    <section className="mx-auto mt-6 max-w-7xl px-5">
      <div className="mb-3 flex items-center gap-2">
        <FiPercent className="text-gray-400" size={16} />
        <h2 className="text-sm font-semibold text-gray-900">Diskon & Cashback</h2>
      </div>

      <div className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cashbackItems.map((item) => (
          <div
            key={item.label}
            className="flex min-w-[168px] shrink-0 snap-start items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 transition-colors duration-150 hover:border-gray-300"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[10px] font-semibold text-gray-600">
              {item.initial}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{item.percent}</p>
              <p className="truncate text-xs text-gray-500">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}