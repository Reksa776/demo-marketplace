import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/*
 * ==========================================
 * GET PAYMENT STATUS
 * ==========================================
 *
 * /api/payment/status?reference=PAY-CART-xxx
 *
 * Dipakai oleh halaman payment-finish untuk
 * polling status order sampai webhook
 * Midtrans selesai memproses.
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

        const { searchParams } =
            new URL(request.url);

        const reference =
            searchParams.get("reference");

        if (!reference) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Payment reference wajib diisi.",
                },
                { status: 400 }
            );
        }

        const order =
            await prisma.order.findFirst({
                where: {
                    orderNumber: reference,
                    userId: session.user.id,
                },

                select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    paymentStatus: true,
                    total: true,
                },
            });

        if (!order) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Order tidak ditemukan.",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: order,
        });
    } catch (error) {
        console.error(
            "PAYMENT STATUS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Gagal mengambil status pembayaran.",
            },
            { status: 500 }
        );
    }
}