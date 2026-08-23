import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
    getProductDiscount,
    updateProductDiscount,
    deleteProductDiscount,
} from "@/lib/marketing/discount";
import { MarketingError } from "@/lib/marketing/errors";

// ==========================================
// AUTH HELPER
// ==========================================

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

// ==========================================
// VALID TYPES
// ==========================================

const VALID_DISCOUNT_TYPES = ["PERCENTAGE", "FIXED"] as const;

type ValidDiscountType = (typeof VALID_DISCOUNT_TYPES)[number];

function isValidDiscountType(v: string): v is ValidDiscountType {
    return (VALID_DISCOUNT_TYPES as readonly string[]).includes(v);
}

// ==========================================
// HELPER: parse ID param
// ==========================================

function parseId(raw: string): number | null {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// ==========================================
// GET /api/admin/discounts/[id]
// ==========================================

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authResult = await requireAdmin();
        if (authResult.error) return authResult.error;

        const { id: rawId } = await params;
        const id = parseId(rawId);
        if (id === null) {
            return NextResponse.json(
                { success: false, message: "ID diskon tidak valid." },
                { status: 400 }
            );
        }

        const discount = await getProductDiscount(id);

        // Fetch related product and variant for richer response
        const product = await prisma.product.findUnique({
            where: { id: discount.productId },
            select: { id: true, name: true, slug: true, image: true },
        });

        let variant = null;
        if (discount.variantId) {
            const v = await prisma.productVariant.findUnique({
                where: { id: discount.variantId },
                select: { id: true, name: true, price: true, stock: true, image: true },
            });
            if (v) {
                variant = { ...v, price: Number(v.price) };
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                id: discount.id,
                productId: discount.productId,
                variantId: discount.variantId,
                type: discount.type,
                value: Number(discount.value),
                maxDiscount: discount.maxDiscount ? Number(discount.maxDiscount) : null,
                startAt: discount.startAt.toISOString(),
                endAt: discount.endAt.toISOString(),
                isActive: discount.isActive,
                createdAt: discount.createdAt.toISOString(),
                updatedAt: discount.updatedAt.toISOString(),
                product,
                variant,
            },
        });
    } catch (error: any) {
        if (error instanceof MarketingError) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: error.statusCode }
            );
        }
        console.error("GET DISCOUNT ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal mengambil data diskon." },
            { status: 500 }
        );
    }
}

