import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = {
    params: Promise<{
        itemId: string;
    }>;
};

export async function PATCH(
    request: Request,
    { params }: Params
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    message:
                        "Silakan login terlebih dahulu.",
                },
                {
                    status: 401,
                }
            );
        }

        const { itemId } =
            await params;

        const id = Number(itemId);

        const body =
            await request.json();

        const quantity = Number(
            body.quantity
        );

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {
            return NextResponse.json(
                {
                    message:
                        "Item tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !Number.isInteger(
                quantity
            ) ||
            quantity <= 0
        ) {
            return NextResponse.json(
                {
                    message:
                        "Quantity tidak valid.",
                },
                {
                    status: 400,
                }
            );
        }

        const item =
            await prisma.cartItem.findFirst(
                {
                    where: {
                        id,

                        cart: {
                            userId:
                                session.user.id,
                        },
                    },

                    include: {
                        variant: true,
                    },
                }
            );

        if (!item) {
            return NextResponse.json(
                {
                    message:
                        "Item keranjang tidak ditemukan.",
                },
                {
                    status: 404,
                }
            );
        }

        if (
            quantity >
            item.variant.stock
        ) {
            return NextResponse.json(
                {
                    message: `Stok tersedia hanya ${item.variant.stock}.`,
                },
                {
                    status: 400,
                }
            );
        }

        await prisma.cartItem.update(
            {
                where: {
                    id: item.id,
                },

                data: {
                    quantity,
                },
            }
        );

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error(
            "UPDATE CART ERROR:",
            error
        );

        return NextResponse.json(
            {
                message:
                    "Gagal mengubah quantity.",
            },
            {
                status: 500,
            }
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: Params
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    message:
                        "Silakan login terlebih dahulu.",
                },
                {
                    status: 401,
                }
            );
        }

        const { itemId } =
            await params;

        const id = Number(itemId);

        const item =
            await prisma.cartItem.findFirst(
                {
                    where: {
                        id,

                        cart: {
                            userId:
                                session.user.id,
                        },
                    },
                }
            );

        if (!item) {
            return NextResponse.json(
                {
                    message:
                        "Item tidak ditemukan.",
                },
                {
                    status: 404,
                }
            );
        }

        await prisma.cartItem.delete({
            where: {
                id: item.id,
            },
        });

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error(
            "DELETE CART ERROR:",
            error
        );

        return NextResponse.json(
            {
                message:
                    "Gagal menghapus item.",
            },
            {
                status: 500,
            }
        );
    }
}