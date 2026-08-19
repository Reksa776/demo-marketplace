import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/*
 * ==========================================
 * GET /api/admin/vouchers
 * ==========================================
 */

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Silakan login terlebih dahulu." },
                { status: 401 }
            );
        }

        /*
         * SESUAIKAN dengan cara kamu ngecek role admin.
         * Contoh umum: session.user.role === "ADMIN"
         */
        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                { success: false, message: "Akses ditolak." },
                { status: 403 }
            );
        }

        const vouchers = await prisma.voucher.findMany({
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({
            success: true,
            data: vouchers,
        });
    } catch (error) {
        console.error("LIST VOUCHERS ERROR:", error);

        return NextResponse.json(
            { success: false, message: "Gagal mengambil data voucher." },
            { status: 500 }
        );
    }
}

/*
 * ==========================================
 * POST /api/admin/vouchers
 * ==========================================
 */

export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Silakan login terlebih dahulu." },
                { status: 401 }
            );
        }

        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                { success: false, message: "Akses ditolak." },
                { status: 403 }
            );
        }

        const body = await request.json();

        const {
            code,
            description,
            type,
            value,
            maxDiscount,
            minPurchase,
            quota,
            isActive,
            startDate,
            endDate,
        } = body;

        /*
         * ==========================================
         * VALIDASI
         * ==========================================
         */

        if (typeof code !== "string" || !code.trim()) {
            return NextResponse.json(
                { success: false, message: "Kode voucher wajib diisi." },
                { status: 400 }
            );
        }

        const normalizedCode = code.trim().toUpperCase();

        if (type !== "PERCENTAGE" && type !== "FIXED") {
            return NextResponse.json(
                { success: false, message: "Tipe voucher tidak valid." },
                { status: 400 }
            );
        }

        const numericValue = Number(value);

        if (!Number.isFinite(numericValue) || numericValue <= 0) {
            return NextResponse.json(
                { success: false, message: "Nilai voucher tidak valid." },
                { status: 400 }
            );
        }

        if (type === "PERCENTAGE" && numericValue > 100) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Persentase voucher tidak boleh lebih dari 100%.",
                },
                { status: 400 }
            );
        }

        /*
         * ==========================================
         * CEK DUPLIKAT KODE
         * ==========================================
         */

        const existing = await prisma.voucher.findUnique({
            where: { code: normalizedCode },
        });

        if (existing) {
            return NextResponse.json(
                { success: false, message: "Kode voucher sudah digunakan." },
                { status: 409 }
            );
        }

        const voucher = await prisma.voucher.create({
            data: {
                code: normalizedCode,
                description: description || null,
                type,
                value: numericValue,
                maxDiscount:
                    type === "PERCENTAGE" && maxDiscount
                        ? Number(maxDiscount)
                        : null,
                minPurchase: minPurchase ? Number(minPurchase) : null,
                quota: quota ? Number(quota) : null,
                isActive: isActive ?? true,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
            },
        });

        return NextResponse.json({
            success: true,
            data: voucher,
        });
    } catch (error) {
        console.error("CREATE VOUCHER ERROR:", error);

        return NextResponse.json(
            { success: false, message: "Gagal membuat voucher." },
            { status: 500 }
        );
    }
}