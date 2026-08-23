import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/* ==========================================
 * PATCH /api/addresses/[id]
 * ==========================================
 *
 * Edit an address. Only the owner can edit.
 * Supports toggling isDefault.
 *
 * If isDefault is set to true, all other
 * addresses for this user are unset.
 * If the currently-default address is being
 * changed to non-default, and no other address
 * is default, the first remaining address
 * becomes default (safe fallback).
 */

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Silakan login terlebih dahulu." },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const { id } = await params;

        /* ==========================================
         * FIND ADDRESS + OWNERSHIP CHECK
         * ========================================== */

        const existing = await prisma.userAddress.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json(
                { success: false, message: "Alamat tidak ditemukan." },
                { status: 404 }
            );
        }

        if (existing.userId !== userId) {
            return NextResponse.json(
                { success: false, message: "Akses ditolak." },
                { status: 403 }
            );
        }

        /* ==========================================
         * PARSE BODY
         * ========================================== */

        const body = await request.json();

        const updateData: Record<string, any> = {};

        if (body.label !== undefined) {
            updateData.label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : null;
        }

        if (body.recipientName !== undefined) {
            if (typeof body.recipientName !== "string" || !body.recipientName.trim()) {
                return NextResponse.json(
                    { success: false, message: "Nama penerima wajib diisi." },
                    { status: 400 }
                );
            }
            updateData.recipientName = body.recipientName.trim();
        }

        if (body.phone !== undefined) {
            if (typeof body.phone !== "string" || !body.phone.trim()) {
                return NextResponse.json(
                    { success: false, message: "Nomor HP wajib diisi." },
                    { status: 400 }
                );
            }
            updateData.phone = body.phone.trim();
        }

        if (body.address !== undefined) {
            if (typeof body.address !== "string" || !body.address.trim()) {
                return NextResponse.json(
                    { success: false, message: "Alamat lengkap wajib diisi." },
                    { status: 400 }
                );
            }
            updateData.address = body.address.trim();
        }

        if (body.province !== undefined) {
            updateData.province = typeof body.province === "string" && body.province.trim() ? body.province.trim() : null;
        }

        if (body.city !== undefined) {
            updateData.city = typeof body.city === "string" && body.city.trim() ? body.city.trim() : null;
        }

        if (body.district !== undefined) {
            updateData.district = typeof body.district === "string" && body.district.trim() ? body.district.trim() : null;
        }

        if (body.subdistrict !== undefined) {
            updateData.subdistrict = typeof body.subdistrict === "string" && body.subdistrict.trim() ? body.subdistrict.trim() : null;
        }

        if (body.postalCode !== undefined) {
            updateData.postalCode = typeof body.postalCode === "string" && body.postalCode.trim() ? body.postalCode.trim() : null;
        }

        if (body.rajaOngkirDestinationId !== undefined) {
            const destId = Number(body.rajaOngkirDestinationId);
            updateData.rajaOngkirDestinationId = Number.isInteger(destId) && destId > 0 ? destId : null;
        }

        if (body.latitude !== undefined) {
            const lat = Number(body.latitude);
            updateData.latitude = Number.isFinite(lat) ? lat : null;
        }

        if (body.longitude !== undefined) {
            const lng = Number(body.longitude);
            updateData.longitude = Number.isFinite(lng) ? lng : null;
        }

        /* ==========================================
         * HANDLE isDefault
         * ==========================================
         *
         * If isDefault is explicitly set to true:
         *   1. Unset all other addresses for this user
         *   2. Set this address as default
         *
         * If isDefault is explicitly set to false:
         *   1. If this was the default, find next best default
         *   2. Set this address as non-default
         */

        if (body.isDefault === true && !existing.isDefault) {
            /* Make this the default — unset all others first */
            await prisma.userAddress.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false },
            });
            updateData.isDefault = true;
        } else if (body.isDefault === false && existing.isDefault) {
            /* Removing default status — find next best */
            const nextDefault = await prisma.userAddress.findFirst({
                where: { userId, id: { not: id } },
                orderBy: [{ createdAt: "asc" }],
                select: { id: true },
            });

            if (nextDefault) {
                /* Promote next address to default */
                await prisma.userAddress.update({
                    where: { id: nextDefault.id },
                    data: { isDefault: true },
                });
            }
            updateData.isDefault = false;
        }

        /* ==========================================
         * VALIDATE REGION IDs IF PROVIDED
         * ========================================== */

        if (body.provinceId !== undefined) {
            const pid = Number(body.provinceId);
            if (Number.isInteger(pid) && pid > 0) {
                const prov = await prisma.province.findUnique({ where: { id: pid }, select: { id: true } });
                updateData.provinceId = prov ? pid : null;
            } else {
                updateData.provinceId = null;
            }
        }

        if (body.cityId !== undefined) {
            const cid = Number(body.cityId);
            if (Number.isInteger(cid) && cid > 0) {
                const reg = await prisma.regency.findUnique({ where: { id: cid }, select: { id: true } });
                updateData.regencyId = reg ? cid : null;
            } else {
                updateData.regencyId = null;
            }
        }

        if (body.districtId !== undefined) {
            const did = Number(body.districtId);
            if (Number.isInteger(did) && did > 0) {
                const dist = await prisma.district.findUnique({ where: { id: did }, select: { id: true } });
                updateData.districtId = dist ? did : null;
            } else {
                updateData.districtId = null;
            }
        }

        if (body.villageId !== undefined) {
            const vid = Number(body.villageId);
            if (Number.isInteger(vid) && vid > 0) {
                const vil = await prisma.village.findUnique({ where: { id: vid }, select: { id: true } });
                updateData.villageId = vil ? vid : null;
            } else {
                updateData.villageId = null;
            }
        }

        /* ==========================================
         * EXECUTE UPDATE
         * ========================================== */

        const updated = await prisma.userAddress.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            message: "Alamat berhasil diperbarui.",
            data: updated,
        });
    } catch (error) {
        console.error("PATCH ADDRESS ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal memperbarui alamat." },
            { status: 500 }
        );
    }
}

/* ==========================================
 * DELETE /api/addresses/[id]
 * ==========================================
 *
 * Delete an address. Only the owner can delete.
 *
 * If the deleted address was the default:
 *   - Promote the next oldest address to default.
 *   - If no addresses remain, no default needed.
 */

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, message: "Silakan login terlebih dahulu." },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const { id } = await params;

        /* ==========================================
         * FIND ADDRESS + OWNERSHIP CHECK
         * ========================================== */

        const existing = await prisma.userAddress.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json(
                { success: false, message: "Alamat tidak ditemukan." },
                { status: 404 }
            );
        }

        if (existing.userId !== userId) {
            return NextResponse.json(
                { success: false, message: "Akses ditolak." },
                { status: 403 }
            );
        }

        /* ==========================================
         * DELETE
         * ========================================== */

        await prisma.userAddress.delete({
            where: { id },
        });

        /* ==========================================
         * DEFAULT FALLBACK
         * ==========================================
         *
         * If the deleted address was default,
         * promote the next oldest address.
         */

        if (existing.isDefault) {
            const nextDefault = await prisma.userAddress.findFirst({
                where: { userId },
                orderBy: [{ createdAt: "asc" }],
                select: { id: true },
            });

            if (nextDefault) {
                await prisma.userAddress.update({
                    where: { id: nextDefault.id },
                    data: { isDefault: true },
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: "Alamat berhasil dihapus.",
        });
    } catch (error) {
        console.error("DELETE ADDRESS ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal menghapus alamat." },
            { status: 500 }
        );
    }
}
