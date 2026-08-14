"use client";

import { useProduct } from "./ProductContext";

const categories = [
  { id: 0, name: "Promo & Combo" },
  { id: 1, name: "Baru!" },
  { id: 2, name: "Coffee" },
  { id: 3, name: "Non Coffee" },
  { id: 4, name: "Oatside Series" },
];

export default function CategoryTabs() {
  const { category, setCategory } = useProduct();

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-6 whitespace-nowrap">
          {categories.map((item) => {
            const active = category === item.name;
            return (
              <button
                key={item.id}
                onClick={() => setCategory(item.name)}
                className={`relative shrink-0 pb-3 pt-1 text-sm font-medium transition-colors duration-150 ${
                  active ? "text-rose-600" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {item.name}
                <span
                  className={`absolute inset-x-0 -bottom-[1px] h-[2px] bg-rose-600 transition-opacity duration-150 ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}