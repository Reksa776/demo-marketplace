import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Midtrans from "midtrans-client";

/*
 * ==========================================
 * MIDTRANS SNAP
 * ==========================================
 */

const snap = new Midtrans.Snap({
    isProduction:
        process.env.MIDTRANS_IS_PRODUCTION === "true",

    serverKey:
        process.env.MIDTRANS_SERVER_KEY!,

    clientKey:
        process.env.MIDTRANS_CLIENT_KEY!,
});

/*
 * ==========================================
 * SHIPPING TYPE
 * ==========================================
 */

type ShippingOption = {
    courier?: string;
    code?: string;

    service?: string;
    service_name?: string;

    cost?: number;
    price?: number;
    shipping_cost?: number;
};

/*
 * ==========================================
 * POST
 * ==========================================
 *
 * Buy Now Midtrans
 *
 * TIDAK MEMBACA CART
 *
 * Body:
 *
 * {
 *   productId: 1,
 *   variantId: 2,
 *   quantity: 1,
 *   addressId: "...",
 *   shipping: {...},
 *   paymentMethod: "BANK_TRANSFER"
 * }
 */

export async function POST(req: Request) {
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
                {
                    status: 401,
                }
            );
        }

        const userId = session.user.id;

        /*
         * ==========================================
         * BODY
         * ==========================================
         */

        const body = await req.json();

        const {
            productId,
            variantId,
            quantity,
            addressId,
            shipping,
            paymentMethod,
        } = body;

        /*
         * ==========================================
         * PARSE PRODUCT
         * ==========================================
         */

        const parsedProductId = Number(
            productId
        );

        const parsedVariantId = Number(
            variantId
        );

        const parsedQuantity = Number(
            quantity
        );

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
                {
                    status: 400,
                }
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
                {
                    status: 400,
                }
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
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * PAYMENT METHOD
         * ==========================================
         */

        const allowedMethods = [
            "BANK_TRANSFER",
            "E_WALLET",
            "QRIS",
        ];

        if (
            !allowedMethods.includes(
                paymentMethod
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Metode pembayaran Midtrans tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * ADDRESS
         * ==========================================
         */

        if (!addressId) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Alamat pengiriman wajib dipilih.",
                },
                {
                    status: 400,
                }
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
                {
                    status: 404,
                }
            );
        }

        /*
         * ==========================================
         * SHIPPING
         * ==========================================
         */

        if (!shipping) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Layanan pengiriman wajib dipilih.",
                },
                {
                    status: 400,
                }
            );
        }

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
                {
                    status: 400,
                }
            );
        }

        const safeShippingCost =
            Math.round(shippingCost);

        /*
         * ==========================================
         * PRODUCT + VARIANT
         * ==========================================
         */

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
                {
                    status: 404,
                }
            );
        }

        /*
         * ==========================================
         * STOCK CHECK
         * ==========================================
         */

        if (
            parsedQuantity >
            variant.stock
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        `Stok ${variant.product.name} - ${variant.name} tidak mencukupi.`,
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * PRICE
         * ==========================================
         */

        const price = Math.round(
            Number(variant.price)
        );

        if (
            !Number.isFinite(price) ||
            price < 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Harga produk tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * SUBTOTAL
         * ==========================================
         */

        const subtotal =
            price * parsedQuantity;

        /*
         * ==========================================
         * GROSS AMOUNT
         * ==========================================
         */

        const grossAmount =
            subtotal +
            safeShippingCost;

        /*
         * ==========================================
         * MIDTRANS ITEM DETAILS
         * ==========================================
         */

        const itemDetails: {
            id: string;
            price: number;
            quantity: number;
            name: string;
        }[] = [];

        const fullProductName =
            `${variant.product.name} - ${variant.name}`;

        itemDetails.push({
            id:
                `PRODUCT-${variant.productId}-VARIANT-${variant.id}`,

            price,

            quantity: parsedQuantity,

            name:
                fullProductName.substring(
                    0,
                    50
                ),
        });

        /*
         * Ongkir menjadi item tersendiri.
         */

        if (
            safeShippingCost > 0
        ) {
            itemDetails.push({
                id: "SHIPPING",

                price:
                    safeShippingCost,

                quantity: 1,

                name:
                    "Biaya Pengiriman",
            });
        }

        /*
         * ==========================================
         * VALIDATE TOTAL
         * ==========================================
         */

        const itemDetailsTotal =
            itemDetails.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    item.price *
                        item.quantity,
                0
            );

        if (
            itemDetailsTotal !==
            grossAmount
        ) {
            console.error(
                "BUY NOW MIDTRANS TOTAL MISMATCH:",
                {
                    subtotal,
                    shippingCost:
                        safeShippingCost,
                    grossAmount,
                    itemDetailsTotal,
                    itemDetails,
                }
            );

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Total pembayaran tidak sesuai.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * PAYMENT REFERENCE
         * ==========================================
         */

        const paymentReference =
            `PAY-BN-${Date.now()}-${Math.floor(
                Math.random() * 10000
            )
                .toString()
                .padStart(4, "0")}`;

        /*
         * ==========================================
         * MIDTRANS PARAMETER
         * ==========================================
         */

        const parameter = {
            transaction_details: {
                order_id:
                    paymentReference,

                gross_amount:
                    grossAmount,
            },

            item_details:
                itemDetails,

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
            },

            custom_expiry: {
                expiry_duration: 1,

                unit: "hour",
            },
        };

        /*
         * ==========================================
         * LOG
         * ==========================================
         */

        console.log(
            "========== BUY NOW MIDTRANS =========="
        );

        console.log(
            "USER:",
            userId
        );

        console.log(
            "PRODUCT:",
            parsedProductId
        );

        console.log(
            "VARIANT:",
            parsedVariantId
        );

        console.log(
            "QUANTITY:",
            parsedQuantity
        );

        console.log(
            "PAYMENT REFERENCE:",
            paymentReference
        );

        console.log(
            "PAYMENT METHOD:",
            paymentMethod
        );

        console.log(
            "GROSS AMOUNT:",
            grossAmount
        );

        /*
         * ==========================================
         * CREATE MIDTRANS TRANSACTION
         * ==========================================
         */

        const transaction =
            await snap.createTransaction(
                parameter
            );

        /*
         * ==========================================
         * RESPONSE
         * ==========================================
         */

        return NextResponse.json({
            success: true,

            message:
                "Pembayaran Buy Now berhasil dibuat.",

            data: {
                token:
                    transaction.token,

                redirectUrl:
                    transaction.redirect_url,

                paymentReference,

                paymentMethod,

                grossAmount,
            },
        });
    } catch (error: any) {
        console.error(
            "========== BUY NOW MIDTRANS ERROR =========="
        );

        console.error(
            "MESSAGE:",
            error?.message
        );

        console.error(
            "API RESPONSE:",
            error?.ApiResponse
        );

        console.error(
            "RAW:",
            error
        );

        const midtransMessages =
            error?.ApiResponse
                ?.error_messages;

        return NextResponse.json(
            {
                success: false,

                message:
                    Array.isArray(
                        midtransMessages
                    )
                        ? midtransMessages.join(
                              ", "
                          )
                        : error?.ApiResponse
                              ?.status_message ||
                          error?.message ||
                          "Gagal membuat pembayaran Buy Now.",
            },
            {
                status: 500,
            }
        );
    }
}