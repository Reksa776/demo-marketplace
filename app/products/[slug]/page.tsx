import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBatchPrices } from "@/lib/marketing/batch-pricing";

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

    // Guest redirect
    if (!session?.user) {
        redirect(
            `/products?guestProduct=${encodeURIComponent(
                slug
            )}`
        );
    }

    const product =
        await prisma.product.findFirst({
            where: {
                slug,
                isArchived: false,
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

    // ==========================================
    // BATCH MARKETING PRICING
    // ==========================================

    const pricingResults =
        await resolveBatchPrices(
            product.variants.map((v) => ({
                productId: product.id,
                variantId: v.id,
                originalPrice: Number(v.price),
                quantity: 1,
                category: product.category,
            }))
        );

    const pricingMap = new Map(
        pricingResults.map((r) => [
            r.variantId,
            r,
        ])
    );

    // ==========================================
    // SERIALIZE WITH MARKETING PRICES
    // ==========================================

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
            (variant) => {
                const pricing =
                    pricingMap.get(variant.id);

                const rawPrice = Number(
                    variant.price
                );

                return {
                    id: variant.id,
                    name: variant.name,
                    price: rawPrice,
                    effectivePrice:
                        pricing
                            ?.effectivePrice ??
                        rawPrice,
                    originalPrice:
                        pricing
                            ?.originalPrice ??
                        rawPrice,
                    discount:
                        pricing
                            ?.discountAmount ??
                        0,
                    hasDiscount:
                        (pricing
                            ?.discountAmount ??
                            0) > 0,
                    priceSource:
                        pricing
                            ?.source ??
                        "ORIGINAL",
                    flashSaleName:
                        pricing
                            ?.flashSaleName ??
                        null,
                    flashSaleEndAt:
                        pricing
                            ?.flashSaleEndAt
                            ?.toISOString() ??
                        null,
                    stock: variant.stock,
                    image: variant.image,
                };
            }
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
