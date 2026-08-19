import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { Voucher } from "@prisma/client";
import {
    incrementVoucherUsage,
    validateAndCalculateVoucher,
} from "@/lib/voucher";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

type PaymentMethod =
    | "COD"
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

type BuyNowPostBody = {
    productId: number;
    variantId: number;
    quantity: number;
    addressId: string;
    shipping: ShippingPayload;
    paymentMethod: PaymentMethod;
    voucherCode?: string | null;
};

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
    value: Prisma.Decimal | number | null | undefined
) {
    if (value === null || value === undefined) {
        return 0;
    }

    return Number(value.toString());
}

function normalizeVoucherCode(
    value: unknown
): string | null {
    if (
        typeof value !== "string"
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
    const candidates = [
        shipping.cost,
        shipping.price,
        shipping.shipping_cost,
    ];

    for (const value of candidates) {
        const number =
            Number(value);

        if (
            Number.isFinite(number) &&
            number >= 0
        ) {
            return Math.round(number);
        }
    }

    return 0;
}

function getShippingCourier(
    shipping: ShippingPayload
) {
    return (
        shipping.courier ||
        shipping.code ||
        null
    );
}

function getShippingService(
    shipping: ShippingPayload
) {
    return (
        shipping.service ||
        shipping.service_name ||
        null
    );
}

async function getCurrentUser() {
    const session =
        await auth();

    if (!session?.user?.id) {
        return null;
    }

    return session.user;
}

/*
 * ============================================================
 * GET /api/buy-now
 * ============================================================
 *
 * Dipakai oleh halaman Buy Now untuk mengambil:
 *
 * - product
 * - variant
 * - quantity
 * - subtotal
 * - totalWeight
 * - addresses
 * - store
 *
 * Harga selalu berasal dari database.
 */
export async function GET(
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

        const searchParams =
            request.nextUrl.searchParams;

        const productId =
            Number(
                searchParams.get(
                    "productId"
                )
            );

        const variantId =
            Number(
                searchParams.get(
                    "variantId"
                )
            );

        const quantity =
            Number(
                searchParams.get(
                    "quantity"
                )
            );

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {
            return jsonError(
                "Product ID tidak valid."
            );
        }

        if (
            !Number.isInteger(variantId) ||
            variantId <= 0
        ) {
            return jsonError(
                "Variant ID tidak valid."
            );
        }

        if (
            !Number.isInteger(quantity) ||
            quantity <= 0 ||
            quantity > 100
        ) {
            return jsonError(
                "Quantity tidak valid."
            );
        }

        const [
            product,
            addresses,
            store,
        ] =
            await Promise.all([
                prisma.product.findUnique({
                    where: {
                        id: productId,
                    },
                    include: {
                        variants: {
                            where: {
                                id: variantId,
                            },
                            take: 1,
                        },
                    },
                }),

                prisma.userAddress.findMany({
                    where: {
                        userId: user.id,
                    },
                    orderBy: [
                        {
                            isDefault:
                                "desc",
                        },
                        {
                            createdAt:
                                "desc",
                        },
                    ],
                }),

                prisma.storeSetting.findUnique({
                    where: {
                        id: 1,
                    },
                }),
            ]);

        if (!product) {
            return jsonError(
                "Produk tidak ditemukan.",
                404
            );
        }

        const variant =
            product.variants[0];

        if (!variant) {
            return jsonError(
                "Variant produk tidak ditemukan.",
                404
            );
        }

        const price =
            decimalToNumber(
                variant.price
            );

        const subtotal =
            price * quantity;

        const totalWeight =
            Math.max(
                1,
                Number(
                    variant.weight
                ) * quantity
            );

        if (!store) {
            return jsonError(
                "Pengaturan toko belum tersedia.",
                500
            );
        }

        return jsonSuccess({
            product: {
                id: product.id,
                name: product.name,
                slug: product.slug,
                image: product.image,
            },

            variant: {
                id: variant.id,
                name: variant.name,
                image: variant.image,
                price,
                weight:
                    variant.weight,
                stock:
                    variant.stock,
            },

            quantity,

            subtotal,

            totalWeight,

            addresses:
                addresses.map(
                    (address) => ({
                        id: address.id,
                        label:
                            address.label,
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
                        subdistrict:
                            address.subdistrict,
                        postalCode:
                            address.postalCode,
                        provinceId:
                            address.provinceId,
                        regencyId:
                            address.regencyId,
                        districtId:
                            address.districtId,
                        villageId:
                            address.villageId,
                        rajaOngkirDestinationId:
                            address.rajaOngkirDestinationId,
                        latitude:
                            address.latitude?.toString() ??
                            null,
                        longitude:
                            address.longitude?.toString() ??
                            null,
                        isDefault:
                            address.isDefault,
                    })
                ),

            store: {
                id: store.id,
                storeName:
                    store.storeName,
                rajaOngkirDestinationId:
                    store.rajaOngkirDestinationId,
            },
        });
    } catch (error) {
        console.error(
            "GET /api/buy-now ERROR:",
            error
        );

        return jsonError(
            "Gagal mengambil data Buy Now.",
            500
        );
    }
}

