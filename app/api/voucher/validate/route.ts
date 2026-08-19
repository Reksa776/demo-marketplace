import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateAndCalculateVoucher } from "@/lib/voucher";

/*
 * ==========================================
 * POST /api/voucher/validate
 * ==========================================
 *
 * Dipakai di halaman checkout (buy-now maupun
 * keranjang) buat nge-preview berapa diskon
 * yang didapat SEBELUM order dibuat.
 *
 * PENTING: endpoint ini TIDAK mengunci kuota
 * voucher. Validasi ulang WAJIB dilakukan lagi
 * di dalam transaction pembuatan order (lihat
 * lib/voucher.ts).
 */
export async function POST(request: Request) {
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

        const body = await request.json();

        const { code, subtotal } = body;

        if (typeof code !== "string" || !code.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Kode voucher wajib diisi.",
                },
                { status: 400 }
            );
        }

        const parsedSubtotal = Number(subtotal);

        if (!Number.isFinite(parsedSubtotal) || parsedSubtotal <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Subtotal tidak valid.",
                },
                { status: 400 }
            );
        }

        const result = await validateAndCalculateVoucher(
            code,
            parsedSubtotal,
            prisma
        );

        if (!result.valid) {
            return NextResponse.json(
                {
                    success: false,
                    message: result.message,
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                code: result.voucher.code,
                type: result.voucher.type,
                discount: result.discount,
            },
        });
    } catch (error) {
        console.error("VOUCHER VALIDATE ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal memvalidasi voucher.",
            },
            { status: 500 }
        );
    }
}