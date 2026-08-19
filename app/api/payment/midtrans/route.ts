import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
    incrementVoucherUsage,
    validateAndCalculateVoucher,
} from "@/lib/voucher";
import Midtrans from "midtrans-client";

const snap =
    new Midtrans.Snap({
        isProduction:
            process.env.MIDTRANS_IS_PRODUCTION ===
            "true",

        serverKey:
            process.env.MIDTRANS_SERVER_KEY!,

        clientKey:
            process.env.MIDTRANS_CLIENT_KEY!,
    });

type CheckoutItem = {
    productId: number;
    variantId: number;
    productName: string;
    variantName: string;
    price: number;
    quantity: number;
    subtotal: number;
};

type ShippingOption = {
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

type MidtransItem = {
    id: string;
    price: number;
    quantity: number;
    name: string;
};

/*
 * ==========================================
 * SHIPPING COST
 * ==========================================
 */

function getShippingCost(
    shipping: ShippingOption
) {
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

function getEnabledPayments(paymentMethod: string) {
    switch (paymentMethod) {
        case "BANK_TRANSFER":
            return ["bca_va", "bni_va", "bri_va", "permata_va"];

        case "E_WALLET":
            return ["gopay", "shopeepay"];

        case "QRIS":
            return ["qris"];

        default:
            return [];
    }
}

/*
 * ==========================================
 * POST
 * ==========================================
 *
 * MODE:
 *
 * CART
 * BUY_NOW
 *
 * NON-COD ONLY.
 *
 * Order dibuat SEBELUM Snap token dikirim
 * ke frontend.
 */
export async function POST(
    request: Request
) {
    try {
        /*
         * ==========================================
         * AUTH
         * ==========================================
         */

        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Silakan login terlebih dahulu.",
                },
                { status: 401 }
            );
        }

        const userId =
            session.user.id;

        /*
         * ==========================================
         * BODY
         * ==========================================
         */

        const body =
            await request.json();

        const {
            mode = "CART",

            addressId,

            shipping,

            paymentMethod,

            voucherCode,

            productId,

            variantId,

            quantity,
        } = body;

        /*
         * ==========================================
         * MODE
         * ==========================================
         */

        if (
            !["CART", "BUY_NOW"].includes(
                mode
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Mode checkout tidak valid.",
                },
                { status: 400 }
            );
        }

        /*
         * ==========================================
         * PAYMENT
         * ==========================================
         */

        const allowedPaymentMethods = [
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
                        "Metode pembayaran Midtrans tidak valid.",
                },
                { status: 400 }
            );
        }

        /*
         * ==========================================
         * ADDRESS
         * ==========================================
         */

        if (
            typeof addressId !==
            "string" ||
            !addressId.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Alamat pengiriman wajib dipilih.",
                },
                { status: 400 }
            );
        }

        const address =
            await prisma.userAddress.findFirst(
                {
                    where: {
                        id: addressId,
                        userId,
                    },
                }
            );

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
         * SHIPPING
         * ==========================================
         */

        if (
            !shipping ||
            typeof shipping !== "object"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Layanan pengiriman wajib dipilih.",
                },
                { status: 400 }
            );
        }

        const shippingCost =
            getShippingCost(
                shipping
            );

        if (
            !Number.isFinite(
                shippingCost
            )
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

        /*
         * ==========================================
         * BUY NOW VALIDATE PARAMETER
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

        if (mode === "BUY_NOW") {
            productIdNumber =
                Number(productId);

            variantIdNumber =
                Number(variantId);

            quantityNumber =
                Number(quantity);

            if (
                !Number.isInteger(
                    productIdNumber
                ) ||
                productIdNumber <= 0
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
                    variantIdNumber
                ) ||
                variantIdNumber <= 0
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
                    quantityNumber
                ) ||
                quantityNumber <= 0
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
        }

        /*
         * ==========================================
         * PAYMENT REFERENCE
         * ==========================================
         */

        const prefix =
            mode === "BUY_NOW"
                ? "PAY-BN"
                : "PAY-CART";

        const orderNumber =
            `${prefix}-${Date.now()}-${Math.floor(
                Math.random() * 10000
            )
                .toString()
                .padStart(4, "0")}`;

        /*
         * ==========================================
         * CREATE ORDER + RESERVE STOCK
         * ==========================================
         */

        const result =
            await prisma.$transaction(
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
                        mode === "BUY_NOW"
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
                                    variant
                                        .product
                                        .name,

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
                                        userId,
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
                            cart.items
                                .length === 0
                        ) {
                            throw new Error(
                                "Keranjang kosong."
                            );
                        }

                        cartId =
                            cart.id;

                        for (const item of cart.items) {
                            const itemQuantity =
                                Number(
                                    item.quantity
                                );

                            if (
                                !Number.isInteger(
                                    itemQuantity
                                ) ||
                                itemQuantity <=
                                0
                            ) {
                                throw new Error(
                                    `Quantity ${item.product.name} - ${item.variant.name} tidak valid.`
                                );
                            }

                            if (
                                itemQuantity >
                                item.variant
                                    .stock
                            ) {
                                throw new Error(
                                    `Stok ${item.product.name} - ${item.variant.name} tidak mencukupi.`
                                );
                            }

                            const price =
                                Math.round(
                                    Number(
                                        item
                                            .variant
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

                            checkoutItems.push(
                                {
                                    productId:
                                        item.productId,

                                    variantId:
                                        item.variantId,

                                    productName:
                                        item
                                            .product
                                            .name,

                                    variantName:
                                        item
                                            .variant
                                            .name,

                                    price,

                                    quantity:
                                        itemQuantity,

                                    subtotal:
                                        price *
                                        itemQuantity,
                                }
                            );
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
                        typeof voucherCode ===
                        "string" &&
                        voucherCode.trim()
                    ) {
                        const voucherResult =
                            await validateAndCalculateVoucher(
                                voucherCode,
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
                            voucherResult.voucher.id;

                        appliedVoucherCode =
                            voucherResult.voucher.code;

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

                    const itemDetails:
                        MidtransItem[] =
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

                    /*
                     * Shipping sebagai item.
                     */

                    if (
                        shippingCost > 0
                    ) {
                        itemDetails.push({
                            id: "SHIPPING",

                            price:
                                shippingCost,

                            quantity: 1,

                            name:
                                "Biaya Pengiriman",
                        });
                    }

                    /*
                     * Voucher sebagai item
                     * dengan harga NEGATIF.
                     */

                    if (
                        discount > 0
                    ) {
                        itemDetails.push({
                            id: `VOUCHER-${voucherId}`,

                            price:
                                -discount,

                            quantity: 1,

                            name:
                                `Voucher ${appliedVoucherCode}`.substring(
                                    0,
                                    50
                                ),
                        });
                    }

                    /*
                     * Pastikan item_details
                     * sama dengan gross_amount.
                     */

                    const itemDetailsTotal =
                        itemDetails.reduce(
                            (
                                sum,
                                item
                            ) =>
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

                    /*
                     * ==========================================
                     * CREATE ORDER
                     * ==========================================
                     */

                    const order =
                        await tx.order.create({
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
                                    address.latitude ?? undefined,

                                longitude:
                                    address.longitude ?? undefined,

                                subtotal,

                                shippingCost,

                                total:
                                    grossAmount,

                                discount,

                                voucherId:
                                    voucherId ?? undefined,

                                voucherCode:
                                    appliedVoucherCode ?? undefined,

                                status:
                                    "PENDING",

                                paymentMethod,

                                paymentStatus:
                                    "PENDING",

                                paymentReference:
                                    orderNumber,

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
                                            (item) => ({
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

                    for (const item of checkoutItems) {
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
                     * CART:
                     * HAPUS SETELAH ORDER DIBUAT
                     * ==========================================
                     */

                    // if (
                    //     mode === "CART" &&
                    //     cartId !== null
                    // ) {
                    //     await tx.cartItem.deleteMany(
                    //         {
                    //             where: {
                    //                 cartId:
                    //                     cartId,
                    //             },
                    //         }
                    //     );
                    // }

                    return {
                        order,

                        itemDetails,

                        subtotal,

                        shippingCost,

                        discount,

                        grossAmount,
                    };
                },
                {
                    timeout: 15000,
                    maxWait: 10000,
                }
            );

        /*
         * ==========================================
         * MIDTRANS PARAMETER
         * ==========================================
         */

        const parameter = {
            transaction_details: {
                order_id: result.order.orderNumber,
                gross_amount: result.grossAmount,
            },

            item_details: result.itemDetails,

            customer_details: {
                first_name:
                    address.recipientName.substring(
                        0,
                        50
                    ),

                phone:
                    address.phone.substring(
                        0,
                        20
                    ),

                email:
                    session.user.email ??
                    undefined,

                shipping_address: {
                    first_name:
                        address.recipientName.substring(
                            0,
                            50
                        ),

                    phone:
                        address.phone.substring(
                            0,
                            20
                        ),

                    address:
                        address.address,

                    city:
                        address.city ??
                        undefined,

                    postal_code:
                        address.postalCode ??
                        undefined,

                    country_code:
                        "IDN",
                },
            },
            enabled_payments: getEnabledPayments(paymentMethod),

            callbacks: {
                finish:
                    `${process.env.NEXT_PUBLIC_APP_URL}/checkout/payment-finish?payment=${encodeURIComponent(
                        result.order
                            .orderNumber
                    )}`,
            },

            custom_expiry: {
                expiry_duration: 1,
                unit: "hour",
            },
        };

        console.log(
            "========== MIDTRANS CREATE =========="
        );

        console.log(
            "MODE:",
            mode
        );

        console.log(
            "ORDER:",
            result.order
                .orderNumber
        );

        console.log(
            "GROSS:",
            result.grossAmount
        );

        console.log(
            "DISCOUNT:",
            result.discount
        );

        /*
         * ==========================================
         * CREATE SNAP TRANSACTION
         * ==========================================
         */

        let transaction: any;

        try {
            transaction =
                await snap.createTransaction(
                    parameter
                );
        } catch (midtransError) {
            /*
             * ==========================================
             * COMPENSATING ROLLBACK
             * ==========================================
             *
             * Karena transaction database
             * sudah committed sebelum request
             * Midtrans dilakukan.
             *
             * Kalau Snap gagal:
             *
             * - CANCEL order
             * - stock dikembalikan
             * - sold dikurangi
             * - quota voucher dikembalikan
             */

            console.error(
                "MIDTRANS CREATE FAILED:",
                midtransError
            );

            try {
                await prisma.$transaction(
                    async (tx) => {
                        const existingOrder =
                            await tx.order.findUnique(
                                {
                                    where: {
                                        id:
                                            result
                                                .order
                                                .id,
                                    },

                                    include: {
                                        items: true,
                                    },
                                }
                            );

                        if (
                            !existingOrder
                        ) {
                            return;
                        }

                        /*
                         * Jangan rollback dua kali.
                         */

                        if (
                            existingOrder.status ===
                            "CANCELLED" &&
                            existingOrder.paymentStatus ===
                            "FAILED"
                        ) {
                            return;
                        }

                        await tx.order.update({
                            where: {
                                id:
                                    existingOrder.id,
                            },

                            data: {
                                status:
                                    "CANCELLED",

                                paymentStatus:
                                    "FAILED",
                            },
                        });

                        /*
                         * Kembalikan stock.
                         */

                        for (const item of existingOrder.items) {
                            if (item.variantId === null) {
                                throw new Error(
                                    `Variant ID tidak ditemukan untuk OrderItem ${item.id}.`
                                );
                            }

                            if (item.productId === null) {
                                throw new Error(
                                    `Product ID tidak ditemukan untuk OrderItem ${item.id}.`
                                );
                            }

                            await tx.productVariant.update({
                                where: {
                                    id: item.variantId,
                                },

                                data: {
                                    stock: {
                                        increment: item.quantity,
                                    },
                                },
                            });

                            await tx.product.update({
                                where: {
                                    id: item.productId,
                                },

                                data: {
                                    sold: {
                                        decrement: item.quantity,
                                    },
                                },
                            });
                        }

                        /*
                         * Voucher quota dikembalikan.
                         *
                         * Karena incrementVoucherUsage()
                         * sebelumnya sudah sukses.
                         */

                        const existingVoucherId =
                            existingOrder.voucherId;

                        if (
                            typeof existingVoucherId === "number"
                        ) {
                            await tx.voucher.updateMany({
                                where: {
                                    id: existingVoucherId,

                                    usedCount: {
                                        gt: 0,
                                    },
                                },

                                data: {
                                    usedCount: {
                                        decrement: 1,
                                    },
                                },
                            });
                        }
                    },
                    {
                        timeout: 15000,
                        maxWait: 10000,
                    }
                );
            } catch (
            rollbackError
            ) {
                console.error(
                    "MIDTRANS ROLLBACK ERROR:",
                    rollbackError
                );
            }

            throw midtransError;
        }

        if (!transaction?.token) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Token pembayaran Midtrans tidak ditemukan.",
                },
                { status: 500 }
            );
        }

        /*
         * ==========================================
         * RESPONSE
         * ==========================================
         */

        return NextResponse.json({
            success: true,

            message:
                "Pembayaran Midtrans berhasil dibuat.",

            data: {
                orderId:
                    result.order.id,

                orderNumber:
                    result.order
                        .orderNumber,

                token:
                    transaction.token,

                redirectUrl:
                    transaction.redirect_url,

                paymentReference:
                    result.order
                        .orderNumber,

                paymentMethod,

                subtotal:
                    result.subtotal,

                shippingCost:
                    result.shippingCost,

                discount:
                    result.discount,

                grossAmount:
                    result.grossAmount,

                mode,
            },
        });
    } catch (error: any) {
        console.error(
            "========== MIDTRANS ERROR =========="
        );

        console.error(
            "MESSAGE:",
            error?.message
        );

        console.error(
            "API RESPONSE:",
            error?.ApiResponse
        );

        const midtransMessages =
            error?.ApiResponse
                ?.error_messages;

        const message =
            Array.isArray(
                midtransMessages
            )
                ? midtransMessages.join(
                    ", "
                )
                : error?.ApiResponse
                    ?.status_message ||
                error?.message ||
                "Gagal membuat pembayaran Midtrans.";

        return NextResponse.json(
            {
                success: false,
                message,
            },
            {
                status: 500,
            }
        );
    }
}