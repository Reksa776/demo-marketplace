import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { Voucher } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

type PaymentMethod =
    | "BANK_TRANSFER"
    | "E_WALLET"
    | "QRIS";

type ShippingPayload = {
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

type Body = {
    productId: number;
    variantId: number;
    quantity: number;
    addressId: string;
    shipping: ShippingPayload;
    paymentMethod: PaymentMethod;
    voucherCode?: string | null;
};

/*
 * Batas nama item Midtrans adalah 50 karakter.
 * Nama yang lebih panjang membuat request ditolak
 * dengan pesan "item_details Name is too long".
 */
const MIDTRANS_ITEM_NAME_MAX_LENGTH = 50;

function truncateItemName(
    name: string
) {
    if (
        name.length <=
        MIDTRANS_ITEM_NAME_MAX_LENGTH
    ) {
        return name;
    }

    return name
        .slice(
            0,
            MIDTRANS_ITEM_NAME_MAX_LENGTH
        )
        .trim();
}

function jsonError(
    message: string,
    status = 400
) {
    return NextResponse.json(
        {
            success: false,
            message,
        },
        { status }
    );
}

function jsonSuccess(
    data: unknown,
    status = 200
) {
    return NextResponse.json(
        {
            success: true,
            data,
        },
        { status }
    );
}

function decimalToNumber(
    value:
        | Prisma.Decimal
        | number
        | null
        | undefined
) {
    if (
        value === null ||
        value === undefined
    ) {
        return 0;
    }

    return Number(
        value.toString()
    );
}

function normalizeVoucherCode(
    value: unknown
) {
    if (
        typeof value !==
        "string"
    ) {
        return null;
    }

    const code =
        value.trim().toUpperCase();

    return code || null;
}

function getShippingCost(
    shipping: ShippingPayload
) {
    const values = [
        shipping.cost,
        shipping.price,
        shipping.shipping_cost,
    ];

    for (const value of values) {
        const number =
            Number(value);

        if (
            Number.isFinite(
                number
            ) &&
            number >= 0
        ) {
            return Math.round(
                number
            );
        }
    }

    return 0;
}

function getCourier(
    shipping: ShippingPayload
) {
    return (
        shipping.courier ||
        shipping.code ||
        null
    );
}

function getService(
    shipping: ShippingPayload
) {
    return (
        shipping.service ||
        shipping.service_name ||
        null
    );
}

function getMidtransBaseUrl() {
    return process.env
        .NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION ===
        "true"
        ? "https://app.midtrans.com"
        : "https://app.sandbox.midtrans.com";
}

function getEnabledPayments(
    paymentMethod: PaymentMethod
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
            return [
                "qris",
            ];

        default:
            return [];
    }
}

function createOrderNumber() {
    return `ORD-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`;
}
function getAppOrigin(request: NextRequest) {
    const envUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (envUrl && /^https?:\/\//.test(envUrl)) {
        return envUrl.replace(/\/+$/, "");
    }

    // Fallback: derive dari request headers kalau env var
    // kosong / tidak ke-inline waktu build.
    const forwardedProto =
        request.headers.get("x-forwarded-proto") || "https";

    const host =
        request.headers.get("x-forwarded-host") ||
        request.headers.get("host");

    if (!host) {
        console.error(
            "NEXT_PUBLIC_APP_URL tidak ter-set dan host tidak terdeteksi dari headers."
        );
        return "";
    }

    return `${forwardedProto}://${host}`;
}

async function getCurrentUser() {
    const session =
        await auth();

    if (!session?.user?.id) {
        return null;
    }

    return session.user;
}

