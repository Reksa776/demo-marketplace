import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Silakan login terlebih dahulu.",
                },
                {
                    status: 401,
                }
            );
        }

        const userId = session.user.id;

        /*
         * ==========================================
         * CART
         * ==========================================
         */

        const cart = await prisma.cart.findUnique({
            where: {
                userId,
            },
            include: {
                items: {
                    orderBy: {
                        createdAt: "asc",
                    },
                    include: {
                        product: true,
                        variant: true,
                    },
                },
            },
        });

        if (!cart || cart.items.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Keranjang kosong.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * ADDRESSES
         * ==========================================
         */

        const addresses = await prisma.userAddress.findMany({
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

        const store = await prisma.storeSetting.findUnique({
            where: {
                id: 1,
            },
            select: {
                id: true,
                storeName: true,
                rajaOngkirDestinationId: true,
            },
        });

        if (!store) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Data toko belum dikonfigurasi.",
                },
                {
                    status: 500,
                }
            );
        }

        if (
            !store.rajaOngkirDestinationId ||
            !Number.isInteger(
                Number(store.rajaOngkirDestinationId)
            ) ||
            Number(store.rajaOngkirDestinationId) <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Destination RajaOngkir toko belum dikonfigurasi.",
                },
                {
                    status: 500,
                }
            );
        }

        /*
         * ==========================================
         * ITEMS
         * ==========================================
         */

        const items = cart.items.map((item) => {
            const price = Number(item.variant.price);

            const rawWeight = Number(item.variant.weight);

            const weight =
                Number.isFinite(rawWeight) && rawWeight >= 0
                    ? Math.round(rawWeight)
                    : 0;

            const rawQuantity = Number(item.quantity);

            const quantity =
                Number.isInteger(rawQuantity) && rawQuantity > 0
                    ? rawQuantity
                    : 1;

            const subtotal = price * quantity;

            const totalWeight = weight * quantity;

            return {
                id: item.id,

                productId: item.productId,
                variantId: item.variantId,

                productName: item.product.name,
                variantName: item.variant.name,

                image:
                    item.variant.image ||
                    item.product.image ||
                    null,

                price,

                quantity,

                /*
                 * Berat satu variant dalam gram.
                 */
                weight,

                /*
                 * Berat variant x quantity.
                 */
                totalWeight,

                subtotal,
            };
        });

        /*
         * ==========================================
         * SUBTOTAL
         * ==========================================
         */

        const subtotal = items.reduce(
            (total, item) => total + item.subtotal,
            0
        );

        /*
         * ==========================================
         * TOTAL WEIGHT
         * ==========================================
         */

        const totalWeight = items.reduce(
            (total, item) => total + item.totalWeight,
            0
        );

        /*
         * ==========================================
         * RESPONSE
         * ==========================================
         */

        return NextResponse.json({
            success: true,

            data: {
                items,

                subtotal,

                /*
                 * Selalu number.
                 *
                 * Contoh:
                 * 500g x 2 = 1000g
                 * 1000g x 1 = 1000g
                 *
                 * totalWeight = 2000
                 */
                totalWeight,

                addresses,

                store: {
                    id: store.id,

                    storeName: store.storeName,

                    rajaOngkirDestinationId:
                        store.rajaOngkirDestinationId,
                },
            },
        });
    } catch (error) {
        console.error("CHECKOUT GET ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengambil data checkout.",
            },
            {
                status: 500,
            }
        );
    }
}