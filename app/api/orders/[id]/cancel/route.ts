import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
    req: Request,
    context: {
        params: Promise<{
            id: string;
        }>;
    }
) {
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

        const { id } = await context.params;

        const orderId = Number(id);

        if (!Number.isInteger(orderId)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Order ID tidak valid.",
                },
                { status: 400 }
            );
        }

        const order =
            await prisma.order.findFirst({
                where: {
                    id: orderId,
                    userId: session.user.id,
                },
            });

        if (!order) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Order tidak ditemukan.",
                },
                { status: 404 }
            );
        }

        /*
         * Hanya order yang belum dibayar
         * yang boleh dibatalkan/dihapus.
         */

        if (
            order.paymentStatus !==
            "PENDING"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Order tidak dapat dibatalkan.",
                },
                { status: 400 }
            );
        }

        /*
         * HAPUS ORDER SEMENTARA
         */

        await prisma.order.delete({
            where: {
                id: order.id,
            },
        });

        return NextResponse.json({
            success: true,
            message:
                "Order pembayaran dibatalkan.",
        });
    } catch (error) {
        console.error(
            "CANCEL ORDER ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal membatalkan order.",
            },
            { status: 500 }
        );
    }
}