import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const session = await auth();

        const authenticated = Boolean(
            session?.user?.id
        );

        const products =
            await prisma.product.findMany({
                where: authenticated
                    ? {}
                    : {
                          bestseller: true,
                      },

                orderBy: [
                    {
                        bestseller: "desc",
                    },
                    {
                        createdAt: "desc",
                    },
                ],

                include: {
                    variants: {
                        orderBy: {
                            id: "asc",
                        },
                    },
                },
            });

        const formattedProducts =
            products.map((product) => ({
                id: product.id,
                slug: product.slug,
                name: product.name,
                description:
                    product.description,
                image: product.image,
                category:
                    product.category,
                rating: product.rating,
                sold: product.sold,
                bestseller:
                    product.bestseller,

                variants:
                    product.variants.map(
                        (variant) => ({
                            id: variant.id,
                            productId:
                                variant.productId,
                            name: variant.name,
                            price: Number(
                                variant.price
                            ),
                            stock:
                                variant.stock,
                            image:
                                variant.image,
                        })
                    ),
            }));

        return NextResponse.json({
            success: true,
            authenticated,
            products:
                formattedProducts,
        });
    } catch (error) {
        console.error(
            "GET PRODUCTS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                authenticated: false,
                products: [],
                message:
                    "Gagal mengambil produk.",
            },
            {
                status: 500,
            }
        );
    }
}