export async function POST(
    request: NextRequest
) {
    try {
        const user =
            await getCurrentUser();

        if (!user) {
            return jsonError(
                "Anda harus login terlebih dahulu.",
                401
            );
        }

        const serverKey =
            process.env
                .MIDTRANS_SERVER_KEY;

        if (!serverKey) {
            console.error(
                "MIDTRANS_SERVER_KEY belum di-set."
            );

            return jsonError(
                "Konfigurasi pembayaran belum lengkap.",
                500
            );
        }

        let body: Body;

        try {
            body =
                await request.json();
        } catch {
            return jsonError(
                "Body request tidak valid."
            );
        }

        const productId =
            Number(
                body.productId
            );

        const variantId =
            Number(
                body.variantId
            );

        const quantity =
            Number(
                body.quantity
            );

        const addressId =
            String(
                body.addressId ||
                ""
            );

        const paymentMethod =
            body.paymentMethod;

        const voucherCode =
            normalizeVoucherCode(
                body.voucherCode
            );

        if (
            !Number.isInteger(
                productId
            ) ||
            productId <= 0
        ) {
            return jsonError(
                "Product ID tidak valid."
            );
        }

        if (
            !Number.isInteger(
                variantId
            ) ||
            variantId <= 0
        ) {
            return jsonError(
                "Variant ID tidak valid."
            );
        }

        if (
            !Number.isInteger(
                quantity
            ) ||
            quantity <= 0 ||
            quantity > 100
        ) {
            return jsonError(
                "Quantity tidak valid."
            );
        }

        if (!addressId) {
            return jsonError(
                "Alamat pengiriman wajib dipilih."
            );
        }

        if (
            ![
                "BANK_TRANSFER",
                "E_WALLET",
                "QRIS",
            ].includes(
                paymentMethod
            )
        ) {
            return jsonError(
                "Metode pembayaran tidak valid."
            );
        }

        if (
            !body.shipping
        ) {
            return jsonError(
                "Pengiriman wajib dipilih."
            );
        }

        const shippingCost =
            getShippingCost(
                body.shipping
            );

        const shippingCourier =
            getCourier(
                body.shipping
            );

        const shippingService =
            getService(
                body.shipping
            );

        const enabledPayments =
            getEnabledPayments(
                paymentMethod
            );

        /*
         * ========================================================
         * DATABASE TRANSACTION
         * ========================================================
         */

        const checkout =
            await prisma.$transaction(
                async (tx) => {
                    const variant =
                        await tx.productVariant.findUnique(
                            {
                                where: {
                                    id:
                                        variantId,
                                },

                                include: {
                                    product:
                                        true,
                                },
                            }
                        );

                    if (!variant) {
                        throw new Error(
                            "VARIANT_NOT_FOUND"
                        );
                    }

                    if (
                        variant.productId !==
                        productId
                    ) {
                        throw new Error(
                            "VARIANT_PRODUCT_MISMATCH"
                        );
                    }

                    /*
                     * Reserve stock.
                     */
                    const stockUpdate =
                        await tx.productVariant.updateMany(
                            {
                                where: {
                                    id:
                                        variantId,
                                    stock: {
                                        gte:
                                            quantity,
                                    },
                                },

                                data: {
                                    stock: {
                                        decrement:
                                            quantity,
                                    },
                                },
                            }
                        );

                    if (
                        stockUpdate.count !==
                        1
                    ) {
                        throw new Error(
                            "OUT_OF_STOCK"
                        );
                    }

                    const address =
                        await tx.userAddress.findFirst(
                            {
                                where: {
                                    id:
                                        addressId,

                                    userId:
                                        user.id,
                                },
                            }
                        );

                    if (!address) {
                        throw new Error(
                            "ADDRESS_NOT_FOUND"
                        );
                    }

                    if (
                        !address.rajaOngkirDestinationId
                    ) {
                        throw new Error(
                            "ADDRESS_DESTINATION_NOT_FOUND"
                        );
                    }

                    /*
                     * ================================================
                     * HARGA DIBULATKAN DI AWAL
                     * ================================================
                     *
                     * unitPrice dibulatkan sekali di sini dan
                     * dipakai konsisten untuk subtotal, discount,
                     * total, DAN item_details Midtrans.
                     *
                     * Ini mencegah "gross_amount tidak sama dengan
                     * jumlah item_details" yang terjadi kalau
                     * harga desimal dibulatkan terpisah-pisah di
                     * beberapa tempat.
                     */

                    const unitPrice =
                        Math.round(
                            decimalToNumber(
                                variant.price
                            )
                        );

                    const subtotal =
                        unitPrice *
                        quantity;

                    let discount = 0;

                    let voucher:
                        Voucher | null =
                        null;

                    /*
                     * =================================================
                     * VOUCHER
                     * =================================================
                     */

                    if (
                        voucherCode
                    ) {
                        voucher =
                            await tx.voucher.findUnique(
                                {
                                    where: {
                                        code:
                                            voucherCode,
                                    },
                                }
                            );

                        if (
                            !voucher
                        ) {
                            throw new Error(
                                "VOUCHER_NOT_FOUND"
                            );
                        }

                        const now =
                            new Date();

                        if (
                            !voucher.isActive
                        ) {
                            throw new Error(
                                "VOUCHER_INACTIVE"
                            );
                        }

                        if (
                            voucher.startDate &&
                            now < voucher.startDate
                        ) {
                            throw new Error(
                                "VOUCHER_NOT_STARTED"
                            );
                        }

                        if (
                            voucher.endDate &&
                            now > voucher.endDate
                        ) {
                            throw new Error(
                                "VOUCHER_EXPIRED"
                            );
                        }

                        if (
                            voucher.minPurchase &&
                            subtotal <
                            decimalToNumber(
                                voucher.minPurchase
                            )
                        ) {
                            throw new Error(
                                "VOUCHER_MIN_PURCHASE"
                            );
                        }

                        if (
                            voucher.quota !==
                            null &&
                            voucher.usedCount >=
                            voucher.quota
                        ) {
                            throw new Error(
                                "VOUCHER_QUOTA"
                            );
                        }

                        if (
                            voucher.type ===
                            "PERCENTAGE"
                        ) {
                            discount =
                                Math.floor(
                                    subtotal *
                                    (decimalToNumber(
                                        voucher.value
                                    ) /
                                        100)
                                );

                            if (
                                voucher.maxDiscount
                            ) {
                                discount =
                                    Math.min(
                                        discount,
                                        Math.round(
                                            decimalToNumber(
                                                voucher.maxDiscount
                                            )
                                        )
                                    );
                            }
                        } else {
                            discount =
                                Math.round(
                                    decimalToNumber(
                                        voucher.value
                                    )
                                );
                        }

                        discount =
                            Math.min(
                                Math.max(
                                    0,
                                    discount
                                ),
                                subtotal
                            );

                        const voucherUpdate =
                            await tx.voucher.updateMany(
                                {
                                    where: {
                                        id:
                                            voucher.id,

                                        isActive:
                                            true,

                                        ...(voucher.quota !==
                                            null
                                            ? {
                                                usedCount:
                                                {
                                                    lt:
                                                        voucher.quota,
                                                },
                                            }
                                            : {}),
                                    },

                                    data: {
                                        usedCount:
                                        {
                                            increment:
                                                1,
                                        },
                                    },
                                }
                            );

                        if (
                            voucherUpdate.count !==
                            1
                        ) {
                            throw new Error(
                                "VOUCHER_QUOTA"
                            );
                        }
                    }

                    /*
                     * subtotal, discount, shippingCost semua
                     * sudah bilangan bulat rupiah - total pasti
                     * bulat juga, tidak ada sisa desimal yang
                     * bisa bikin gross_amount meleset.
                     */
                    const total =
                        Math.max(
                            0,
                            subtotal -
                            discount +
                            shippingCost
                        );

                    if (
                        total <=
                        0
                    ) {
                        throw new Error(
                            "INVALID_TOTAL"
                        );
                    }

                    const orderNumber =
                        createOrderNumber();

                    const order =
                        await tx.order.create(
                            {
                                data: {
                                    userId:
                                        user.id,

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

                                    subtotal:
                                        new Prisma.Decimal(
                                            subtotal.toFixed(
                                                2
                                            )
                                        ),

                                    shippingCost:
                                        new Prisma.Decimal(
                                            shippingCost.toFixed(
                                                2
                                            )
                                        ),

                                    discount:
                                        new Prisma.Decimal(
                                            discount.toFixed(
                                                2
                                            )
                                        ),

                                    total:
                                        new Prisma.Decimal(
                                            total.toFixed(
                                                2
                                            )
                                        ),

                                    status:
                                        "PENDING",

                                    paymentMethod:
                                        paymentMethod,

                                    paymentStatus:
                                        "PENDING",

                                    shippingCourier,

                                    shippingService,

                                    voucherId:
                                        voucher?.id ??
                                        null,

                                    voucherCode:
                                        voucher?.code ??
                                        null,

                                    items: {
                                        create: {
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

                                            price:
                                                new Prisma.Decimal(
                                                    unitPrice.toFixed(
                                                        2
                                                    )
                                                ),

                                            quantity,

                                            subtotal:
                                                new Prisma.Decimal(
                                                    subtotal.toFixed(
                                                        2
                                                    )
                                                ),
                                        },
                                    },
                                },

                                include: {
                                    items:
                                        true,
                                },
                            }
                        );

                    /*
                     * Increment sold ketika order
                     * berhasil dibuat/reserve stock.
                     */
                    await tx.product.update({
                        where: {
                            id:
                                variant.productId,
                        },

                        data: {
                            sold: {
                                increment:
                                    quantity,
                            },
                        },
                    });

                    return {
                        order,
                        product:
                            variant.product,
                        variant,
                        address,
                        unitPrice,
                        subtotal,
                        shippingCost,
                        discount,
                        total,
                    };
                },
                {
                    isolationLevel:
                        Prisma.TransactionIsolationLevel.Serializable,
                }
            );

        /*
         * ========================================================
         * MIDTRANS SNAP
         * ========================================================
         */

        const snapUrl =
            `${getMidtransBaseUrl()}/snap/v1/transactions`;

        const authHeader =
            Buffer.from(
                `${serverKey}:`
            ).toString(
                "base64"
            );

        const customerName =
            checkout.address
                .recipientName;

        /*
         * ================================================
         * ITEM DETAILS
         * ================================================
         *
         * Semua price di sini sudah bilangan bulat rupiah
         * (unitPrice, shippingCost, discount), jadi jumlah
         * item_details dijamin sama persis dengan gross_amount
         * yang dihitung dari nilai yang sama - tidak dihitung
         * ulang secara terpisah.
         */

        const itemDetails = [
            {
                id:
                    `product-${checkout.variant.productId}-${checkout.variant.id}`,

                price:
                    checkout.unitPrice,

                quantity:
                    quantity,

                name:
                    truncateItemName(
                        `${checkout.product.name} - ${checkout.variant.name}`
                    ),
            },
        ];
        const appOrigin = getAppOrigin(request);

        if (!appOrigin) {
            console.error(
                "GAGAL MEMBANGUN FINISH URL: appOrigin kosong. Cek NEXT_PUBLIC_APP_URL di .env production."
            );
        }

        /*
         * Tambahkan shipping sebagai item.
         */
        if (
            checkout.shippingCost >
            0
        ) {
            itemDetails.push({
                id:
                    "SHIPPING",
                price:
                    checkout.shippingCost,
                quantity:
                    1,
                name:
                    truncateItemName(
                        `${shippingCourier || "Shipping"} ${shippingService || ""}`.trim() ||
                        "Shipping"
                    ),
            });
        }

        /*
         * Discount sebagai negative item.
         */
        if (
            checkout.discount >
            0
        ) {
            itemDetails.push({
                id:
                    "VOUCHER",
                price:
                    -checkout.discount,
                quantity:
                    1,
                name:
                    truncateItemName(
                        checkout.order
                            .voucherCode
                            ? `Voucher ${checkout.order.voucherCode}`
                            : "Discount"
                    ),
            });
        }

        /*
         * gross_amount dihitung langsung dari item_details
         * yang sama - dijamin sama persis, bukan dihitung
         * ulang dari checkout.total secara terpisah.
         */
        const grossAmount =
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
        const finishUrl = `${appOrigin}/checkout/payment-finish?payment=${encodeURIComponent(
            checkout.order.orderNumber
        )}`;

        const snapPayload = {
            transaction_details: {
                order_id:
                    checkout.order
                        .orderNumber,

                gross_amount:
                    grossAmount,
            },

            item_details:
                itemDetails,

            customer_details: {
                first_name:
                    customerName,

                phone:
                    checkout.address
                        .phone,

                shipping_address: {
                    first_name:
                        customerName,

                    phone:
                        checkout.address
                            .phone,

                    address:
                        checkout.address
                            .address,

                    city:
                        checkout.address
                            .city ||
                        "",

                    postal_code:
                        checkout.address
                            .postalCode ||
                        "",

                    country_code:
                        "IDN",
                },
            },

            enabled_payments:
                enabledPayments,

            callbacks: {
                finish:
                    finishUrl,
            },

            custom_field1:
                checkout.order
                    .id.toString(),

            custom_field2:
                checkout.order
                    .paymentMethod,

            custom_field3:
                checkout.order
                    .voucherCode ||
                "",
        };

        const snapResponse =
            await fetch(
                snapUrl,
                {
                    method: "POST",

                    headers: {
                        Accept:
                            "application/json",

                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Basic ${authHeader}`,
                    },

                    body:
                        JSON.stringify(
                            snapPayload
                        ),

                    cache:
                        "no-store",
                }
            );

        const snapText =
            await snapResponse.text();

        let snapResult: any =
            null;

        try {
            snapResult =
                JSON.parse(
                    snapText
                );
        } catch {
            console.error(
                "MIDTRANS NON JSON RESPONSE:",
                snapText
            );
        }

        if (
            !snapResponse.ok ||
            !snapResult?.token
        ) {
            console.error(
                "MIDTRANS CREATE TRANSACTION ERROR:",
                {
                    status:
                        snapResponse.status,

                    body:
                        snapResult ||
                        snapText,
                }
            );

            /*
             * Midtrans gagal membuat transaksi.
             *
             * Karena DB transaction sudah commit,
             * kita harus release stock + voucher
             * dan cancel/delete order.
             */
            await prisma.$transaction(
                async (tx) => {
                    const order =
                        await tx.order.findUnique(
                            {
                                where: {
                                    id:
                                        checkout
                                            .order
                                            .id,
                                },

                                include: {
                                    items:
                                        true,
                                },
                            }
                        );

                    if (!order) {
                        return;
                    }

                    for (const item of order.items) {
                        /*
                         * variantId/productId di OrderItem
                         * sekarang nullable (SetNull ketika
                         * produk dihapus). Untuk order yang
                         * baru saja dibuat di transaction ini,
                         * keduanya pasti masih ada - tapi TS
                         * tetap butuh narrowing eksplisit.
                         */
                        if (
                            item.variantId !==
                            null
                        ) {
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
                        }

                        if (
                            item.productId !==
                            null
                        ) {
                            await tx.product.update(
                                {
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
                                }
                            );
                        }
                    }

                    if (
                        order.voucherId
                    ) {
                        await tx.voucher.updateMany(
                            {
                                where: {
                                    id:
                                        order.voucherId,

                                    usedCount: {
                                        gt:
                                            0,
                                    },
                                },

                                data: {
                                    usedCount:
                                    {
                                        decrement:
                                            1,
                                    },
                                },
                            }
                        );
                    }

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
                }
            );

            return jsonError(
                snapResult?.error_messages?.join(
                    ", "
                ) ||
                snapResult?.status_message ||
                "Gagal membuat transaksi Midtrans.",
                502
            );
        }

        /*
         * Simpan paymentReference.
         *
         * Untuk Snap token, kita pakai order number
         * sebagai reference utama.
         */
        const paymentReference =
            checkout.order
                .orderNumber;

        await prisma.order.update({
            where: {
                id:
                    checkout.order.id,
            },

            data: {
                paymentReference,
            },
        });

        return jsonSuccess(
            {
                token:
                    snapResult.token,

                redirectUrl:
                    snapResult.redirect_url ||
                    null,

                paymentReference,

                orderId:
                    checkout.order.id,

                orderNumber:
                    checkout.order
                        .orderNumber,

                grossAmount,

                paymentMethod,
            },
            201
        );
    } catch (error) {
        console.error(
            "POST /api/buy-now/midtrans ERROR:",
            error
        );

        const message =
            error instanceof Error
                ? error.message
                : "";

        switch (message) {
            case "VARIANT_NOT_FOUND":
                return jsonError(
                    "Variant produk tidak ditemukan.",
                    404
                );

            case "VARIANT_PRODUCT_MISMATCH":
                return jsonError(
                    "Variant tidak sesuai dengan produk.",
                    400
                );

            case "OUT_OF_STOCK":
                return jsonError(
                    "Stock produk tidak mencukupi.",
                    409
                );

            case "ADDRESS_NOT_FOUND":
                return jsonError(
                    "Alamat tidak ditemukan.",
                    404
                );

            case "ADDRESS_DESTINATION_NOT_FOUND":
                return jsonError(
                    "Destination RajaOngkir alamat belum tersedia.",
                    400
                );

            case "VOUCHER_NOT_FOUND":
                return jsonError(
                    "Voucher tidak ditemukan.",
                    400
                );

            case "VOUCHER_INACTIVE":
                return jsonError(
                    "Voucher sedang tidak aktif.",
                    400
                );

            case "VOUCHER_NOT_STARTED":
                return jsonError(
                    "Voucher belum dapat digunakan.",
                    400
                );

            case "VOUCHER_EXPIRED":
                return jsonError(
                    "Voucher sudah expired.",
                    400
                );

            case "VOUCHER_MIN_PURCHASE":
                return jsonError(
                    "Minimal pembelian voucher belum terpenuhi.",
                    400
                );

            case "VOUCHER_QUOTA":
                return jsonError(
                    "Kuota voucher sudah habis.",
                    400
                );

            case "INVALID_TOTAL":
                return jsonError(
                    "Total pembayaran tidak valid.",
                    400
                );

            default:
                return jsonError(
                    "Gagal membuat pembayaran Midtrans.",
                    500
                );
        }
    }
}