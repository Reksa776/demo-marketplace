import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
    getPromotion,
    updatePromotion,
    deletePromotion,
} from "@/lib/marketing/promotion";
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

const VALID_PLACEMENTS = ["HOMEPAGE", "CAMPAIGN", "CATEGORY", "PRODUCT"] as const;

type ValidPlacement = (typeof VALID_PLACEMENTS)[number];

function isValidPlacement(v: string): v is ValidPlacement {
    return (VALID_PLACEMENTS as readonly string[]).includes(v);
}

// ==========================================
// HELPER: parse ID param
// ==========================================

function parseId(raw: string): number | null {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// ==========================================
// GET /api/admin/promotions/[id]
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
                { success: false, message: "ID promosi tidak valid." },
                { status: 400 }
            );
        }

        const promotion = await getPromotion(id);

        return NextResponse.json({
            success: true,
            data: {
                id: promotion.id,
                title: promotion.title,
                imageUrl: promotion.imageUrl,
                link: promotion.link,
                placement: promotion.placement,
                priority: promotion.priority,
                isActive: promotion.isActive,
                startAt: promotion.startAt ? promotion.startAt.toISOString() : null,
                endAt: promotion.endAt ? promotion.endAt.toISOString() : null,
                createdAt: promotion.createdAt.toISOString(),
                updatedAt: promotion.updatedAt.toISOString(),
            },
        });
    } catch (error: any) {
        if (error instanceof MarketingError) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: error.statusCode }
            );
        }
        console.error("GET PROMOTION ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal mengambil data promosi." },
            { status: 500 }
        );
    }
}

// ==========================================
// PATCH /api/admin/promotions/[id]
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
                { success: false, message: "ID promosi tidak valid." },
                { status: 400 }
            );
        }

        // Load existing for effective-state validation
        const existing = await getPromotion(id);

        const body = await request.json();

        const updateData: Record<string, any> = {};

        // --- title ---
        if (body.title !== undefined) {
            if (typeof body.title !== "string" || !body.title.trim()) {
                return NextResponse.json(
                    { success: false, message: "Judul promosi tidak valid." },
                    { status: 400 }
                );
            }
            updateData.title = body.title.trim();
        }

        // --- imageUrl ---
        if (body.imageUrl !== undefined) {
            if (typeof body.imageUrl !== "string" || !body.imageUrl.trim()) {
                return NextResponse.json(
                    { success: false, message: "URL gambar tidak valid." },
                    { status: 400 }
                );
            }
            updateData.imageUrl = body.imageUrl.trim();
        }

        // --- link ---
        if (body.link !== undefined) {
            if (body.link === null) {
                updateData.link = null;
            } else if (typeof body.link === "string" && body.link.trim()) {
                updateData.link = body.link.trim();
            } else {
                updateData.link = null;
            }
        }

        // --- placement ---
        if (body.placement !== undefined) {
            if (!isValidPlacement(body.placement)) {
                return NextResponse.json(
                    { success: false, message: "Penempatan tidak valid." },
                    { status: 400 }
                );
            }
            updateData.placement = body.placement;
        }

        // --- priority ---
        if (body.priority !== undefined) {
            const p = Number(body.priority);
            if (!Number.isFinite(p) || !Number.isInteger(p) || p < 0) {
                return NextResponse.json(
                    { success: false, message: "Prioritas tidak valid." },
                    { status: 400 }
                );
            }
            updateData.priority = p;
        }

        // --- isActive ---
        if (body.isActive !== undefined) {
            if (typeof body.isActive !== "boolean") {
                return NextResponse.json(
                    { success: false, message: "Status aktif harus berupa boolean." },
                    { status: 400 }
                );
            }
            updateData.isActive = body.isActive;
        }

        // --- startAt ---
        let effectiveStartAt = existing.startAt;
        if (body.startAt !== undefined) {
            if (body.startAt === null) {
                updateData.startAt = null;
                effectiveStartAt = null;
            } else if (typeof body.startAt === "string" && body.startAt.trim()) {
                const sa = new Date(body.startAt);
                if (isNaN(sa.getTime())) {
                    return NextResponse.json(
                        { success: false, message: "Tanggal mulai tidak valid." },
                        { status: 400 }
                    );
                }
                updateData.startAt = sa;
                effectiveStartAt = sa;
            } else {
                return NextResponse.json(
                    { success: false, message: "Tanggal mulai tidak valid." },
                    { status: 400 }
                );
            }
        }

        // --- endAt ---
        let effectiveEndAt = existing.endAt;
        if (body.endAt !== undefined) {
            if (body.endAt === null) {
                updateData.endAt = null;
                effectiveEndAt = null;
            } else if (typeof body.endAt === "string" && body.endAt.trim()) {
                const ea = new Date(body.endAt);
                if (isNaN(ea.getTime())) {
                    return NextResponse.json(
                        { success: false, message: "Tanggal berakhir tidak valid." },
                        { status: 400 }
                    );
                }
                updateData.endAt = ea;
                effectiveEndAt = ea;
            } else {
                return NextResponse.json(
                    { success: false, message: "Tanggal berakhir tidak valid." },
                    { status: 400 }
                );
            }
        }

        // --- effective date validation ---
        if (effectiveStartAt && effectiveEndAt && effectiveEndAt <= effectiveStartAt) {
            return NextResponse.json(
                { success: false, message: "Tanggal berakhir harus setelah tanggal mulai." },
                { status: 400 }
            );
        }

        // --- Execute update ---
        const updated = await updatePromotion(id, updateData);

        return NextResponse.json({
            success: true,
            data: {
                id: updated.id,
                title: updated.title,
                imageUrl: updated.imageUrl,
                link: updated.link,
                placement: updated.placement,
                priority: updated.priority,
                isActive: updated.isActive,
                startAt: updated.startAt ? updated.startAt.toISOString() : null,
                endAt: updated.endAt ? updated.endAt.toISOString() : null,
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

        console.error("UPDATE PROMOTION ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal memperbarui promosi." },
            { status: 500 }
        );
    }
}

// ==========================================
// DELETE /api/admin/promotions/[id]
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
                { success: false, message: "ID promosi tidak valid." },
                { status: 400 }
            );
        }

        await deletePromotion(id);

        return NextResponse.json({
            success: true,
            message: "Promosi berhasil dihapus.",
        });
    } catch (error: any) {
        if (error instanceof MarketingError) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: error.statusCode }
            );
        }
        console.error("DELETE PROMOTION ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal menghapus promosi." },
            { status: 500 }
        );
    }
}
