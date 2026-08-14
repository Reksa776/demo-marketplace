import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

function getShippingCost(
    shipping: ShippingOption
) {
    const value = Number(
        shipping.cost ??
        shipping.price ??
        shipping.shipping_cost ??
        0
    );

    return Number.isFinite(value) && value >= 0
        ? Math.round(value)
        : NaN;
}

/*
 * ==========================================
 * GET BUY NOW
 * ==========================================
 *
 * /api/buy-now?productId=1&variantId=2&quantity=1
 *
 * TIDAK membaca Cart.
 */
export async function GET(
    request: NextRequest
) {
    try {
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

        const userId = session.user.id;

        const { searchParams } =
            new URL(request.url);

        const productId = Number(
            searchParams.get("productId")
        );

        const variantId = Number(
            searchParams.get("variantId")
        );

        const quantity = Number(
            searchParams.get("quantity") ?? "1"
        );

        /*
         * ==========================================
         * VALIDATE
         * ==========================================
         */

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Produk tidak valid.",
                },
                { status: 400 }
            );
        }

        if (
            !Number.isInteger(variantId) ||
            variantId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Variant tidak valid.",
                },
                { status: 400 }
            );
        }

        if (
            !Number.isInteger(quantity) ||
            quantity <= 0
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
         * PRODUCT + VARIANT
         * ==========================================
         */

        const variant =
            await prisma.productVariant.findFirst({
                where: {
                    id: variantId,
                    productId,
                },
                include: {
                    product: true,
                },
            });

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
         * STOCK
         * ==========================================
         */

        if (quantity > variant.stock) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        `Stok ${variant.product.name} - ${variant.name} tidak mencukupi.`,
                },
                { status: 400 }
            );
        }

        /*
         * ==========================================
         * ADDRESSES
         * ==========================================
         */

        const addresses =
            await prisma.userAddress.findMany({
                where: {
                    userId,
                },
                orderBy: [
                    {
                        isDefault: "desc",
                    },
                    {
                        createdAt: "desc",
                    },
                ],
            });

        /*
         * ==========================================
         * STORE
         * ==========================================
         */

        const store =
            await prisma.storeSetting.findUnique({
                where: {
                    id: 1,
                },
                select: {
                    id: true,
                    storeName: true,
                    rajaOngkirDestinationId:
                        true,
                },
            });

        if (!store) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Data toko belum dikonfigurasi.",
                },
                { status: 500 }
            );
        }

        const storeDestination =
            Number(
                store.rajaOngkirDestinationId
            );

        if (
            !Number.isInteger(
                storeDestination
            ) ||
            storeDestination <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Destination RajaOngkir toko belum dikonfigurasi.",
                },
                { status: 500 }
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

        const weightRaw = Number(
            variant.weight
        );

        const weight =
            Number.isFinite(weightRaw) &&
            weightRaw >= 0
                ? Math.round(weightRaw)
                : 0;

        const subtotal =
            price * quantity;

        const totalWeight =
            weight * quantity;

        /*
         * ==========================================
         * RESPONSE
         * ==========================================
         */

        return NextResponse.json({
            success: true,

            data: {
                product: {
                    id: variant.product.id,
                    name: variant.product.name,
                    slug: variant.product.slug,
                    image: variant.product.image,
                },

                variant: {
                    id: variant.id,
                    name: variant.name,
                    image: variant.image,
                    price,
                    weight,
                    stock: variant.stock,
                },

                quantity,

                subtotal,

                totalWeight,

                addresses,

                store: {
                    id: store.id,
                    storeName:
                        store.storeName,
                    rajaOngkirDestinationId:
                        store.rajaOngkirDestinationId,
                },
            },
        });
    } catch (error) {
        console.error(
            "BUY NOW GET ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil data Buy Now.",
            },
            { status: 500 }
        );
    }
}

/*
 * ==========================================
 * POST BUY NOW
 * ==========================================
 *
 * Dipakai untuk COD.
 *
 * Midtrans non-COD dibuat melalui
 * /api/payment/midtrans.
 */
export async function POST(
    request: NextRequest
) {
    try {
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

        const userId = session.user.id;

        const body =
            await request.json();

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

        /*
         * ==========================================
         * PAYMENT
         * ==========================================
         */

        if (
            paymentMethod !== "COD"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Pembayaran non-COD untuk Buy Now harus dibuat melalui API Midtrans.",
                },
                { status: 400 }
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

        const shippingCost =
            getShippingCost(shipping);

        if (!Number.isFinite(shippingCost)) {
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
         * PRODUCT + VARIANT
         * ==========================================
         */

        const variant =
            await prisma.productVariant.findFirst({
                where: {
                    id: parsedVariantId,
                    productId:
                        parsedProductId,
                },
                include: {
                    product: true,
                },
            });

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
         * STOCK
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
                { status: 400 }
            );
        }

        /*
         * ==========================================
         * TOTAL
         * ==========================================
         */

        const price = Math.round(
            Number(variant.price)
        );

        const subtotal =
            price * parsedQuantity;

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
         * CREATE ORDER
         * ==========================================
         *
         * BUY NOW:
         *
         * - membuat order
         * - mengurangi stock
         * - menambah sold
         * - TIDAK menyentuh Cart
         */

        const result =
            await prisma.$transaction(
                async (tx) => {
                    /*
                     * Re-check stock
                     * di dalam transaction.
                     */

                    const freshVariant =
                        await tx.productVariant.findUnique(
                            {
                                where: {
                                    id:
                                        parsedVariantId,
                                },
                            }
                        );

                    if (
                        !freshVariant ||
                        freshVariant.stock <
                            parsedQuantity
                    ) {
                        throw new Error(
                            "Stok produk sudah tidak mencukupi."
                        );
                    }

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

                                    paymentMethod:
                                        "COD",

                                    paymentStatus:
                                        "UNPAID",

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
                                                    parsedQuantity,

                                                subtotal:
                                                    price *
                                                    parsedQuantity,
                                            },
                                        ],
                                    },
                                },

                                include: {
                                    items: true,
                                },
                            }
                        );

                    /*
                     * Kurangi stock.
                     */

                    await tx.productVariant.update(
                        {
                            where: {
                                id:
                                    variant.id,
                            },

                            data: {
                                stock: {
                                    decrement:
                                        parsedQuantity,
                                },
                            },
                        }
                    );

                    /*
                     * Tambah sold.
                     */

                    await tx.product.update(
                        {
                            where: {
                                id:
                                    variant.productId,
                            },

                            data: {
                                sold: {
                                    increment:
                                        parsedQuantity,
                                },
                            },
                        }
                    );

                    return order;
                }
            );

        return NextResponse.json({
            success: true,

            message:
                "Pesanan Buy Now berhasil dibuat.",

            data: result,
        });
    } catch (error) {
        console.error(
            "BUY NOW POST ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    error instanceof Error
                        ? error.message
                        : "Gagal membuat pesanan Buy Now.",
            },
            { status: 500 }
        );
    }
}