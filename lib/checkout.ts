import { prisma } from "@/lib/prisma";
import {
    incrementVoucherUsage,
    validateAndCalculateVoucher,
} from "@/lib/voucher";

export type CheckoutMode =
    | "CART"
    | "BUY_NOW";

export type CheckoutPaymentMethod =
    | "COD"
    | "BANK_TRANSFER"
    | "E_WALLET"
    | "QRIS";

export type ShippingOption = {
    courier?: string;
    code?: string;
    service?: string;
    service_name?: string;
    etd?: string;
    estimation?: string;
    cost?: number;
    price?: number;
    shipping_cost?: number;
};

export type CheckoutItem = {
    productId: number;
    variantId: number;
    productName: string;
    variantName: string;
    price: number;
    quantity: number;
    subtotal: number;
};

export type MidtransItem = {
    id: string;
    price: number;
    quantity: number;
    name: string;
};

export type CreateCheckoutInput = {
    userId: string;

    mode?: CheckoutMode;

    addressId: string;

    shipping: ShippingOption;

    paymentMethod: CheckoutPaymentMethod;

    voucherCode?: string | null;

    productId?: unknown;
    variantId?: unknown;
    quantity?: unknown;
};

export type CreatedCheckout = {
    order: any;

    checkoutItems: CheckoutItem[];

    itemDetails: MidtransItem[];

    subtotal: number;

    shippingCost: number;

    discount: number;

    grossAmount: number;

    cartId: number | null;
};

/*
 * ==========================================
 * SHIPPING COST
 * ==========================================
 */

export function getShippingCost(
    shipping: ShippingOption
): number {
    const value = Number(
        shipping.cost ??
            shipping.price ??
            shipping.shipping_cost ??
            0
    );

    return Number.isFinite(value) &&
        value >= 0
        ? Math.round(value)
        : NaN;
}

/*
 * ==========================================
 * MIDTRANS ENABLED PAYMENTS
 * ==========================================
 */

export function getEnabledPayments(
    paymentMethod: Exclude<
        CheckoutPaymentMethod,
        "COD"
    >
) {
    switch (paymentMethod) {
        case "BANK_TRANSFER":
            return [
                "bca_va",
                "bni_va",
                "bri_va",
                "permata_va",
            ];

        case "E_WALLET":
            return [
                "gopay",
                "shopeepay",
            ];

        case "QRIS":
            return ["qris"];

        default:
            return [];
    }
}

/*
 * ==========================================
 * ORDER NUMBER
 * ==========================================
 */

function makeOrderNumber(
    paymentMethod: CheckoutPaymentMethod,
    mode: CheckoutMode
) {
    const prefix =
        paymentMethod === "COD"
            ? "ORD"
            : mode === "BUY_NOW"
                ? "PAY-BN"
                : "PAY-CART";

    return `${prefix}-${Date.now()}-${Math.floor(
        Math.random() * 10000
    )
        .toString()
        .padStart(4, "0")}`;
}

/*
 * ==========================================
 * PARSE INTEGER
 * ==========================================
 */

function parsePositiveInteger(
    value: unknown
): number | null {
    const number = Number(value);

    if (
        !Number.isInteger(number) ||
        number <= 0
    ) {
        return null;
    }

    return number;
}

/*
 * ==========================================
 * MIDTRANS ITEMS
 * ==========================================
 */

function createMidtransItemDetails(
    checkoutItems: CheckoutItem[],
    shippingCost: number,
    discount: number,
    voucherId: number | null,
    voucherCode: string | null
): MidtransItem[] {
    const itemDetails =
        checkoutItems.map(
            (item) => ({
                id:
                    `PRODUCT-${item.productId}-VARIANT-${item.variantId}`,

                price:
                    item.price,

                quantity:
                    item.quantity,

                name:
                    `${item.productName} - ${item.variantName}`.substring(
                        0,
                        50
                    ),
            })
        );

    if (shippingCost > 0) {
        itemDetails.push({
            id: "SHIPPING",

            price:
                shippingCost,

            quantity: 1,

            name:
                "Biaya Pengiriman",
        });
    }

    if (
        discount > 0 &&
        voucherId !== null
    ) {
        itemDetails.push({
            id:
                `VOUCHER-${voucherId}`,

            price:
                -discount,

            quantity: 1,

            name:
                `Voucher ${voucherCode ?? ""}`.substring(
                    0,
                    50
                ),
        });
    }

    return itemDetails;
}

