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
 * POST
 * ==========================================
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
                    message: "Unauthorized.",
                },
                {
                    status: 401,
                }
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
            await req.json();

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
         * VALIDATE PRODUCT
         * ==========================================
         */

        const productIdNumber =
            Number(productId);

        const variantIdNumber =
            Number(variantId);

        const quantityNumber =
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
                        "Product tidak valid.",
                },
                {
                    status: 400,
                }
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
                        "Variant produk tidak valid.",
                },
                {
                    status: 400,
                }
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
                {
                    status: 400,
                }
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
                {
                    status: 400,
                }
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
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * VALIDATE PAYMENT
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
         * PRODUCT + VARIANT
         * ==========================================
         *
         * PENTING:
         *
         * API INI TIDAK MEMBACA CART.
         *
         * Buy Now langsung membaca:
         *
         * productId
         * variantId
         * quantity
         */

        const variant =
            await prisma.productVariant.findFirst(
                {
                    where: {
                        id: variantIdNumber,

                        productId:
                            productIdNumber,
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
         * VALIDATE STOCK
         * ==========================================
         */

        if (
            quantityNumber >
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

        const subtotal =
            price *
            quantityNumber;

        /*
         * ==========================================
         * ADDRESS
         * ==========================================
         */

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
         * SHIPPING COST
         * ==========================================
         */

        const shippingCost =
            Number(
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
            Math.round(
                shippingCost
            );

        /*
         * ==========================================
         * TOTAL
         * ==========================================
         */

        const grossAmount =
            subtotal +
            safeShippingCost;

        if (
            !Number.isInteger(
                grossAmount
            ) ||
            grossAmount <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Total pembayaran tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * ITEM DETAILS
         * ==========================================
         */

        const fullProductName =
            `${variant.product.name} - ${variant.name}`;

        const itemDetails = [
            {
                id:
                    `PRODUCT-${productIdNumber}-VARIANT-${variantIdNumber}`,

                price,

                quantity:
                    quantityNumber,

                name:
                    fullProductName.substring(
                        0,
                        50
                    ),
            },
        ];

        /*
         * ==========================================
         * SHIPPING ITEM
         * ==========================================
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
         * VALIDATE MIDTRANS TOTAL
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
                order_id: paymentReference,
                gross_amount: grossAmount,
            },

            item_details: itemDetails,

            customer_details: {
                first_name: address.recipientName.substring(0, 50),
                phone: address.phone.substring(0, 20),
            },

            callbacks: {
                finish: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/payment-finish`,
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
            productIdNumber
        );

        console.log(
            "VARIANT:",
            variantIdNumber
        );

        console.log(
            "QUANTITY:",
            quantityNumber
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
            "SUBTOTAL:",
            subtotal
        );

        console.log(
            "SHIPPING:",
            safeShippingCost
        );

        console.log(
            "GROSS AMOUNT:",
            grossAmount
        );

        console.log(
            "MIDTRANS PARAMETER:",
            JSON.stringify(
                parameter,
                null,
                2
            )
        );

        /*
         * ==========================================
         * CREATE SNAP TRANSACTION
         * ==========================================
         */

        const transaction =
            await snap.createTransaction(
                parameter
            );

        /*
         * ==========================================
         * LOG MIDTRANS
         * ==========================================
         */

        console.log(
            "MIDTRANS RESPONSE:",
            transaction
        );

        /*
         * ==========================================
         * VALIDATE TOKEN
         * ==========================================
         */

        if (!transaction?.token) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Token pembayaran Midtrans tidak ditemukan.",
                },
                {
                    status: 500,
                }
            );
        }

        /*
         * ==========================================
         * RESPONSE
         * ==========================================
         *
         * redirectUrl sengaja tetap dikirim
         * untuk kebutuhan debugging / fallback,
         * TAPI FRONTEND JANGAN MENGGUNAKANNYA.
         *
         * Frontend wajib menggunakan token
         * + snap.pay().
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

                productId:
                    productIdNumber,

                variantId:
                    variantIdNumber,

                quantity:
                    quantityNumber,
            },
        });
    } catch (error: any) {
        /*
         * ==========================================
         * ERROR
         * ==========================================
         */

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

        console.error(
            "============================================"
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