/*
 * ============================================================
 * POST /api/buy-now
 * ============================================================
 *
 * Khusus COD.
 *
 * Untuk payment non-COD, frontend menggunakan:
 *
 * /api/buy-now/midtrans
 */
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

        let body: BuyNowPostBody;

        try {
            body =
                await request.json();
        } catch {
            return jsonError(
                "Body request tidak valid."
            );
        }

        const productId =
            Number(body.productId);

        const variantId =
            Number(body.variantId);

        const quantity =
            Number(body.quantity);

        const addressId =
            String(
                body.addressId || ""
            );

        const paymentMethod =
            body.paymentMethod;

        const voucherCode =
            normalizeVoucherCode(
                body.voucherCode
            );

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {
            return jsonError(
                "Product ID tidak valid."
            );
        }

        if (
            !Number.isInteger(variantId) ||
            variantId <= 0
        ) {
            return jsonError(
                "Variant ID tidak valid."
            );
        }

        if (
            !Number.isInteger(quantity) ||
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
            paymentMethod !==
            "COD"
        ) {
            return jsonError(
                "Gunakan endpoint Midtrans untuk pembayaran non-COD."
            );
        }

        if (
            !body.shipping ||
            typeof body.shipping !==
            "object"
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
            getShippingCourier(
                body.shipping
            );

        const shippingService =
            getShippingService(
                body.shipping
            );

        /*
         * =====================================================
         * TRANSACTION
         * =====================================================
         *
         * Semua validasi penting dilakukan lagi di server.
         */
        const result =
            await prisma.$transaction(
                async (tx) => {
                    const variant =
                        await tx.productVariant.findUnique(
                            {
                                where: {
                                    id: variantId,
                                },
                                include: {
                                    product: true,
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
                     * Lock-like validation:
                     *
                     * updateMany dengan kondisi
                     * stock >= quantity.
                     *
                     * Ini lebih aman daripada:
                     *
                     * find -> cek stock -> update
                     *
                     * karena dua request concurrent
                     * bisa lolos bersamaan.
                     */
                    const stockUpdate =
                        await tx.productVariant.updateMany(
                            {
                                where: {
                                    id: variantId,
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

                    const price =
                        decimalToNumber(
                            variant.price
                        );

                    const subtotal =
                        price * quantity;

                    /*
                     * =================================================
                     * VOUCHER
                     * =================================================
                     */

                    let discount = 0;
                    let voucherId: number | null = null;
                    let appliedVoucherCode: string | null = null;

                    if (voucherCode) {
                        const voucherResult = await validateAndCalculateVoucher(
                            voucherCode,
                            subtotal,
                            tx
                        );

                        if (!voucherResult.valid) {
                            throw new Error(voucherResult.message);
                        }

                        voucherId = voucherResult.voucher.id;
                        appliedVoucherCode = voucherResult.voucher.code;
                        discount = voucherResult.discount;

                        const voucherUsed = await incrementVoucherUsage(tx, voucherId);

                        if (!voucherUsed) {
                            throw new Error("Kuota voucher baru saja habis. Silakan gunakan kode voucher lain.");
                        }
                    }

                    const total =
                        Math.max(
                            0,
                            subtotal -
                            discount +
                            shippingCost
                        );

                    const orderNumber =
                        `ORD-${Date.now()}-${Math.random()
                            .toString(36)
                            .slice(2, 8)
                            .toUpperCase()}`;

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
                                        "COD",

                                    paymentStatus:
                                        "UNPAID",

                                    shippingCourier,

                                    shippingService,

                                    voucherId:
                                        voucherId,

                                    voucherCode:
                                        appliedVoucherCode,

                                    latitude:
                                        address.latitude,

                                    longitude:
                                        address.longitude,

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
                                                variant.price,

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
                                    items: true,
                                },
                            }
                        );

                    /*
                     * sold hanya bertambah ketika order
                     * benar-benar dibuat.
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

        return jsonSuccess(
            {
                id:
                    result.order.id,

                orderNumber:
                    result.order.orderNumber,

                status:
                    result.order.status,

                paymentStatus:
                    result.order.paymentStatus,

                paymentMethod:
                    result.order.paymentMethod,

                subtotal:
                    result.subtotal,

                shippingCost:
                    result.shippingCost,

                discount:
                    result.discount,

                total:
                    result.total,
            },
            201
        );
    } catch (error) {
        console.error(
            "POST /api/buy-now ERROR:",
            error
        );

        const message =
            error instanceof Error
                ? error.message
                : "";

        switch (message) {
            default:
                return jsonError(message || "Gagal membuat pesanan.", 400);
        }
    }
}