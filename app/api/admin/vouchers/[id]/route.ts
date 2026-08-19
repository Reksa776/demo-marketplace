import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
    const session = await auth();

    if (!session?.user?.id) {
        return {
            error: NextResponse.json(
                { success: false, message: "Silakan login terlebih dahulu." },
                { status: 401 }
            ),
        };
    }

    if (session.user.role !== "ADMIN") {
        return {
            error: NextResponse.json(
                { success: false, message: "Akses ditolak." },
                { status: 403 }
            ),
        };
    }

    return { session };
}

/*
 * ==========================================
 * PATCH /api/admin/vouchers/:id
 * ==========================================
 *
 * Dipakai untuk edit voucher DAN untuk
 * toggle isActive (partial update).
 */

export async function PATCH(
    request: Request,
    {
        params,
    }: {
        params: Promise<{ id: string }>;
    }
) {
    try {
        const auth = await requireAdmin();

        if (auth.error) {
            return auth.error;
        }

        const { id: rawId } = await params;

        const id = Number(rawId);

        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "ID voucher tidak valid.",
                },
                { status: 400 }
            );
        }

        const existing = await prisma.voucher.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Voucher tidak ditemukan.",
                },
                { status: 404 }
            );
        }

        const body = await request.json();

        const data: Record<string, any> = {};

        if (body.description !== undefined) {
            data.description = body.description || null;
        }

        if (body.type !== undefined) {
            if (
                body.type !== "PERCENTAGE" &&
                body.type !== "FIXED"
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Tipe voucher tidak valid.",
                    },
                    { status: 400 }
                );
            }

            data.type = body.type;
        }

        if (body.value !== undefined) {
            const numericValue = Number(body.value);

            if (
                !Number.isFinite(numericValue) ||
                numericValue <= 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Nilai voucher tidak valid.",
                    },
                    { status: 400 }
                );
            }

            data.value = numericValue;
        }

        if (body.maxDiscount !== undefined) {
            data.maxDiscount = body.maxDiscount
                ? Number(body.maxDiscount)
                : null;
        }

        if (body.minPurchase !== undefined) {
            data.minPurchase = body.minPurchase
                ? Number(body.minPurchase)
                : null;
        }

        if (body.quota !== undefined) {
            const quota = body.quota
                ? Number(body.quota)
                : null;

            if (
                quota !== null &&
                quota < existing.usedCount
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Quota tidak boleh lebih kecil dari ${existing.usedCount}.`,
                    },
                    { status: 400 }
                );
            }

            data.quota = quota;
        }

        if (body.isActive !== undefined) {
            data.isActive = Boolean(body.isActive);
        }

        if (body.startDate !== undefined) {
            data.startDate = body.startDate
                ? new Date(body.startDate)
                : null;
        }

        if (body.endDate !== undefined) {
            data.endDate = body.endDate
                ? new Date(body.endDate)
                : null;
        }

        if (
            data.startDate &&
            data.endDate &&
            data.endDate < data.startDate
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Tanggal berakhir tidak boleh sebelum tanggal mulai.",
                },
                { status: 400 }
            );
        }

        const voucher = await prisma.voucher.update({
            where: { id },
            data,
        });

        return NextResponse.json({
            success: true,
            data: voucher,
        });
    } catch (error) {
        console.error(
            "UPDATE VOUCHER ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengubah voucher.",
            },
            { status: 500 }
        );
    }
}

/*
 * ==========================================
 * DELETE /api/admin/vouchers/:id
 * ==========================================
 */

export async function DELETE(
    request: Request,
    {
        params,
    }: {
        params: Promise<{ id: string }>;
    }
) {
    try {
        const auth = await requireAdmin();
        if (auth.error) return auth.error;

        const { id: rawId } = await params;

        const id = Number(rawId);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json(
                { success: false, message: "ID voucher tidak valid." },
                { status: 400 }
            );
        }

        const existing = await prisma.voucher.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json(
                { success: false, message: "Voucher tidak ditemukan." },
                { status: 404 }
            );
        }

        /*
         * Konsisten dengan validasi di frontend:
         * voucher yang sudah pernah dipakai TIDAK
         * boleh dihapus (integritas riwayat order).
         */

        if (existing.usedCount > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Voucher ini sudah pernah digunakan dan tidak bisa dihapus. Nonaktifkan saja.",
                },
                { status: 400 }
            );
        }

        await prisma.voucher.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error("DELETE VOUCHER ERROR:", error);

        return NextResponse.json(
            { success: false, message: "Gagal menghapus voucher." },
            { status: 500 }
        );
    }
}