import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unauthorized.",
                },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        const body = await req.json();

        const {
            mode = "CART",

            addressId,
            shipping,
            paymentMethod,

            // BUY NOW
            productId,
            variantId,
            quantity,
        } = body;

        /*
         * ==========================================
         * VALIDATE MODE
         * ==========================================
         */

        if (!["CART", "BUY_NOW"].includes(mode)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Mode checkout tidak valid.",
                },
                { status: 400 }
            );
        }

        /*
         * ==========================================
         * VALIDATE ADDRESS
         * ==========================================
         */

        if (!addressId) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Alamat pengiriman wajib dipilih.",
                },
                { status: 400 }
            );
        }

        /*
         * ==========================================
         * VALIDATE SHIPPING
         * ==========================================
         */

        if (!shipping) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Layanan pengiriman wajib dipilih.",
                },
                { status: 400 }
            );
        }

        /*
         * ==========================================
         * VALIDATE PAYMENT
         * ==========================================
         */

        const allowedPaymentMethods = [
            "COD",
            "BANK_TRANSFER",
            "E_WALLET",
            "QRIS",
        ];

        if (
            !allowedPaymentMethods.includes(
                paymentMethod
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Metode pembayaran tidak valid.",
                },
                { status: 400 }
            );
        }

        /*
         * ==========================================
         * GET ADDRESS
         * ==========================================
         */

        const address = await prisma.userAddress.findFirst({
            where: {
                userId: session.user.id,
                id: addressId,
            },
        });

        if (!address) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Alamat tidak ditemukan.",
                },
                { status: 404 }
            );
        }

        /*
         * ==========================================
         * PREPARE ITEMS
         * ==========================================
         *
         * CART:
         * mengambil item dari cart.
         *
         * BUY_NOW:
         * mengambil langsung product + variant.
         */

        type CheckoutItem = {
            productId: number;
            variantId: number;
            productName: string;
            variantName: string;
            price: number;
            quantity: number;
        };

        let checkoutItems: CheckoutItem[] = [];

        /*
         * ==========================================
         * BUY NOW
         * ==========================================
         */

        if (mode === "BUY_NOW") {
            const parsedProductId =
                Number(productId);

            const parsedVariantId =
                Number(variantId);

            const parsedQuantity =
                Number(quantity);

            if (
                !Number.isInteger(
                    parsedProductId
                ) ||
                parsedProductId <= 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Produk tidak valid.",
                    },
                    { status: 400 }
                );
            }

            if (
                !Number.isInteger(
                    parsedVariantId
                ) ||
                parsedVariantId <= 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Variant tidak valid.",
                    },
                    { status: 400 }
                );
            }

            if (
                !Number.isInteger(
                    parsedQuantity
                ) ||
                parsedQuantity <= 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Quantity tidak valid.",
                    },
                    { status: 400 }
                );
            }

            const variant =
                await prisma.productVariant.findFirst(
                    {
                        where: {
                            id: parsedVariantId,
                            productId:
                                parsedProductId,
                        },

                        include: {
                            product: true,
                        },
                    }
                );

            if (!variant) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Produk atau variant tidak ditemukan.",
                    },
                    { status: 404 }
                );
            }

            if (
                parsedQuantity >
                variant.stock
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Stok ${variant.product.name} - ${variant.name} tidak mencukupi.`,
                    },
                    { status: 400 }
                );
            }

            checkoutItems = [
                {
                    productId:
                        variant.productId,

                    variantId:
                        variant.id,

                    productName:
                        variant.product.name,

                    variantName:
                        variant.name,

                    price:
                        Number(
                            variant.price
                        ),

                    quantity:
                        parsedQuantity,
                },
            ];
        }

        /*
         * ==========================================
         * CART
         * ==========================================
         */

        let cart:
            | {
                id: number;
                items: Array<{
                    productId: number;
                    variantId: number;
                    quantity: number;
                    product: {
                        name: string;
                    };
                    variant: {
                        name: string;
                        price: unknown;
                        stock: number;
                    };
                }>;
            }
            | null = null;

        if (mode === "CART") {
            cart =
                await prisma.cart.findUnique({
                    where: {
                        userId,
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

            if (
                !cart ||
                cart.items.length === 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Keranjang kosong.",
                    },
                    { status: 400 }
                );
            }

            for (const item of cart.items) {
                if (item.quantity <= 0) {
                    return NextResponse.json(
                        {
                            success: false,
                            message:
                                "Quantity produk tidak valid.",
                        },
                        { status: 400 }
                    );
                }

                if (
                    item.quantity >
                    item.variant.stock
                ) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: `Stok ${item.product.name} - ${item.variant.name} tidak mencukupi.`,
                        },
                        { status: 400 }
                    );
                }

                checkoutItems.push({
                    productId:
                        item.productId,

                    variantId:
                        item.variantId,

                    productName:
                        item.product.name,

                    variantName:
                        item.variant.name,

                    price:
                        Number(
                            item.variant.price
                        ),

                    quantity:
                        item.quantity,
                });
            }
        }

        /*
         * ==========================================
         * SUBTOTAL
         * ==========================================
         */

        const subtotal =
            checkoutItems.reduce(
                (total, item) =>
                    total +
                    item.price *
                    item.quantity,
                0
            );

        /*
         * ==========================================
         * SHIPPING COST
         * ==========================================
         */

        const shippingCost = Number(
            shipping.cost ??
            shipping.price ??
            shipping.shipping_cost ??
            0
        );

        if (
            !Number.isFinite(
                shippingCost
            ) ||
            shippingCost < 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Biaya pengiriman tidak valid.",
                },
                { status: 400 }
            );
        }

        const total =
            subtotal + shippingCost;

        /*
         * ==========================================
         * ORDER NUMBER
         * ==========================================
         */

        const orderNumber =
            `ORD-${Date.now()}-${Math.floor(
                Math.random() * 10000
            )
                .toString()
                .padStart(4, "0")}`;

        /*
         * ==========================================
         * PAYMENT STATUS
         * ==========================================
         */

        const paymentStatus =
            paymentMethod === "COD"
                ? "UNPAID"
                : "PENDING";

        /*
         * ==========================================
         * CREATE ORDER
         * ==========================================
         */

        const result =
            await prisma.$transaction(
                async (tx) => {
                    const order =
                        await tx.order.create(
                            {
                                data: {
                                    userId,

                                    orderNumber,

                                    recipientName:
                                        address.recipientName,

                                    phone:
                                        address.phone,

                                    address:
                                        address.address,

                                    province:
                                        address.province,

                                    city:
                                        address.city,

                                    district:
                                        address.district,

                                    postalCode:
                                        address.postalCode,

                                    latitude:
                                        address.latitude,

                                    longitude:
                                        address.longitude,

                                    subtotal,

                                    shippingCost,

                                    total,

                                    status:
                                        "PENDING",

                                    paymentMethod,

                                    paymentStatus,

                                    /*
                                     * KURIR DIPILIH CUSTOMER
                                     */
                                    shippingCourier:
                                        shipping.courier ??
                                        shipping.code ??
                                        null,

                                    shippingService:
                                        shipping.service ??
                                        shipping.service_name ??
                                        null,

                                    items: {
                                        create:
                                            checkoutItems.map(
                                                (
                                                    item
                                                ) => ({
                                                    productId:
                                                        item.productId,

                                                    variantId:
                                                        item.variantId,

                                                    productName:
                                                        item.productName,

                                                    variantName:
                                                        item.variantName,

                                                    price:
                                                        item.price,

                                                    quantity:
                                                        item.quantity,

                                                    subtotal:
                                                        item.price *
                                                        item.quantity,
                                                })
                                            ),
                                    },
                                },

                                include: {
                                    items: true,
                                },
                            }
                        );

                    /*
                     * ==========================================
                     * BUY NOW
                     * ==========================================
                     *
                     * TIDAK menghapus cart.
                     */

                    if (
                        mode ===
                        "BUY_NOW"
                    ) {
                        for (const item of checkoutItems) {
                            await tx.productVariant.update(
                                {
                                    where: {
                                        id:
                                            item.variantId,
                                    },

                                    data: {
                                        stock: {
                                            decrement:
                                                item.quantity,
                                        },
                                    },
                                }
                            );

                            await tx.product.update(
                                {
                                    where: {
                                        id:
                                            item.productId,
                                    },

                                    data: {
                                        sold: {
                                            increment:
                                                item.quantity,
                                        },
                                    },
                                }
                            );
                        }
                    }

                    /*
                     * ==========================================
                     * CART CHECKOUT
                     * ==========================================
                     *
                     * Hanya mode CART yang
                     * menghapus isi cart.
                     */

                    if (
                        mode ===
                        "CART" &&
                        cart
                    ) {
                        await tx.cartItem.deleteMany(
                            {
                                where: {
                                    cartId:
                                        cart.id,
                                },
                            }
                        );

                        for (const item of cart.items) {
                            await tx.productVariant.update(
                                {
                                    where: {
                                        id:
                                            item.variantId,
                                    },

                                    data: {
                                        stock: {
                                            decrement:
                                                item.quantity,
                                        },
                                    },
                                }
                            );

                            await tx.product.update(
                                {
                                    where: {
                                        id:
                                            item.productId,
                                    },

                                    data: {
                                        sold: {
                                            increment:
                                                item.quantity,
                                        },
                                    },
                                }
                            );
                        }
                    }

                    return order;
                }
            );

        /*
         * ==========================================
         * RESPONSE
         * ==========================================
         */

        return NextResponse.json({
            success: true,

            message:
                "Pesanan berhasil dibuat.",

            data: result,
        });
    } catch (error) {
        console.error(
            "CREATE ORDER ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal membuat pesanan.",
            },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unauthorized.",
                },
                { status: 401 }
            );
        }

        const orders =
            await prisma.order.findMany({
                where: {
                    userId: session.user.id,
                },

                orderBy: {
                    createdAt: "desc",
                },

                include: {
                    items: {
                        take: 1,

                        include: {
                            product: {
                                select: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                    image: true,
                                },
                            },

                            variant: {
                                select: {
                                    id: true,
                                    name: true,
                                    image: true,
                                },
                            },
                        },
                    },
                },
            });

        return NextResponse.json({
            success: true,
            data: orders,
        });
    } catch (error) {
        console.error(
            "GET CUSTOMER ORDERS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil pesanan.",
            },
            { status: 500 }
        );
    }
}