/*
 * ==========================================
 * VALIDATE MIDTRANS TOTAL
 * ==========================================
 */

function validateItemDetailsTotal(
    itemDetails: MidtransItem[],
    grossAmount: number
) {
    const itemDetailsTotal =
        itemDetails.reduce(
            (sum, item) =>
                sum +
                item.price *
                    item.quantity,
            0
        );

    if (
        itemDetailsTotal !==
        grossAmount
    ) {
        throw new Error(
            "Total item Midtrans tidak sesuai dengan gross amount."
        );
    }
}

/*
 * ==========================================
 * CLEANUP OLD MIDTRANS ATTEMPTS
 * ==========================================
 *
 * Dipanggil sebelum membuat payment
 * attempt baru.
 *
 * Contoh:
 *
 * BANK TRANSFER
 *      ↓
 * user X
 *      ↓
 * E-WALLET
 *
 * Order Midtrans lama dibatalkan.
 *
 * STOCK dikembalikan.
 * VOUCHER dikembalikan.
 *
 * CART TIDAK disentuh.
 *
 * Ini penting karena cart memang
 * sengaja tetap berisi barang selama
 * pembayaran belum berhasil.
 */

export async function cleanupPendingCheckoutOrders(
    userId: string
) {
    const pendingOrders =
        await prisma.order.findMany({
            where: {
                userId,

                paymentMethod: {
                    in: [
                        "BANK_TRANSFER",
                        "E_WALLET",
                        "QRIS",
                    ],
                },

                status: "PENDING",

                paymentStatus: "PENDING",
            },

            select: {
                id: true,
            },

            orderBy: {
                createdAt: "asc",
            },
        });

    for (const order of pendingOrders) {
        try {
            await rollbackCheckoutOrder(
                order.id,
                {
                    restoreCart: false,
                }
            );
        } catch (error) {
            console.error(
                "CLEANUP PENDING ORDER ERROR:",
                order.id,
                error
            );
        }
    }
}

/*
 * ==========================================
 * CREATE CHECKOUT ORDER
 * ==========================================
 */

