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
 * MIDTRANS UNTUK CART
 *
 * PENTING - PERUBAHAN UTAMA:
 *
 * Order SEKARANG dibuat di sini, SEBELUM
 * Snap token dikembalikan ke client, dengan
 * status PENDING / UNPAID.
 *
 * Kenapa? Supaya order tidak hilang kalau
 * user menutup browser saat proses bayar.
 * Status final (PAID / FAILED / EXPIRED)
 * di-update oleh webhook
 * /api/payment/midtrans/notification,
 * bukan oleh callback di client.
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
            await request.json();

        const {
            addressId,
            shipping,
            paymentMethod,
        } = body;

        /*
         * ==========================================
         * VALIDATE ADDRESS
         * ==========================================
         */

        if (
            typeof addressId !== "string" ||
            !addressId.trim()
        ) {
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
         * GET CART
         * ==========================================
         */

        const cart =
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
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * GET ADDRESS
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
         * BUILD ITEMS + VALIDATE STOCK
         * ==========================================
         */

        let subtotal = 0;

        const itemDetails: {
            id: string;
            price: number;
            quantity: number;
            name: string;
        }[] = [];

        for (const item of cart.items) {
            const quantity = Number(
                item.quantity
            );

            if (
                !Number.isInteger(
                    quantity
                ) ||
                quantity <= 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Quantity ${item.product.name} - ${item.variant.name} tidak valid.`,
                    },
                    {
                        status: 400,
                    }
                );
            }

            if (
                quantity >
                item.variant.stock
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Stok ${item.product.name} - ${item.variant.name} tidak mencukupi.`,
                    },
                    {
                        status: 400,
                    }
                );
            }

            const price = Math.round(
                Number(item.variant.price)
            );

            if (
                !Number.isFinite(price) ||
                price < 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Harga ${item.product.name} - ${item.variant.name} tidak valid.`,
                    },
                    {
                        status: 400,
                    }
                );
            }

            subtotal += price * quantity;

            const fullName = `${item.product.name} - ${item.variant.name}`;

            itemDetails.push({
                id: `PRODUCT-${item.productId}-VARIANT-${item.variantId}`,
                price,
                quantity,
                name: fullName.substring(
                    0,
                    50
                ),
            });
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
                {
                    status: 400,
                }
            );
        }

        const safeShippingCost =
            Math.round(shippingCost);

        if (safeShippingCost > 0) {
            itemDetails.push({
                id: "SHIPPING",
                price: safeShippingCost,
                quantity: 1,
                name: "Biaya Pengiriman",
            });
        }

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
                {
                    status: 400,
                }
            );
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
                "CART MIDTRANS TOTAL MISMATCH",
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
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * ORDER NUMBER
         * ==========================================
         *
         * Dipakai juga sebagai Midtrans order_id,
         * supaya webhook bisa mencari Order ini
         * kembali lewat orderNumber.
         */

        const orderNumber = `PAY-CART-${Date.now()}-${Math.floor(
            Math.random() * 10000
        )
            .toString()
            .padStart(4, "0")}`;

        /*
         * ==========================================
         * CREATE ORDER (STATUS: PENDING)
         * ==========================================
         *
         * Dilakukan dalam transaction supaya
         * pengurangan stock + pembuatan order +
         * pengosongan cart konsisten.
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
                                create:
                                    cart.items.map(
                                        (item) => ({
                                            productId:
                                                item.productId,

                                            variantId:
                                                item.variantId,

                                            productName:
                                                item.product
                                                    .name,

                                            variantName:
                                                item.variant
                                                    .name,

                                            price: Math.round(
                                                Number(
                                                    item.variant
                                                        .price
                                                )
                                            ),

                                            quantity:
                                                item.quantity,

                                            subtotal:
                                                Math.round(
                                                    Number(
                                                        item.variant
                                                            .price
                                                    )
                                                ) *
                                                item.quantity,
                                        })
                                    ),
                            },
                        },

                        include: {
                            items: true,
                        },
                    });

                /*
                 * Kurangi stock + tambah sold
                 * SEKARANG, supaya tidak terjadi
                 * overselling saat menunggu
                 * pembayaran diselesaikan.
                 *
                 * Kalau pembayaran gagal/expired,
                 * webhook akan mengembalikan
                 * stock ini (lihat
                 * /api/payment/midtrans/notification).
                 */

                for (const item of cart.items) {
                    await tx.productVariant.update(
                        {
                            where: {
                                id: item.variantId,
                            },

                            data: {
                                stock: {
                                    decrement:
                                        item.quantity,
                                },
                            },
                        }
                    );

                    await tx.product.update({
                        where: {
                            id: item.productId,
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
                 * Kosongkan cart.
                 */

                await tx.cartItem.deleteMany({
                    where: {
                        cartId: cart.id,
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
            "========== CART MIDTRANS =========="
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
             * Order sudah terlanjur dibuat +
             * stock sudah dikurangi. Karena Snap
             * gagal dibuat, batalkan order dan
             * kembalikan stock supaya tidak
             * "nyangkut".
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

                    for (const item of order.items) {
                        await tx.productVariant.update(
                            {
                                where: {
                                    id: item.variantId,
                                },

                                data: {
                                    stock: {
                                        increment:
                                            item.quantity,
                                    },
                                },
                            }
                        );

                        await tx.product.update(
                            {
                                where: {
                                    id: item.productId,
                                },

                                data: {
                                    sold: {
                                        decrement:
                                            item.quantity,
                                    },
                                },
                            }
                        );
                    }
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
                {
                    status: 500,
                }
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
                "Pembayaran Cart berhasil dibuat.",

            data: {
                orderId: order.id,
                orderNumber,

                token: transaction.token,

                redirectUrl:
                    transaction.redirect_url,

                paymentReference: orderNumber,

                paymentMethod,

                grossAmount,
            },
        });
    } catch (error: any) {
        console.error(
            "========== CART MIDTRANS ERROR =========="
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
            {
                status: 500,
            }
        );
    }
}