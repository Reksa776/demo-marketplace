import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
    createPromotion,
    listPromotions,
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
// GET /api/admin/promotions
// ==========================================

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAdmin();
        if (authResult.error) return authResult.error;

        const { searchParams } = new URL(request.url);

        // --- Pagination ---
        const rawPage = Number(searchParams.get("page") ?? "1");
        const rawLimit = Number(searchParams.get("limit") ?? "20");

        const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
        const limit =
            Number.isInteger(rawLimit) && rawLimit > 0 && rawLimit <= 100
                ? rawLimit
                : 20;
        const offset = (page - 1) * limit;

        // --- Filters ---
        const rawIsActive = searchParams.get("isActive");
        const isActive =
            rawIsActive === "true"
                ? true
                : rawIsActive === "false"
                    ? false
                    : undefined;

        const rawPlacement = searchParams.get("placement");
        const placement =
            rawPlacement && isValidPlacement(rawPlacement)
                ? rawPlacement
                : undefined;

        const rawSearch = searchParams.get("search");
        const search = rawSearch && rawSearch.trim() ? rawSearch.trim() : undefined;

        // --- Query ---
        const { promotions, total } = await listPromotions({
            placement,
            isActive,
            search,
            limit,
            offset,
        });

        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            success: true,
            data: {
                items: promotions.map((p) => ({
                    id: p.id,
                    title: p.title,
                    imageUrl: p.imageUrl,
                    link: p.link,
                    placement: p.placement,
                    priority: p.priority,
                    isActive: p.isActive,
                    startAt: p.startAt ? p.startAt.toISOString() : null,
                    endAt: p.endAt ? p.endAt.toISOString() : null,
                    createdAt: p.createdAt.toISOString(),
                    updatedAt: p.updatedAt.toISOString(),
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                },
            },
        });
    } catch (error) {
        console.error("LIST PROMOTIONS ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal mengambil data promosi." },
            { status: 500 }
        );
    }
}

// ==========================================
// POST /api/admin/promotions
// ==========================================

export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAdmin();
        if (authResult.error) return authResult.error;

        const body = await request.json();

        // --- title ---
        if (typeof body.title !== "string" || !body.title.trim()) {
            return NextResponse.json(
                { success: false, message: "Judul promosi wajib diisi." },
                { status: 400 }
            );
        }
        const title = body.title.trim();

        // --- imageUrl ---
        if (typeof body.imageUrl !== "string" || !body.imageUrl.trim()) {
            return NextResponse.json(
                { success: false, message: "URL gambar wajib diisi." },
                { status: 400 }
            );
        }
        const imageUrl = body.imageUrl.trim();

        // --- link ---
        let link: string | null = null;
        if (body.link !== undefined && body.link !== null) {
            if (typeof body.link === "string" && body.link.trim()) {
                link = body.link.trim();
            }
        }

        // --- placement ---
        let placement: ValidPlacement = "HOMEPAGE";
        if (body.placement !== undefined && body.placement !== null) {
            if (!isValidPlacement(body.placement)) {
                return NextResponse.json(
                    { success: false, message: "Penempatan tidak valid." },
                    { status: 400 }
                );
            }
            placement = body.placement;
        }

        // --- priority ---
        let priority = 0;
        if (body.priority !== undefined && body.priority !== null) {
            priority = Number(body.priority);
            if (!Number.isFinite(priority) || !Number.isInteger(priority) || priority < 0) {
                return NextResponse.json(
                    { success: false, message: "Prioritas tidak valid." },
                    { status: 400 }
                );
            }
        }

        // --- isActive ---
        let isActive = true;
        if (body.isActive !== undefined && body.isActive !== null) {
            if (typeof body.isActive !== "boolean") {
                return NextResponse.json(
                    { success: false, message: "Status aktif harus berupa boolean." },
                    { status: 400 }
                );
            }
            isActive = body.isActive;
        }

        // --- startAt ---
        let startAt: Date | null = null;
        if (body.startAt !== undefined && body.startAt !== null) {
            if (typeof body.startAt === "string" && body.startAt.trim()) {
                startAt = new Date(body.startAt);
                if (isNaN(startAt.getTime())) {
                    return NextResponse.json(
                        { success: false, message: "Tanggal mulai tidak valid." },
                        { status: 400 }
                    );
                }
            } else if (body.startAt !== null) {
                return NextResponse.json(
                    { success: false, message: "Tanggal mulai tidak valid." },
                    { status: 400 }
                );
            }
        }

        // --- endAt ---
        let endAt: Date | null = null;
        if (body.endAt !== undefined && body.endAt !== null) {
            if (typeof body.endAt === "string" && body.endAt.trim()) {
                endAt = new Date(body.endAt);
                if (isNaN(endAt.getTime())) {
                    return NextResponse.json(
                        { success: false, message: "Tanggal berakhir tidak valid." },
                        { status: 400 }
                    );
                }
            } else if (body.endAt !== null) {
                return NextResponse.json(
                    { success: false, message: "Tanggal berakhir tidak valid." },
                    { status: 400 }
                );
            }
        }

        // --- effective date validation ---
        if (startAt && endAt && endAt <= startAt) {
            return NextResponse.json(
                { success: false, message: "Tanggal berakhir harus setelah tanggal mulai." },
                { status: 400 }
            );
        }

        // --- Create ---
        const promotion = await createPromotion({
            title,
            imageUrl,
            link,
            placement,
            priority,
            isActive,
            startAt,
            endAt,
        });

        return NextResponse.json(
            {
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
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("CREATE PROMOTION ERROR:", error);

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

        return NextResponse.json(
            { success: false, message: "Gagal membuat promosi." },
            { status: 500 }
        );
    }
}
