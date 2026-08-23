import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBatchPrices } from "@/lib/marketing/batch-pricing";

/**
 * ==========================================
 * SHARED CART FORMATTER
 * ==========================================
 *
 * Formats cart items with marketing prices.
 * Used by GET, PATCH, and DELETE to ensure
 * consistent response structure.
 *
 * Returns flat items matching the CartItem type
 * used by CartPage.tsx.
 */
async function formatCartResponse(
    cartData: {
        id: number | null;
        userId: string;
        items: Array<{
            id: number;
            productId: number;
            variantId: number;
            quantity: number;
            product: { id: number; name: string; slug: string; image: string | null; category: string | null };
            variant: { id: number; name: string; price: any; stock: number; image: string | null; weight: number };
        }>;
    } | null
) {
    if (!cartData) {
        return { cart: null };
    }

    const cartItems = cartData.items;

    const pricingResults = await resolveBatchPrices(
        cartItems.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            originalPrice: Number(item.variant.price),
            quantity: Number(item.quantity),
            category: item.product.category,
        }))
    );

    const pricingMap = new Map(
        pricingResults.map((r) => [r.variantId, r])
    );

    const formattedItems = cartItems.map((item) => {
        const pricing = pricingMap.get(item.variantId);
        const rawPrice = Number(item.variant.price);
        const effectivePrice = pricing?.effectivePrice ?? rawPrice;

        return {
            id: item.id,
            productId: item.productId,
            variantId: item.variantId,
            productName: item.product.name,
            productSlug: item.product.slug,
            variantName: item.variant.name,
            image: item.variant.image || item.product.image || null,
            price: effectivePrice,
            originalPrice: pricing?.originalPrice ?? rawPrice,
            discount: pricing?.discountAmount ?? 0,
            hasDiscount: (pricing?.discountAmount ?? 0) > 0,
            priceSource: pricing?.source ?? "ORIGINAL",
            flashSaleName: pricing?.flashSaleName ?? null,
            bulkDiscountName: pricing?.bulkDiscountName ?? null,
            quantity: Number(item.quantity),
            stock: item.variant.stock,
            weight: Number(item.variant.weight),
        };
    });

    return {
        cart: {
            id: cartData.id,
            userId: cartData.userId,
            items: formattedItems,
        },
    };
}

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    message: "Unauthorized",
                },
                {
                    status: 401,
                }
            );
        }

        const cart = await prisma.cart.findUnique({
            where: {
                userId: session.user.id,
            },
            include: {
                items: {
                    include: {
                        product: true,
                        variant: true,
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                },
            },
        });

        // ==========================================
        // FORMAT WITH MARKETING PRICES
        // ==========================================
        const result = await formatCartResponse(cart);

        return NextResponse.json(result);
    } catch (error) {
        console.error("GET CART ERROR:", error);

        return NextResponse.json(
            {
                message: "Gagal mengambil keranjang.",
            },
            {
                status: 500,
            }
        );
    }
}

