import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
    FiArrowRight,
    FiShoppingBag,
} from "react-icons/fi";
import BannerSlider from "@/components/products/BannerSlider";
import { ProductProvider } from "@/components/products/ProductContext";
import { auth } from "@/auth";
import BottomNavbar from "@/components/products/BottomNavbar";

type ProductWithVariant = {
    bestseller: boolean;
    id: number;
    name: string;
    slug: string;
    image: string | null;
    sold: number;
    rating: number;
    variants: {
        id: number;
        name: string;
        price: unknown;
        image: string | null;
    }[];
};

function formatRupiah(value: number) {
    return `Rp ${value.toLocaleString("id-ID")}`;
}

function getProductPrice(
    product: ProductWithVariant
) {
    if (!product.variants.length) {
        return 0;
    }

    return Math.min(
        ...product.variants.map((variant) =>
            Number(variant.price)
        )
    );
}

function getProductImage(
    product: ProductWithVariant
) {
    if (product.image) {
        return product.image;
    }

    return (
        product.variants.find(
            (variant) => variant.image
        )?.image ?? null
    );
}

async function getProducts() {
    const [bestSeller, latest] =
        await Promise.all([
            prisma.product.findMany({
                where: {
                    bestseller: true,
                },
                orderBy: [
                    {
                        sold: "desc",
                    },
                    {
                        rating: "desc",
                    },
                ],
                take: 8,
                include: {
                    variants: {
                        orderBy: {
                            price: "asc",
                        },
                        take: 1,
                    },
                },
            }),

            prisma.product.findMany({
                orderBy: {
                    createdAt: "desc",
                },
                take: 8,
                include: {
                    variants: {
                        orderBy: {
                            price: "asc",
                        },
                        take: 1,
                    },
                },
            }),
        ]);

    return {
        bestSeller,
        latest,
    };
}

function ProductCard({
    product,
}: {
    product: ProductWithVariant;
}) {
    const image =
        getProductImage(product);

    const price =
        getProductPrice(product);

    return (
        <Link
            href={`/products/${product.slug}`}
            className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-lg"
        >
            <div className="relative aspect-square overflow-hidden bg-gray-100">
                {image ? (
                    <img
                        src={image}
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                        <FiShoppingBag size={40} />
                    </div>
                )}

                {product.bestseller && (
                    <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-3 py-1 text-[11px] font-bold text-white">
                        BEST SELLER
                    </span>
                )}
            </div>

            <div className="p-4">
                <h3 className="line-clamp-2 min-h-[48px] text-sm font-semibold text-gray-900">
                    {product.name}
                </h3>

                <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-base font-bold text-rose-600">
                        {formatRupiah(price)}
                    </span>

                    <span className="text-xs text-gray-400">
                        {product.sold} terjual
                    </span>
                </div>

                {product.rating > 0 && (
                    <div className="mt-2 text-xs text-yellow-500">
                        ★ {product.rating.toFixed(1)}
                    </div>
                )}
            </div>
        </Link>
    );
}

function ProductSection({
    title,
    subtitle,
    products,
}: {
    title: string;
    subtitle: string;
    products: ProductWithVariant[];
}) {
    return (
        <section>
            <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                        {title}
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                        {subtitle}
                    </p>
                </div>

                <Link
                    href="/products"
                    className="hidden items-center gap-2 text-sm font-semibold text-rose-600 hover:text-rose-700 sm:flex"
                >
                    Lihat Semua
                    <FiArrowRight size={16} />
                </Link>
            </div>

            {products.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
                    <p className="font-semibold text-gray-900">
                        Belum ada produk.
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                        Produk akan muncul di sini.
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        {products.map(
                            (product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                />
                            )
                        )}
                    </div>

                    <div className="mt-5 sm:hidden">
                        <Link
                            href="/products"
                            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700"
                        >
                            Lihat Semua Produk
                            <FiArrowRight size={16} />
                        </Link>
                    </div>
                </>
            )}
        </section>
    );
}

export default async function HomePage() {
    const {
        bestSeller,
        latest,
    } = await getProducts();
    const session = await auth();

    return (
        <ProductProvider>
            <main className="min-h-screen mb-20 bg-gray-50">
                {session?.user && (
                    <>
                        {/* BANNER */}
                        <section className="w-full">
                            <BannerSlider />
                        </section>

                        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
                            <div className="space-y-12">

                                {/* BEST SELLER */}
                                <ProductSection
                                    title="Best Seller"
                                    subtitle="Produk yang paling banyak dibeli customer."
                                    products={bestSeller}
                                />

                                {/* TERBARU */}
                                <ProductSection
                                    title="Produk Terbaru"
                                    subtitle="Produk terbaru yang baru ditambahkan."
                                    products={latest}
                                />

                            </div>
                        </div>
                        <BottomNavbar />
                    </>
                )}
            </main>
        </ProductProvider>
    );
}