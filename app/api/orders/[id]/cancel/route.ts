import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cancelOwnPendingOrder } from "@/lib/checkout";

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

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Order ID tidak valid.",
                },
                { status: 400 }
            );
        }

        /*
         * P0 FIX (C1):
         * Soft-cancel via atomic CAS state transition.
         * The order is NEVER deleted. rollbackCheckoutOrder
         * restores stock / flash-sale reservation / voucher
         * quota and cancels the affiliate commission inside
         * the same transaction.
         */
        const result = await cancelOwnPendingOrder(
            session.user.id,
            orderId
        );

        if (!result.ok) {
            if (result.reason === "NOT_FOUND") {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Order tidak ditemukan.",
                    },
                    { status: 404 }
                );
            }

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Order tidak dapat dibatalkan.",
                },
                { status: 400 }
            );
        }

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