export async function POST(
    request: Request
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    message: "Silakan login terlebih dahulu.",
                },
                {
                    status: 401,
                }
            );
        }

        const body = await request.json();

        const variantId = Number(
            body.variantId
        );

        const quantity = Number(
            body.quantity ?? 1
        );

        if (
            !variantId ||
            !Number.isInteger(variantId)
        ) {
            return NextResponse.json(
                {
                    message: "Varian produk tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !Number.isInteger(quantity) ||
            quantity < 1
        ) {
            return NextResponse.json(
                {
                    message: "Jumlah produk tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        const variant =
            await prisma.productVariant.findUnique({
                where: {
                    id: variantId,
                },
            });

        if (!variant) {
            return NextResponse.json(
                {
                    message: "Varian produk tidak ditemukan.",
                },
                {
                    status: 404,
                }
            );
        }

        if (variant.stock <= 0) {
            return NextResponse.json(
                {
                    message: "Stok produk habis.",
                },
                {
                    status: 400,
                }
            );
        }

        if (quantity > variant.stock) {
            return NextResponse.json(
                {
                    message: `Stok hanya tersedia ${variant.stock}.`,
                },
                {
                    status: 400,
                }
            );
        }
        // tambahin ini sebelum cart upsert
        const userExists = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true },
        });

        if (!userExists) {
            return NextResponse.json(
                {
                    message:
                        "Sesi tidak valid, silakan login ulang.",
                },
                { status: 401 }
            );
        }


        const cart =
            await prisma.cart.upsert({
                where: {
                    userId: session.user.id,
                },

                create: {
                    userId: session.user.id,
                },

                update: {},
            });

        const existingItem =
            await prisma.cartItem.findUnique({
                where: {
                    cartId_variantId: {
                        cartId: cart.id,
                        variantId,
                    },
                },
            });

        if (existingItem) {
            const newQuantity =
                existingItem.quantity +
                quantity;

            if (
                newQuantity >
                variant.stock
            ) {
                return NextResponse.json(
                    {
                        message: `Jumlah melebihi stok. Stok tersedia ${variant.stock}.`,
                    },
                    {
                        status: 400,
                    }
                );
            }

            await prisma.cartItem.update({
                where: {
                    id: existingItem.id,
                },

                data: {
                    quantity: newQuantity,
                },
            });
        } else {
            await prisma.cartItem.create({
                data: {
                    cartId: cart.id,
                    productId: variant.productId,
                    variantId: variant.id,
                    quantity,
                },
            });
        }

        // Return formatted cart with marketing prices
        const updatedCart = await prisma.cart.findUnique({
            where: { userId: session.user.id },
            include: {
                items: {
                    include: { product: true, variant: true },
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        const result = await formatCartResponse(updatedCart);

        return NextResponse.json(
            {
                message:
                    existingItem
                        ? "Keranjang berhasil diperbarui."
                        : "Produk berhasil ditambahkan ke keranjang.",
                ...result,
            },
            {
                status: existingItem ? 200 : 201,
            }
        );
    } catch (error) {
        console.error(
            "POST CART ERROR:",
            error
        );

        return NextResponse.json(
            {
                message:
                    "Gagal menambahkan produk ke keranjang.",
            },
            {
                status: 500,
            }
        );
    }
}

export async function PATCH(
    request: Request
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    message: "Silakan login terlebih dahulu.",
                },
                {
                    status: 401,
                }
            );
        }

        const body = await request.json();

        const itemId = Number(body.itemId);
        const quantity = Number(body.quantity);

        if (
            !Number.isInteger(itemId) ||
            !Number.isInteger(quantity) ||
            quantity < 1
        ) {
            return NextResponse.json(
                {
                    message:
                        "Data quantity tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        const item =
            await prisma.cartItem.findFirst({
                where: {
                    id: itemId,
                    cart: {
                        userId:
                            session.user.id,
                    },
                },
                include: {
                    variant: true,
                },
            });

        if (!item) {
            return NextResponse.json(
                {
                    message:
                        "Item keranjang tidak ditemukan.",
                },
                {
                    status: 404,
                }
            );
        }

        if (
            quantity >
            item.variant.stock
        ) {
            return NextResponse.json(
                {
                    message: `Stok hanya tersedia ${item.variant.stock}.`,
                },
                {
                    status: 400,
                }
            );
        }

        await prisma.cartItem.update({
            where: {
                id: itemId,
            },
            data: {
                quantity,
            },
        });

        // Return formatted cart with marketing prices
        const cart =
            await prisma.cart.findUnique({
                where: {
                    userId: session.user.id,
                },
                include: {
                    items: {
                        include: {
                            product: true,
                            variant: true,
                        },
                    },
                },
            });

        const result = await formatCartResponse(cart);

        return NextResponse.json({
            message:
                "Keranjang berhasil diperbarui.",
            ...result,
        });
    } catch (error) {
        console.error(
            "PATCH CART ERROR:",
            error
        );

        return NextResponse.json(
            {
                message:
                    "Gagal memperbarui keranjang.",
            },
            {
                status: 500,
            }
        );
    }
}

export async function DELETE(
    request: Request
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    message:
                        "Silakan login terlebih dahulu.",
                },
                {
                    status: 401,
                }
            );
        }

        const body = await request.json();

        const itemId = Number(body.itemId);

        if (!Number.isInteger(itemId)) {
            return NextResponse.json(
                {
                    message:
                        "Item tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        const item =
            await prisma.cartItem.findFirst({
                where: {
                    id: itemId,
                    cart: {
                        userId:
                            session.user.id,
                    },
                },
            });

        if (!item) {
            return NextResponse.json(
                {
                    message:
                        "Item tidak ditemukan.",
                },
                {
                    status: 404,
                }
            );
        }

        await prisma.cartItem.delete({
            where: {
                id: itemId,
            },
        });

        // Return formatted cart with marketing prices
        const cart =
            await prisma.cart.findUnique({
                where: {
                    userId: session.user.id,
                },
                include: {
                    items: {
                        include: {
                            product: true,
                            variant: true,
                        },
                    },
                },
            });

        const result = await formatCartResponse(cart);

        return NextResponse.json({
            message:
                "Produk berhasil dihapus.",
            ...result,
        });
    } catch (error) {
        console.error(
            "DELETE CART ERROR:",
            error
        );

        return NextResponse.json(
            {
                message:
                    "Gagal menghapus produk.",
            },
            {
                status: 500,
            }
        );
    }
}
