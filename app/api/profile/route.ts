import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/profile
 *
 * Update customer profile data.
 * Currently supports: phone number.
 *
 * Security:
 * - Requires authenticated session
 * - Uses session user ID (never trusts client-sent userId)
 * - Phone must be unique across all users
 */
export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Silakan login terlebih dahulu." },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const body = await request.json();

        const updateData: Record<string, any> = {};

        /* ==========================================
         * PHONE
         * ========================================== */

        if (body.phone !== undefined) {
            const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";

            if (rawPhone === "") {
                /* Allow clearing phone */
                updateData.phone = null;
            } else {
                /* Validate phone format */
                const phoneRegex = /^[0-9+\-\s()]{8,20}$/;
                if (!phoneRegex.test(rawPhone)) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: "Format nomor telepon tidak valid. Gunakan 8-20 digit angka.",
                        },
                        { status: 400 }
                    );
                }

                /* Check uniqueness */
                const existingPhone = await prisma.user.findFirst({
                    where: {
                        phone: rawPhone,
                        id: { not: userId },
                    },
                    select: { id: true },
                });

                if (existingPhone) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: "Nomor telepon sudah digunakan oleh akun lain.",
                        },
                        { status: 409 }
                    );
                }

                updateData.phone = rawPhone;
            }
        }

        /* ==========================================
         * NOTHING TO UPDATE
         * ========================================== */

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { success: false, message: "Tidak ada data yang diperbarui." },
                { status: 400 }
            );
        }

        /* ==========================================
         * EXECUTE UPDATE
         * ========================================== */

        const updated = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
            },
        });

        return NextResponse.json({
            success: true,
            message: "Profil berhasil diperbarui.",
            data: updated,
        });
    } catch (error: any) {
        console.error("PATCH PROFILE ERROR:", error);

        /* Handle Prisma unique constraint error */
        if (error?.code === "P2002") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Nomor telepon sudah digunakan oleh akun lain.",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Gagal memperbarui profil." },
            { status: 500 }
        );
    }
}