export async function createCheckoutOrder(
    input: CreateCheckoutInput
): Promise<CreatedCheckout> {
    const mode =
        input.mode ?? "CART";

    /*
     * ==========================================
     * VALIDATE MODE
     * ==========================================
     */

    if (
        mode !== "CART" &&
        mode !== "BUY_NOW"
    ) {
        throw new Error(
            "Mode checkout tidak valid."
        );
    }

    /*
     * ==========================================
     * VALIDATE SHIPPING
     * ==========================================
     */

    if (
        !input.shipping ||
        typeof input.shipping !==
            "object"
    ) {
        throw new Error(
            "Layanan pengiriman wajib dipilih."
        );
    }

    const shippingCost =
        getShippingCost(
            input.shipping
        );

    if (
        !Number.isFinite(
            shippingCost
        )
    ) {
        throw new Error(
            "Biaya pengiriman tidak valid."
        );
    }

    /*
     * ==========================================
     * ADDRESS
     * ==========================================
     */

    const address =
        await prisma.userAddress.findFirst(
            {
                where: {
                    id:
                        input.addressId,

                    userId:
                        input.userId,
                },
            }
        );

    if (!address) {
        const error =
            new Error(
                "Alamat tidak ditemukan."
            );

        (error as any).status =
            404;

        throw error;
    }

    /*
     * ==========================================
     * BUY NOW PARAMETER
     * ==========================================
     */

    let productIdNumber:
        | number
        | null = null;

    let variantIdNumber:
        | number
        | null = null;

    let quantityNumber:
        | number
        | null = null;

    if (
        mode === "BUY_NOW"
    ) {
        productIdNumber =
            parsePositiveInteger(
                input.productId
            );

        variantIdNumber =
            parsePositiveInteger(
                input.variantId
            );

        quantityNumber =
            parsePositiveInteger(
                input.quantity
            );

        if (
            productIdNumber === null
        ) {
            throw new Error(
                "Produk tidak valid."
            );
        }

        if (
            variantIdNumber === null
        ) {
            throw new Error(
                "Variant tidak valid."
            );
        }

        if (
            quantityNumber === null
        ) {
            throw new Error(
                "Quantity tidak valid."
            );
        }
    }

    /*
     * ==========================================
     * IMPORTANT
     * ==========================================
     *
     * Untuk Midtrans:
     *
     * cleanup pending attempt lama
     * SEBELUM membuat attempt baru.
     *
     * Cart tetap ada.
     */

    if (
        input.paymentMethod !==
        "COD"
    ) {
        await cleanupPendingCheckoutOrders(
            input.userId
        );
    }

    /*
     * ==========================================
     * ORDER NUMBER
     * ==========================================
     */

    const orderNumber =
        makeOrderNumber(
            input.paymentMethod,
            mode
        );

    /*
     * ==========================================
     * DATABASE TRANSACTION
     * ==========================================
     */

    return prisma.$transaction(
        async (tx) => {
            let checkoutItems:
                CheckoutItem[] = [];

            let cartId:
                | number
                | null = null;

            /*
             * ==========================================
             * BUY NOW
             * ==========================================
             */

            if (
                mode ===
                "BUY_NOW"
            ) {
                const variant =
                    await tx.productVariant.findFirst(
                        {
                            where: {
                                id:
                                    variantIdNumber!,

                                productId:
                                    productIdNumber!,
                            },

                            include: {
                                product:
                                    true,
                            },
                        }
                    );

                if (!variant) {
                    throw new Error(
                        "Produk atau variant tidak ditemukan."
                    );
                }

                if (
                    variant.stock <
                    quantityNumber!
                ) {
                    throw new Error(
                        `Stok ${variant.product.name} - ${variant.name} tidak mencukupi.`
                    );
                }

                const price =
                    Math.round(
                        Number(
                            variant.price
                        )
                    );

                if (
                    !Number.isFinite(
                        price
                    ) ||
                    price < 0
                ) {
                    throw new Error(
                        "Harga produk tidak valid."
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

                        price,

                        quantity:
                            quantityNumber!,

                        subtotal:
                            price *
                            quantityNumber!,
                    },
                ];
            }

            /*
             * ==========================================
             * CART
             * ==========================================
             */

            if (
                mode === "CART"
            ) {
                const cart =
                    await tx.cart.findUnique(
                        {
                            where: {
                                userId:
                                    input.userId,
                            },

                            include: {
                                items: {
                                    include: {
                                        product:
                                            true,

                                        variant:
                                            true,
                                    },
                                },
                            },
                        }
                    );

                if (
                    !cart ||
                    cart.items.length ===
                        0
                ) {
                    throw new Error(
                        "Keranjang kosong."
                    );
                }

                cartId =
                    cart.id;

                for (
                    const item of
                        cart.items
                ) {
                    const quantity =
                        Number(
                            item.quantity
                        );

                    if (
                        !Number.isInteger(
                            quantity
                        ) ||
                        quantity <= 0
                    ) {
                        throw new Error(
                            `Quantity ${item.product.name} - ${item.variant.name} tidak valid.`
                        );
                    }

                    const price =
                        Math.round(
                            Number(
                                item.variant
                                    .price
                            )
                        );

                    if (
                        !Number.isFinite(
                            price
                        ) ||
                        price < 0
                    ) {
                        throw new Error(
                            `Harga ${item.product.name} - ${item.variant.name} tidak valid.`
                        );
                    }

                    if (
                        quantity >
                        item.variant.stock
                    ) {
                        throw new Error(
                            `Stok ${item.product.name} - ${item.variant.name} tidak mencukupi.`
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

                        price,

                        quantity,

                        subtotal:
                            price *
                            quantity,
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
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        item.subtotal,
                    0
                );

            if (
                subtotal <= 0
            ) {
                throw new Error(
                    "Subtotal tidak valid."
                );
            }

            /*
             * ==========================================
             * VOUCHER
             * ==========================================
             */

            let voucherId:
                | number
                | null = null;

            let appliedVoucherCode:
                | string
                | null = null;

            let discount = 0;

            if (
                typeof input.voucherCode ===
                    "string" &&
                input.voucherCode.trim()
            ) {
                const voucherResult =
                    await validateAndCalculateVoucher(
                        input.voucherCode,
                        subtotal,
                        tx
                    );

                if (
                    !voucherResult.valid
                ) {
                    throw new Error(
                        voucherResult.message
                    );
                }

                voucherId =
                    voucherResult
                        .voucher.id;

                appliedVoucherCode =
                    voucherResult
                        .voucher.code;

                discount =
                    voucherResult.discount;

                const voucherUsed =
                    await incrementVoucherUsage(
                        tx,
                        voucherId
                    );

                if (!voucherUsed) {
                    throw new Error(
                        "Kuota voucher baru saja habis. Silakan gunakan kode voucher lain."
                    );
                }
            }

            /*
             * ==========================================
             * TOTAL
             * ==========================================
             */

            const grossAmount =
                subtotal -
                discount +
                shippingCost;

            if (
                !Number.isInteger(
                    grossAmount
                ) ||
                grossAmount <= 0
            ) {
                throw new Error(
                    "Total pembayaran tidak valid."
                );
            }

            /*
             * ==========================================
             * MIDTRANS ITEM DETAILS
             * ==========================================
             */

            const itemDetails =
                createMidtransItemDetails(
                    checkoutItems,
                    shippingCost,
                    discount,
                    voucherId,
                    appliedVoucherCode
                );

            if (
                input.paymentMethod !==
                "COD"
            ) {
                validateItemDetailsTotal(
                    itemDetails,
                    grossAmount
                );
            }

            /*
             * ==========================================
             * CREATE ORDER
             * ==========================================
             */

            const order =
                await tx.order.create({
                    data: {
                        userId:
                            input.userId,

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
                            address.latitude ??
                            undefined,

                        longitude:
                            address.longitude ??
                            undefined,

                        subtotal,

                        shippingCost,

                        total:
                            grossAmount,

                        discount,

                        voucherId:
                            voucherId ??
                            undefined,

                        voucherCode:
                            appliedVoucherCode ??
                            undefined,

                        status:
                            "PENDING",

                        paymentMethod:
                            input.paymentMethod,

                        paymentStatus:
                            input.paymentMethod ===
                            "COD"
                                ? "UNPAID"
                                : "PENDING",

                        paymentReference:
                            orderNumber,

                        shippingCourier:
                            input.shipping
                                .courier ??
                            input.shipping
                                .code ??
                            null,

                        shippingService:
                            input.shipping
                                .service ??
                            input.shipping
                                .service_name ??
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
                                            item.subtotal,
                                    })
                                ),
                        },
                    },

                    include: {
                        items: true,
                    },
                });

            /*
             * ==========================================
             * RESERVE STOCK
             * ==========================================
             */

            for (
                const item of
                    checkoutItems
            ) {
                const stockUpdate =
                    await tx.productVariant.updateMany(
                        {
                            where: {
                                id:
                                    item.variantId,

                                stock: {
                                    gte:
                                        item.quantity,
                                },
                            },

                            data: {
                                stock: {
                                    decrement:
                                        item.quantity,
                                },
                            },
                        }
                    );

                if (
                    stockUpdate.count !==
                    1
                ) {
                    throw new Error(
                        `Stok ${item.productName} - ${item.variantName} sudah berubah. Silakan checkout ulang.`
                    );
                }

                await tx.product.update({
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
                });
            }

            /*
             * ==========================================
             * CART
             * ==========================================
             *
             * COD:
             * langsung kosong.
             *
             * MIDTRANS:
             * JANGAN kosongkan.
             *
             * Ini inti perbaikan bug:
             *
             * Bank Transfer
             * -> X
             * -> E-Wallet
             *
             * cart tetap tersedia.
             */

            if (
                input.paymentMethod ===
                    "COD" &&
                cartId !== null
            ) {
                await tx.cartItem.deleteMany(
                    {
                        where: {
                            cartId,
                        },
                    }
                );
            }

            return {
                order,

                checkoutItems,

                itemDetails,

                subtotal,

                shippingCost,

                discount,

                grossAmount,

                cartId,
            };
        },
        {
            timeout: 15000,

            maxWait: 10000,
        }
    );
}

