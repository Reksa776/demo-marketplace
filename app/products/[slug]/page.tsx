import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import ProductDetail from "@/components/products/ProductDetail";
import BottomNavbar from "@/components/products/BottomNavbar";

type Props = {
    params: Promise<{
        slug: string;
    }>;
};

export default async function ProductDetailPage({
    params,
}: Props) {
    const session = await auth();

    const { slug } = await params;

    /*
     * Guest tidak boleh melihat detail produk.
     * Kembalikan ke products dan tampilkan dialog login.
     */
    if (!session?.user) {
        redirect(
            `/products?guestProduct=${encodeURIComponent(
                slug
            )}`
        );
    }

    const product =
        await prisma.product.findUnique({
            where: {
                slug,
            },

            include: {
                variants: {
                    orderBy: {
                        id: "asc",
                    },
                },
            },
        });

    if (!product) {
        notFound();
    }

    /*
     * Prisma Decimal -> number
     * supaya aman dikirim ke Client Component.
     */
    const serializedProduct = {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        image: product.image,
        category: product.category,
        rating: Number(product.rating),
        sold: product.sold,
        bestseller: product.bestseller,

        variants: product.variants.map(
            (variant) => ({
                id: variant.id,
                name: variant.name,
                price: Number(
                    variant.price
                ),
                stock: variant.stock,
                image: variant.image,
            })
        ),
    };

    return (
        <main className="min-h-screen bg-gray-50 pb-24">
            <ProductDetail
                product={serializedProduct}
            />

            <BottomNavbar />
        </main>
    );
}