"use client";

import {
    createContext,
    useContext,
    useState,
} from "react";

const ProductContext = createContext<any>(null);

export function ProductProvider({
    children,
}: {
    children: React.ReactNode;
}) {

    const [search, setSearch] = useState("");

    const [category, setCategory] = useState("Semua");

    return (

        <ProductContext.Provider
            value={{
                search,
                setSearch,
                category,
                setCategory,
            }}
        >
            {children}
        </ProductContext.Provider>

    );

}

export const useProduct = () =>
    useContext(ProductContext);