/*
 * ==========================================
 * ROLLBACK CHECKOUT
 * ==========================================
 *
 * Default:
 * restoreCart = true
 *
 * Dipakai ketika order Midtrans
 * sudah dibuat lalu gagal.
 *
 * Tetapi karena versi baru TIDAK menghapus
 * cart untuk Midtrans, API Midtrans
 * menggunakan restoreCart: false.
 */

export async function rollbackCheckoutOrder(
    orderId: number,
    options?: {
        restoreCart?: boolean;
    }
) {
    const restoreCart =
        options?.restoreCart ?? true;

    return prisma.$transaction(
        async (tx) => {
            const order =
                await tx.order.findUnique(
                    {
                        where: {
                            id: orderId,
                        },

                        include: {
                            items: true,
                        },
                    }
                );

            if (!order) {
                return;
            }

            /*
             * Jangan rollback dua kali.
             */

            if (
                order.paymentStatus ===
                    "FAILED" &&
                order.status ===
                    "CANCELLED"
            ) {
                return;
            }

            /*
             * ==========================================
             * RESTORE CART
             * ==========================================
             *
             * Hanya dilakukan untuk order
             * yang sebelumnya memang
             * menghapus cart.
             *
             * Midtrans sekarang TIDAK
             * menghapus cart.
             */

            if (
                restoreCart &&
                order.paymentMethod ===
                    "COD"
            ) {
                const cart =
                    await tx.cart.findUnique(
                        {
                            where: {
                                userId:
                                    order.userId,
                            },
                        }
                    );

                let targetCartId =
                    cart?.id ?? null;

                if (
                    !targetCartId
                ) {
                    const createdCart =
                        await tx.cart.create(
                            {
                                data: {
                                    userId:
                                        order.userId,
                                },
                            }
                        );

                    targetCartId =
                        createdCart.id;
                }

                for (
                    const item of
                        order.items
                ) {
                    if (
                        item.variantId ===
                        null
                    ) {
                        throw new Error(
                            `Variant ID tidak ditemukan untuk OrderItem ${item.id}.`
                        );
                    }

                    if (
                        item.productId ===
                        null
                    ) {
                        throw new Error(
                            `Product ID tidak ditemukan untuk OrderItem ${item.id}.`
                        );
                    }

                    const existingCartItem =
                        await tx.cartItem.findFirst(
                            {
                                where: {
                                    cartId:
                                        targetCartId,

                                    productId:
                                        item.productId,

                                    variantId:
                                        item.variantId,
                                },
                            }
                        );

                    if (
                        existingCartItem
                    ) {
                        await tx.cartItem.update(
                            {
                                where: {
                                    id:
                                        existingCartItem.id,
                                },

                                data: {
                                    quantity: {
                                        increment:
                                            item.quantity,
                                    },
                                },
                            }
                        );
                    } else {
                        await tx.cartItem.create(
                            {
                                data: {
                                    cartId:
                                        targetCartId,

                                    productId:
                                        item.productId,

                                    variantId:
                                        item.variantId,

                                    quantity:
                                        item.quantity,
                                },
                            }
                        );
                    }
                }
            }

            /*
             * ==========================================
             * RESTORE STOCK + SOLD
             * ==========================================
             */

            for (
                const item of
                    order.items
            ) {
                if (
                    item.variantId ===
                    null
                ) {
                    throw new Error(
                        `Variant ID tidak ditemukan untuk OrderItem ${item.id}.`
                    );
                }

                if (
                    item.productId ===
                    null
                ) {
                    throw new Error(
                        `Product ID tidak ditemukan untuk OrderItem ${item.id}.`
                    );
                }

                await tx.productVariant.update(
                    {
                        where: {
                            id:
                                item.variantId,
                        },

                        data: {
                            stock: {
                                increment:
                                    item.quantity,
                            },
                        },
                    }
                );

                await tx.product.update({
                    where: {
                        id:
                            item.productId,
                    },

                    data: {
                        sold: {
                            decrement:
                                item.quantity,
                        },
                    },
                });
            }

            /*
             * ==========================================
             * RESTORE VOUCHER QUOTA
             * ==========================================
             */

            if (
                typeof order.voucherId ===
                "number"
            ) {
                await tx.voucher.updateMany(
                    {
                        where: {
                            id:
                                order.voucherId,

                            usedCount: {
                                gt: 0,
                            },
                        },

                        data: {
                            usedCount: {
                                decrement: 1,
                            },
                        },
                    }
                );
            }

            /*
             * ==========================================
             * CANCEL ORDER
             * ==========================================
             */

            await tx.order.update({
                where: {
                    id:
                        order.id,
                },

                data: {
                    status:
                        "CANCELLED",

                    paymentStatus:
                        "FAILED",
                },
            });
        },
        {
            timeout: 15000,

            maxWait: 10000,
        }
    );
}

/*
 * ==========================================
 * CLEAR CART
 * ==========================================
 */

export async function clearCart(
    userId: string
) {
    const cart =
        await prisma.cart.findUnique(
            {
                where: {
                    userId,
                },
            }
        );

    if (!cart) {
        return;
    }

    await prisma.cartItem.deleteMany({
        where: {
            cartId:
                cart.id,
        },
    });
}