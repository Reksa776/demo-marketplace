import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
    getFlashSale,
    updateFlashSale,
    deleteFlashSale,
} from "@/lib/marketing/flash-sale";
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
// HELPER: parse ID param
// ==========================================

function parseId(raw: string): number | null {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// ==========================================
// GET /api/admin/flash-sales/[id]
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
                { success: false, message: "ID flash sale tidak valid." },
                { status: 400 }
            );
        }

        const flashSale = await getFlashSale(id);

        return NextResponse.json({
            success: true,
            data: {
                id: flashSale.id,
                name: flashSale.name,
                productId: flashSale.productId,
                variantId: flashSale.variantId,
                salePrice: Number(flashSale.salePrice),
                saleStock: flashSale.saleStock,
                soldCount: flashSale.soldCount,
                purchaseLimit: flashSale.purchaseLimit,
                startAt: flashSale.startAt.toISOString(),
                endAt: flashSale.endAt.toISOString(),
                isActive: flashSale.isActive,
                createdAt: flashSale.createdAt.toISOString(),
                updatedAt: flashSale.updatedAt.toISOString(),
                product: flashSale.product,
                variant: flashSale.variant
                    ? {
                          ...flashSale.variant,
                          price: Number(flashSale.variant.price),
                      }
                    : null,
            },
        });
    } catch (error: any) {
        if (error instanceof MarketingError) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: error.statusCode }
            );
        }
        console.error("GET FLASH SALE ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal mengambil data flash sale." },
            { status: 500 }
        );
    }
}

// ==========================================
// PATCH /api/admin/flash-sales/[id]
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
                { success: false, message: "ID flash sale tidak valid." },
                { status: 400 }
            );
        }

        // Load existing flash sale for effective-state validation
        const existing = await getFlashSale(id);

        const body = await request.json();

        const updateData: Record<string, any> = {};

        // --- name ---
        if (body.name !== undefined) {
            if (typeof body.name !== "string" || !body.name.trim()) {
                return NextResponse.json(
                    { success: false, message: "Nama flash sale tidak valid." },
                    { status: 400 }
                );
            }
            updateData.name = body.name.trim();
        }

        // --- salePrice ---
        if (body.salePrice !== undefined) {
            if (body.salePrice === null || body.salePrice === "") {
                return NextResponse.json(
                    { success: false, message: "Harga flash sale tidak boleh kosong." },
                    { status: 400 }
                );
            }
            const sp = Number(body.salePrice);
            if (!Number.isFinite(sp) || sp <= 0) {
                return NextResponse.json(
                    { success: false, message: "Harga flash sale harus lebih dari 0." },
                    { status: 400 }
                );
            }
            updateData.salePrice = sp;
        }

        // --- saleStock ---
        // SAFETY GUARD: the service does NOT validate saleStock against soldCount.
        // We enforce at API level: saleStock must not go below soldCount.
        if (body.saleStock !== undefined) {
            if (body.saleStock === null || body.saleStock === "") {
                return NextResponse.json(
                    { success: false, message: "Stok flash sale tidak boleh kosong." },
                    { status: 400 }
                );
            }
            const ss = Number(body.saleStock);
            if (!Number.isInteger(ss) || ss <= 0) {
                return NextResponse.json(
                    { success: false, message: "Stok flash sale harus berupa bilangan bulat lebih dari 0." },
                    { status: 400 }
                );
            }
            if (ss < existing.soldCount) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Stok flash sale tidak boleh kurang dari ${existing.soldCount} unit yang sudah terjual.`,
                    },
                    { status: 400 }
                );
            }
            updateData.saleStock = ss;
        }

        // --- purchaseLimit ---
        if (body.purchaseLimit !== undefined) {
            if (body.purchaseLimit === null || body.purchaseLimit === "") {
                updateData.purchaseLimit = null;
            } else {
                const pl = Number(body.purchaseLimit);
                if (!Number.isInteger(pl) || pl < 1) {
                    return NextResponse.json(
                        { success: false, message: "Batas pembelian harus minimal 1." },
                        { status: 400 }
                    );
                }
                updateData.purchaseLimit = pl;
            }
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
        const updated = await updateFlashSale(id, updateData);

        return NextResponse.json({
            success: true,
            data: {
                id: updated.id,
                name: updated.name,
                productId: updated.productId,
                variantId: updated.variantId,
                salePrice: Number(updated.salePrice),
                saleStock: updated.saleStock,
                soldCount: updated.soldCount,
                purchaseLimit: updated.purchaseLimit,
                startAt: updated.startAt.toISOString(),
                endAt: updated.endAt.toISOString(),
                isActive: updated.isActive,
                createdAt: updated.createdAt.toISOString(),
                updatedAt: updated.updatedAt.toISOString(),
                product: updated.product,
                variant: updated.variant
                    ? {
                          ...updated.variant,
                          price: Number(updated.variant.price),
                      }
                    : null,
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
        if (msg.includes("Harga flash sale harus lebih dari 0")) {
            return NextResponse.json(
                { success: false, message: "Harga flash sale harus lebih dari 0." },
                { status: 400 }
            );
        }

        console.error("UPDATE FLASH SALE ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal memperbarui flash sale." },
            { status: 500 }
        );
    }
}

// ==========================================
// DELETE /api/admin/flash-sales/[id]
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
                { success: false, message: "ID flash sale tidak valid." },
                { status: 400 }
            );
        }

        await deleteFlashSale(id);

        return NextResponse.json({
            success: true,
            message: "Flash sale berhasil dihapus.",
        });
    } catch (error: any) {
        if (error instanceof MarketingError) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: error.statusCode }
            );
        }
        console.error("DELETE FLASH SALE ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal menghapus flash sale." },
            { status: 500 }
        );
    }
}
