import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
    createCampaign,
    listCampaigns,
} from "@/lib/marketing/campaign";
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

const VALID_CAMPAIGN_TYPES = [
    "GENERAL",
    "FLASH_SALE",
    "CATEGORY_DISCOUNT",
    "PRODUCT_DISCOUNT",
] as const;

const VALID_DISCOUNT_TYPES = ["PERCENTAGE", "FIXED"] as const;

type ValidCampaignType = (typeof VALID_CAMPAIGN_TYPES)[number];
type ValidDiscountType = (typeof VALID_DISCOUNT_TYPES)[number];

function isValidCampaignType(v: string): v is ValidCampaignType {
    return (VALID_CAMPAIGN_TYPES as readonly string[]).includes(v);
}

function isValidDiscountType(v: string): v is ValidDiscountType {
    return (VALID_DISCOUNT_TYPES as readonly string[]).includes(v);
}

// ==========================================
// GET /api/admin/campaigns
// ==========================================

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAdmin();
        if (authResult.error) return authResult.error;

        const { searchParams } = new URL(request.url);

        // --- Parse & validate pagination ---
        const rawPage = Number(searchParams.get("page") ?? "1");
        const rawLimit = Number(searchParams.get("limit") ?? "20");

        const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
        const limit =
            Number.isInteger(rawLimit) && rawLimit > 0 && rawLimit <= 100
                ? rawLimit
                : 20;
        const offset = (page - 1) * limit;

        // --- Parse status filter ---
        const rawStatus = searchParams.get("status");
        const status =
            rawStatus &&
            [
                "DRAFT",
                "SCHEDULED",
                "ACTIVE",
                "ENDED",
                "CANCELLED",
            ].includes(rawStatus)
                ? (rawStatus as any)
                : undefined;

        // --- Parse search ---
        const rawSearch = searchParams.get("search");
        const search = rawSearch && rawSearch.trim() ? rawSearch.trim() : undefined;

        // --- Query ---
        const { campaigns, total } = await listCampaigns({
            status,
            includeEnded: true,
            search,
            limit,
            offset,
        });

        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            success: true,
            data: {
                items: campaigns.map((c) => ({
                    id: c.id,
                    name: c.name,
                    slug: c.slug,
                    description: c.description,
                    bannerUrl: c.bannerUrl,
                    code: c.code,
                    type: c.type,
                    status: c.status,
                    startAt: c.startAt.toISOString(),
                    endAt: c.endAt.toISOString(),
                    discountType: c.discountType,
                    discountValue: c.discountValue
                        ? Number(c.discountValue)
                        : null,
                    maxDiscount: c.maxDiscount
                        ? Number(c.maxDiscount)
                        : null,
                    priority: c.priority,
                    createdAt: c.createdAt.toISOString(),
                    updatedAt: c.updatedAt.toISOString(),
                    products: c.products,
                    categories: c.categories,
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
        console.error("LIST CAMPAIGNS ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal mengambil data kampanye." },
            { status: 500 }
        );
    }
}

// ==========================================
// POST /api/admin/campaigns
// ==========================================

export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAdmin();
        if (authResult.error) return authResult.error;

        const body = await request.json();

        // --- name ---
        if (typeof body.name !== "string" || !body.name.trim()) {
            return NextResponse.json(
                { success: false, message: "Nama kampanye wajib diisi." },
                { status: 400 }
            );
        }
        const name = body.name.trim();

        // --- slug ---
        if (typeof body.slug !== "string" || !body.slug.trim()) {
            return NextResponse.json(
                { success: false, message: "Slug wajib diisi." },
                { status: 400 }
            );
        }
        const slug = body.slug.trim();

        // slug unique check
        const existingSlug = await prisma.campaign.findUnique({
            where: { slug },
        });
        if (existingSlug) {
            return NextResponse.json(
                { success: false, message: "Slug kampanye sudah digunakan." },
                { status: 409 }
            );
        }

        // --- type ---
        if (body.type && !isValidCampaignType(body.type)) {
            return NextResponse.json(
                { success: false, message: "Tipe kampanye tidak valid." },
                { status: 400 }
            );
        }
        const type = body.type ?? "GENERAL";

        // --- dates ---
        if (!body.startAt) {
            return NextResponse.json(
                { success: false, message: "Tanggal mulai wajib diisi." },
                { status: 400 }
            );
        }
        if (!body.endAt) {
            return NextResponse.json(
                { success: false, message: "Tanggal berakhir wajib diisi." },
                { status: 400 }
            );
        }
        const startAt = new Date(body.startAt);
        const endAt = new Date(body.endAt);
        if (isNaN(startAt.getTime())) {
            return NextResponse.json(
                { success: false, message: "Tanggal mulai tidak valid." },
                { status: 400 }
            );
        }
        if (isNaN(endAt.getTime())) {
            return NextResponse.json(
                { success: false, message: "Tanggal berakhir tidak valid." },
                { status: 400 }
            );
        }
        if (endAt <= startAt) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tanggal berakhir harus setelah tanggal mulai.",
                },
                { status: 400 }
            );
        }

        // --- discountType ---
        if (
            body.discountType !== undefined &&
            body.discountType !== null &&
            body.discountType !== ""
        ) {
            if (!isValidDiscountType(body.discountType)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Tipe diskon tidak valid.",
                    },
                    { status: 400 }
                );
            }
        }
        const discountType: ValidDiscountType | null =
            body.discountType || null;

        // --- discountValue ---
        let discountValue: number | null = null;
        if (body.discountValue !== undefined && body.discountValue !== null) {
            discountValue = Number(body.discountValue);
            if (!Number.isFinite(discountValue) || discountValue <= 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Nilai diskon tidak valid.",
                    },
                    { status: 400 }
                );
            }
            if (discountType === "PERCENTAGE" && discountValue > 100) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Persentase diskon tidak boleh lebih dari 100%.",
                    },
                    { status: 400 }
                );
            }
        }

        // discountType required when discountValue is set
        if (discountValue !== null && !discountType) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tipe diskon wajib diisi jika nilai diskon ditentukan.",
                },
                { status: 400 }
            );
        }

        // --- maxDiscount ---
        let maxDiscount: number | null = null;
        if (body.maxDiscount !== undefined && body.maxDiscount !== null) {
            maxDiscount = Number(body.maxDiscount);
            if (!Number.isFinite(maxDiscount) || maxDiscount <= 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Diskon maksimal tidak valid.",
                    },
                    { status: 400 }
                );
            }
        }

        // --- priority ---
        let priority = 0;
        if (body.priority !== undefined && body.priority !== null) {
            priority = Number(body.priority);
            if (!Number.isInteger(priority) || priority < 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Prioritas tidak valid.",
                    },
                    { status: 400 }
                );
            }
        }

        // --- description ---
        const description =
            typeof body.description === "string"
                ? body.description.trim() || null
                : null;

        // --- bannerUrl ---
        const bannerUrl =
            typeof body.bannerUrl === "string"
                ? body.bannerUrl.trim() || null
                : null;

        // --- code ---
        let code: string | null = null;
        if (body.code !== undefined && body.code !== null) {
            if (typeof body.code === "string" && body.code.trim()) {
                const normalizedCode = body.code.trim().toUpperCase();
                const existingCode = await prisma.campaign.findUnique({
                    where: { code: normalizedCode },
                });
                if (existingCode) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: "Kode kampanye sudah digunakan.",
                        },
                        { status: 409 }
                    );
                }
                code = normalizedCode;
            }
        }

        // --- productIds ---
        let productIds: number[] | undefined;
        if (Array.isArray(body.productIds) && body.productIds.length > 0) {
            const ids = body.productIds
                .map(Number)
                .filter((n: number) => Number.isInteger(n) && n > 0);
            if (ids.length === 0 && body.productIds.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "ID produk tidak valid.",
                    },
                    { status: 400 }
                );
            }
            // verify products exist
            const existingProducts = await prisma.product.findMany({
                where: { id: { in: ids } },
                select: { id: true },
            });
            const existingIds = new Set(existingProducts.map((p) => p.id));
            const missing = ids.filter((id: number) => !existingIds.has(id));
            if (missing.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Produk dengan ID ${missing.join(", ")} tidak ditemukan.`,
                    },
                    { status: 400 }
                );
            }
            productIds = ids;
        }

        // --- categories ---
        let categories: string[] | undefined;
        if (Array.isArray(body.categories) && body.categories.length > 0) {
            const cleaned: string[] = (body.categories as unknown[])
                .map((c: unknown) =>
                    typeof c === "string" ? c.trim() : ""
                )
                .filter((c: string) => c.length > 0);
            if (cleaned.length === 0 && body.categories.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Nama kategori tidak valid.",
                    },
                    { status: 400 }
                );
            }
            categories = [...new Set(cleaned)];
        }

        // --- Create campaign ---
        const campaign = await createCampaign({
            name,
            slug,
            description,
            bannerUrl,
            code,
            type,
            startAt,
            endAt,
            discountType,
            discountValue,
            maxDiscount,
            priority,
            productIds,
            categories,
        });

        return NextResponse.json(
            {
                success: true,
                data: {
                    id: campaign.id,
                    name: campaign.name,
                    slug: campaign.slug,
                    description: campaign.description,
                    bannerUrl: campaign.bannerUrl,
                    code: campaign.code,
                    type: campaign.type,
                    status: campaign.status,
                    startAt: campaign.startAt.toISOString(),
                    endAt: campaign.endAt.toISOString(),
                    discountType: campaign.discountType,
                    discountValue: campaign.discountValue
                        ? Number(campaign.discountValue)
                        : null,
                    maxDiscount: campaign.maxDiscount
                        ? Number(campaign.maxDiscount)
                        : null,
                    priority: campaign.priority,
                    createdAt: campaign.createdAt.toISOString(),
                    updatedAt: campaign.updatedAt.toISOString(),
                    products: campaign.products,
                    categories: campaign.categories,
                },
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("CREATE CAMPAIGN ERROR:", error);

        if (error instanceof MarketingError) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: error.statusCode }
            );
        }

        // Handle Prisma unique constraint errors
        if (error?.code === "P2002") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Data kampanye sudah ada (slug atau kode duplikat).",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Gagal membuat kampanye." },
            { status: 500 }
        );
    }
}