// ==========================================
// PATCH /api/admin/discounts/[id]
// ==========================================

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authResult = await requireAdmin();
        if (authResult.error) return authResult.error;

        const { id: rawId } = await params;
        const id = parseId(rawId);
        if (id === null) {
            return NextResponse.json(
                { success: false, message: "ID diskon tidak valid." },
                { status: 400 }
            );
        }

        // Load existing to validate effective final state
        const existing = await getProductDiscount(id);

        const body = await request.json();

        const updateData: Record<string, any> = {};

        // --- type ---
        let effectiveType = existing.type;
        if (body.type !== undefined) {
            if (!isValidDiscountType(body.type)) {
                return NextResponse.json(
                    { success: false, message: "Tipe diskon tidak valid." },
                    { status: 400 }
                );
            }
            updateData.type = body.type;
            effectiveType = body.type;
        }

        // --- value ---
        let effectiveValue = Number(existing.value);
        if (body.value !== undefined) {
            if (body.value === null || body.value === "") {
                return NextResponse.json(
                    { success: false, message: "Nilai diskon tidak boleh kosong." },
                    { status: 400 }
                );
            }
            const v = Number(body.value);
            if (!Number.isFinite(v) || v <= 0) {
                return NextResponse.json(
                    { success: false, message: "Nilai diskon harus lebih dari 0." },
                    { status: 400 }
                );
            }
            if (effectiveType === "PERCENTAGE" && v > 100) {
                return NextResponse.json(
                    { success: false, message: "Persentase diskon tidak boleh lebih dari 100%." },
                    { status: 400 }
                );
            }
            updateData.value = v;
            effectiveValue = v;
        }

        // --- maxDiscount ---
        let effectiveMaxDiscount = existing.maxDiscount ? Number(existing.maxDiscount) : null;
        if (body.maxDiscount !== undefined) {
            if (body.maxDiscount === null || body.maxDiscount === "") {
                updateData.maxDiscount = null;
                effectiveMaxDiscount = null;
            } else {
                if (effectiveType !== "PERCENTAGE") {
                    return NextResponse.json(
                        { success: false, message: "Diskon maksimal hanya berlaku untuk tipe PERCENTAGE." },
                        { status: 400 }
                    );
                }
                const md = Number(body.maxDiscount);
                if (!Number.isFinite(md) || md <= 0) {
                    return NextResponse.json(
                        { success: false, message: "Diskon maksimal harus lebih dari 0." },
                        { status: 400 }
                    );
                }
                updateData.maxDiscount = md;
                effectiveMaxDiscount = md;
            }
        }
        // Reject maxDiscount on non-PERCENTAGE after type/value resolution
        if (effectiveType !== "PERCENTAGE" && effectiveMaxDiscount !== null) {
            return NextResponse.json(
                { success: false, message: "Diskon maksimal hanya berlaku untuk tipe PERCENTAGE." },
                { status: 400 }
            );
        }

        // --- startAt / endAt ---
        let effectiveStartAt = existing.startAt;
        let effectiveEndAt = existing.endAt;

        if (body.startAt !== undefined) {
            const sa = new Date(body.startAt);
            if (isNaN(sa.getTime())) {
                return NextResponse.json(
                    { success: false, message: "Tanggal mulai tidak valid." },
                    { status: 400 }
                );
            }
            updateData.startAt = sa;
            effectiveStartAt = sa;
        }

        if (body.endAt !== undefined) {
            const ea = new Date(body.endAt);
            if (isNaN(ea.getTime())) {
                return NextResponse.json(
                    { success: false, message: "Tanggal berakhir tidak valid." },
                    { status: 400 }
                );
            }
            updateData.endAt = ea;
            effectiveEndAt = ea;
        }

        if (effectiveEndAt <= effectiveStartAt) {
            return NextResponse.json(
                { success: false, message: "Tanggal berakhir harus setelah tanggal mulai." },
                { status: 400 }
            );
        }

        // --- isActive ---
        if (body.isActive !== undefined) {
            updateData.isActive = Boolean(body.isActive);
        }

        // --- Execute update ---
        const updated = await updateProductDiscount(id, updateData);

        return NextResponse.json({
            success: true,
            data: {
                id: updated.id,
                productId: updated.productId,
                variantId: updated.variantId,
                type: updated.type,
                value: Number(updated.value),
                maxDiscount: updated.maxDiscount ? Number(updated.maxDiscount) : null,
                startAt: updated.startAt.toISOString(),
                endAt: updated.endAt.toISOString(),
                isActive: updated.isActive,
                createdAt: updated.createdAt.toISOString(),
                updatedAt: updated.updatedAt.toISOString(),
            },
        });
    } catch (error: any) {
        if (error instanceof MarketingError) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: error.statusCode }
            );
        }

        const msg = error?.message ?? "";
        if (msg.includes("Tanggal berakhir harus setelah")) {
            return NextResponse.json(
                { success: false, message: "Tanggal berakhir harus setelah tanggal mulai." },
                { status: 400 }
            );
        }
        if (msg.includes("Nilai diskon harus lebih dari 0")) {
            return NextResponse.json(
                { success: false, message: "Nilai diskon harus lebih dari 0." },
                { status: 400 }
            );
        }
        if (msg.includes("Persentase diskon tidak boleh lebih dari 100%")) {
            return NextResponse.json(
                { success: false, message: "Persentase diskon tidak boleh lebih dari 100%." },
                { status: 400 }
            );
        }

        console.error("UPDATE DISCOUNT ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal memperbarui diskon." },
            { status: 500 }
        );
    }
}

// ==========================================
// DELETE /api/admin/discounts/[id]
// ==========================================

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authResult = await requireAdmin();
        if (authResult.error) return authResult.error;

        const { id: rawId } = await params;
        const id = parseId(rawId);
        if (id === null) {
            return NextResponse.json(
                { success: false, message: "ID diskon tidak valid." },
                { status: 400 }
            );
        }

        await deleteProductDiscount(id);

        return NextResponse.json({
            success: true,
            message: "Diskon berhasil dihapus.",
        });
    } catch (error: any) {
        if (error instanceof MarketingError) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: error.statusCode }
            );
        }
        console.error("DELETE DISCOUNT ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal menghapus diskon." },
            { status: 500 }
        );
    }
}
