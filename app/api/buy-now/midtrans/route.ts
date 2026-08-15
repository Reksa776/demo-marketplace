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
 *
 * PENTING - PERUBAHAN UTAMA:
 *
 * Order SEKARANG dibuat di sini, SEBELUM
 * Snap token dikembalikan ke client, dengan
 * status PENDING / paymentStatus PENDING.
 *
 * Ini supaya:
 *
 * 1. Order tidak hilang kalau user menutup
 *    browser saat proses bayar.
 *
 * 2. Halaman /checkout/payment-finish bisa
 *    menemukan Order-nya (sebelumnya order
 *    memang tidak pernah dibuat sama sekali).
 *
 * 3. Webhook
 *    /api/payment/midtrans/notification
 *    bisa mencari Order lewat orderNumber
 *    (= Midtrans order_id) untuk update
 *    status final (PAID / FAILED / EXPIRED).
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
         * VALIDATE PRODUCT
         * ==========================================
         */

        const productIdNumber = Number(
            productId
        );

        const variantIdNumber = Number(
            variantId
        );

        const quantityNumber = Number(
            quantity
        );

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
                        "Variant produk tidak valid.",
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
                { status: 400 }
            );
        }

        /*
         * ==========================================
         * PRODUCT + VARIANT
         * ==========================================
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
                { status: 404 }
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
                    message: `Stok ${variant.product.name} - ${variant.name} tidak mencukupi.`,
                },
                { status: 400 }
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
                { status: 400 }
            );
        }

        const subtotal =
            price * quantityNumber;

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
                { status: 404 }
            );
        }

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

        const safeShippingCost = Math.round(
            shippingCost
        );

        /*
         * ==========================================
         * TOTAL
         * ==========================================
         */

        const grossAmount =
            subtotal + safeShippingCost;

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
                { status: 400 }
            );
        }

        /*
         * ==========================================
         * ITEM DETAILS
         * ==========================================
         */

        const fullProductName = `${variant.product.name} - ${variant.name}`;

        const itemDetails = [
            {
                id: `PRODUCT-${productIdNumber}-VARIANT-${variantIdNumber}`,
                price,
                quantity: quantityNumber,
                name: fullProductName.substring(
                    0,
                    50
                ),
            },
        ];

        if (safeShippingCost > 0) {
            itemDetails.push({
                id: "SHIPPING",
                price: safeShippingCost,
                quantity: 1,
                name: "Biaya Pengiriman",
            });
        }

        const itemDetailsTotal =
            itemDetails.reduce(
                (total, item) =>
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
                    safeShippingCost,
                    grossAmount,
                    itemDetailsTotal,
                }
            );

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Total pembayaran tidak sesuai.",
                },
                { status: 400 }
            );
        }

        /*
         * ==========================================
         * ORDER NUMBER
         * ==========================================
         *
         * Dipakai juga sebagai Midtrans order_id,
         * supaya webhook bisa menemukan Order ini
         * kembali lewat orderNumber.
         */

        const orderNumber = `PAY-BN-${Date.now()}-${Math.floor(
            Math.random() * 10000
        )
            .toString()
            .padStart(4, "0")}`;

        /*
         * ==========================================
         * CREATE ORDER (STATUS: PENDING)
         * ==========================================
         *
         * Stock dikurangi SEKARANG untuk mencegah
         * overselling saat menunggu pembayaran.
         *
         * Kalau pembayaran gagal/expired, webhook
         * akan mengembalikan stock ini.
         */

        const order = await prisma.$transaction(
            async (tx) => {
                const createdOrder =
                    await tx.order.create({
                        data: {
                            userId,

                            orderNumber,

                            recipientName:
                                address.recipientName,

                            phone: address.phone,

                            address:
                                address.address,

                            province:
                                address.province,

                            city: address.city,

                            district:
                                address.district,

                            postalCode:
                                address.postalCode,

                            latitude:
                                address.latitude,

                            longitude:
                                address.longitude,

                            subtotal,

                            shippingCost:
                                safeShippingCost,

                            total: grossAmount,

                            status: "PENDING",

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
                                create: [
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
                                            quantityNumber,

                                        subtotal:
                                            price *
                                            quantityNumber,
                                    },
                                ],
                            },
                        },

                        include: {
                            items: true,
                        },
                    });

                await tx.productVariant.update({
                    where: {
                        id: variant.id,
                    },

                    data: {
                        stock: {
                            decrement:
                                quantityNumber,
                        },
                    },
                });

                await tx.product.update({
                    where: {
                        id: variant.productId,
                    },

                    data: {
                        sold: {
                            increment:
                                quantityNumber,
                        },
                    },
                });

                return createdOrder;
            },
            {
                timeout: 15000,   // 15 detik, dari default 5 detik
                maxWait: 10000,   // waktu tunggu maksimal buat dapat slot transaksi
            }
        );

        /*
         * ==========================================
         * MIDTRANS PARAMETER
         * ==========================================
         */

        const parameter = {
            transaction_details: {
                order_id: orderNumber,
                gross_amount: grossAmount,
            },

            item_details: itemDetails,

            customer_details: {
                first_name:
                    address.recipientName.substring(
                        0,
                        50
                    ),

                phone: address.phone.substring(
                    0,
                    20
                ),
            },

            callbacks: {
                finish: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/payment-finish`,
            },

            custom_expiry: {
                expiry_duration: 1,
                unit: "hour",
            },
        };

        console.log(
            "========== BUY NOW MIDTRANS =========="
        );

        console.log(
            "ORDER NUMBER:",
            orderNumber
        );

        console.log(
            "GROSS AMOUNT:",
            grossAmount
        );

        /*
         * ==========================================
         * CREATE SNAP TRANSACTION
         * ==========================================
         */

        let transaction;

        try {
            transaction =
                await snap.createTransaction(
                    parameter
                );
        } catch (midtransError) {
            /*
             * ==========================================
             * ROLLBACK KALAU MIDTRANS GAGAL
             * ==========================================
             *
             * Order sudah terlanjur dibuat + stock
             * sudah dikurangi. Karena Snap gagal
             * dibuat, batalkan order dan kembalikan
             * stock supaya tidak "nyangkut".
             */

            console.error(
                "MIDTRANS CREATE TRANSACTION GAGAL, ROLLBACK ORDER:",
                midtransError
            );

            await prisma.$transaction(
                async (tx) => {
                    await tx.order.update({
                        where: {
                            id: order.id,
                        },

                        data: {
                            status: "CANCELLED",
                            paymentStatus:
                                "FAILED",
                        },
                    });

                    await tx.productVariant.update(
                        {
                            where: {
                                id: variant.id,
                            },

                            data: {
                                stock: {
                                    increment:
                                        quantityNumber,
                                },
                            },
                        }
                    );

                    await tx.product.update({
                        where: {
                            id: variant.productId,
                        },

                        data: {
                            sold: {
                                decrement:
                                    quantityNumber,
                            },
                        },
                    });
                },
                {
                    timeout: 15000,   // 15 detik, dari default 5 detik
                    maxWait: 10000,   // waktu tunggu maksimal buat dapat slot transaksi
                }
            );

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
                "Pembayaran Buy Now berhasil dibuat.",

            data: {
                orderId: order.id,
                orderNumber,

                token: transaction.token,

                redirectUrl:
                    transaction.redirect_url,

                paymentReference: orderNumber,

                paymentMethod,

                grossAmount,

                productId: productIdNumber,
                variantId: variantIdNumber,
                quantity: quantityNumber,
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

        const midtransMessages =
            error?.ApiResponse
                ?.error_messages;

        const message = Array.isArray(
            midtransMessages
        )
            ? midtransMessages.join(", ")
            : error?.ApiResponse
                ?.status_message ||
            error?.message ||
            "Gagal membuat pembayaran Midtrans.";

        return NextResponse.json(
            {
                success: false,
                message,
            },
            { status: 500 }
        );
    }
}