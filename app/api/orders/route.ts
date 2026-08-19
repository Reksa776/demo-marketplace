import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
    incrementVoucherUsage,
    validateAndCalculateVoucher,
} from "@/lib/voucher";

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

function getShippingCost(shipping: ShippingOption) {
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
 * POST /api/orders
 * ==========================================
 *
 * CART + COD
 *
 * Voucher:
 * - voucherCode dari frontend
 * - discount dihitung server
 * - quota di-increment secara atomic
 * - cart dikosongkan setelah order berhasil
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Silakan login terlebih dahulu.",
                },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        const body = await request.json();

        const {
            addressId,
            shipping,
            paymentMethod,
            voucherCode,
        } = body;

        /*
         * ==========================================
         * PAYMENT
         * ==========================================
         */

        if (paymentMethod !== "COD") {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Pembayaran non-COD harus melalui API Midtrans.",
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
            typeof addressId !== "string" ||
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
            await prisma.userAddress.findFirst({
                where: {
                    id: addressId,
                    userId,
                },
            });

        if (!address) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Alamat tidak ditemukan.",
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
         * TRANSACTION
         * ==========================================
         */

        const order =
            await prisma.$transaction(
                async (tx) => {
                    /*
                     * Ambil cart TERBARU di dalam
                     * transaction.
                     */
                    const cart =
                        await tx.cart.findUnique({
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
                        throw new Error(
                            "Keranjang kosong."
                        );
                    }

                    /*
                     * ==========================================
                     * VALIDATE STOCK + HITUNG SUBTOTAL
                     * ==========================================
                     */

                    let subtotal = 0;

                    const checkoutItems =
                        [];

                    for (const item of cart.items) {
                        const quantity =
                            Number(item.quantity);

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
                                    item.variant.price
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

                        /*
                         * Cek stock terbaru.
                         */
                        if (
                            quantity >
                            item.variant.stock
                        ) {
                            throw new Error(
                                `Stok ${item.product.name} - ${item.variant.name} tidak mencukupi.`
                            );
                        }

                        const itemSubtotal =
                            price * quantity;

                        subtotal +=
                            itemSubtotal;

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
                                itemSubtotal,
                        });
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

                        /*
                         * Atomic quota.
                         */
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

                    const total =
                        subtotal -
                        discount +
                        shippingCost;

                    if (
                        total < 0 ||
                        !Number.isInteger(total)
                    ) {
                        throw new Error(
                            "Total pesanan tidak valid."
                        );
                    }

                    /*
                     * ==========================================
                     * CREATE ORDER
                     * ==========================================
                     */

                    const createdOrder =
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
                                    address.latitude,

                                longitude:
                                    address.longitude,

                                subtotal,

                                shippingCost,

                                total,

                                discount,

                                voucherId,

                                voucherCode:
                                    appliedVoucherCode,

                                status: "PENDING",

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
                     * KURANGI STOCK
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
                            stockUpdate.count !== 1
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
                     * KOSONGKAN CART
                     * ==========================================
                     */

                    await tx.cartItem.deleteMany({
                        where: {
                            cartId: cart.id,
                        },
                    });

                    return createdOrder;
                },
                {
                    timeout: 15000,
                    maxWait: 10000,
                }
            );

        return NextResponse.json({
            success: true,

            message:
                "Pesanan berhasil dibuat.",

            data: order,
        });
    } catch (error) {
        console.error(
            "CREATE CART ORDER ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,

                message:
                    error instanceof Error
                        ? error.message
                        : "Gagal membuat pesanan.",
            },
            {
                status: 500,
            }
        );
    }
}

/*
 * ==========================================
 * GET /api/orders
 * ==========================================
 */

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
                    userId:
                        session.user.id,
                },

                orderBy: {
                    createdAt: "desc",
                },

                include: {
                    voucher: {
                        select: {
                            id: true,
                            code: true,
                            type: true,
                            value: true,
                        },
                    },

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