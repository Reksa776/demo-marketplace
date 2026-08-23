import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
    getCampaignById,
    updateCampaign,
    deleteCampaign,
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
// HELPER: serialize campaign
// ==========================================

function serializeCampaign(c: any) {
    return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        bannerUrl: c.bannerUrl,
        code: c.code,
        type: c.type,
        status: c.status,
        startAt: c.startAt instanceof Date
            ? c.startAt.toISOString()
            : c.startAt,
        endAt: c.endAt instanceof Date
            ? c.endAt.toISOString()
            : c.endAt,
        discountType: c.discountType,
        discountValue: c.discountValue ? Number(c.discountValue) : null,
        maxDiscount: c.maxDiscount ? Number(c.maxDiscount) : null,
        priority: c.priority,
        createdAt: c.createdAt instanceof Date
            ? c.createdAt.toISOString()
            : c.createdAt,
        updatedAt: c.updatedAt instanceof Date
            ? c.updatedAt.toISOString()
            : c.updatedAt,
        products: c.products ?? [],
        categories: c.categories ?? [],
    };
}

// ==========================================
// HELPER: parse ID param
// ==========================================

function parseId(raw: string): number | null {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// ==========================================
// GET /api/admin/campaigns/[id]
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
                { success: false, message: "ID kampanye tidak valid." },
                { status: 400 }
            );
        }

        const campaign = await getCampaignById(id);

        return NextResponse.json({
            success: true,
            data: serializeCampaign(campaign),
        });
    } catch (error: any) {
        if (error instanceof MarketingError) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: error.statusCode }
            );
        }
        console.error("GET CAMPAIGN ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal mengambil data kampanye." },
            { status: 500 }
        );
    }
}

// ==========================================
// PATCH /api/admin/campaigns/[id]
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
                { success: false, message: "ID kampanye tidak valid." },
                { status: 400 }
            );
        }

        // Load existing campaign
        const existing = await getCampaignById(id);

        if (existing.status === "CANCELLED") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Kampanye yang sudah dibatalkan tidak bisa diubah.",
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        // --- Build update data ---
        const updateData: Record<string, any> = {};
        let hasTargetingChange = false;

        // name
        if (body.name !== undefined) {
            if (typeof body.name !== "string" || !body.name.trim()) {
                return NextResponse.json(
                    { success: false, message: "Nama kampanye tidak valid." },
                    { status: 400 }
                );
            }
            updateData.name = body.name.trim();
        }

        // slug
        if (body.slug !== undefined) {
            if (typeof body.slug !== "string" || !body.slug.trim()) {
                return NextResponse.json(
                    { success: false, message: "Slug tidak valid." },
                    { status: 400 }
                );
            }
            const newSlug = body.slug.trim();
            if (newSlug !== existing.slug) {
                const slugConflict = await prisma.campaign.findUnique({
                    where: { slug: newSlug },
                });
                if (slugConflict) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: "Slug kampanye sudah digunakan.",
                        },
                        { status: 409 }
                    );
                }
            }
            updateData.slug = newSlug;
        }

        // description
        if (body.description !== undefined) {
            updateData.description =
                typeof body.description === "string"
                    ? body.description.trim() || null
                    : null;
        }

        // bannerUrl
        if (body.bannerUrl !== undefined) {
            updateData.bannerUrl =
                typeof body.bannerUrl === "string"
                    ? body.bannerUrl.trim() || null
                    : null;
        }

        // code
        if (body.code !== undefined) {
            if (body.code === null || body.code === "") {
                updateData.code = null;
            } else if (typeof body.code === "string" && body.code.trim()) {
                const newCode = body.code.trim().toUpperCase();
                if (newCode !== existing.code) {
                    const codeConflict = await prisma.campaign.findUnique({
                        where: { code: newCode },
                    });
                    if (codeConflict) {
                        return NextResponse.json(
                            {
                                success: false,
                                message: "Kode kampanye sudah digunakan.",
                            },
                            { status: 409 }
                        );
                    }
                }
                updateData.code = newCode;
            } else {
                updateData.code = null;
            }
        }

        // type
        if (body.type !== undefined) {
            if (!isValidCampaignType(body.type)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Tipe kampanye tidak valid.",
                    },
                    { status: 400 }
                );
            }
            updateData.type = body.type;
        }

        // dates
        const newStartAt =
            body.startAt !== undefined ? new Date(body.startAt) : existing.startAt;
        const newEndAt =
            body.endAt !== undefined ? new Date(body.endAt) : existing.endAt;

        if (body.startAt !== undefined) {
            if (isNaN(newStartAt.getTime())) {
                return NextResponse.json(
                    { success: false, message: "Tanggal mulai tidak valid." },
                    { status: 400 }
                );
            }
            updateData.startAt = newStartAt;
        }
        if (body.endAt !== undefined) {
            if (isNaN(newEndAt.getTime())) {
                return NextResponse.json(
                    { success: false, message: "Tanggal berakhir tidak valid." },
                    { status: 400 }
                );
            }
            updateData.endAt = newEndAt;
        }
        if (newEndAt <= newStartAt) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tanggal berakhir harus setelah tanggal mulai.",
                },
                { status: 400 }
            );
        }

        // discountType
        if (
            body.discountType !== undefined &&
            body.discountType !== null &&
            body.discountType !== ""
        ) {
            if (!isValidDiscountType(body.discountType)) {
                return NextResponse.json(
                    { success: false, message: "Tipe diskon tidak valid." },
                    { status: 400 }
                );
            }
            updateData.discountType = body.discountType;
        } else if (body.discountType === null || body.discountType === "") {
            updateData.discountType = null;
        }

        // discountValue
        if (body.discountValue !== undefined) {
            if (body.discountValue === null || body.discountValue === "") {
                updateData.discountValue = null;
            } else {
                const dv = Number(body.discountValue);
                if (!Number.isFinite(dv) || dv <= 0) {
                    return NextResponse.json(
                        { success: false, message: "Nilai diskon tidak valid." },
                        { status: 400 }
                    );
                }
                const effectiveType = updateData.discountType ?? existing.discountType;
                if (effectiveType === "PERCENTAGE" && dv > 100) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: "Persentase diskon tidak boleh lebih dari 100%.",
                        },
                        { status: 400 }
                    );
                }
                updateData.discountValue = dv;
            }
        }

        // discountType required when discountValue is set
        const finalDiscountType = updateData.discountType ?? existing.discountType;
        const finalDiscountValue = updateData.discountValue !== undefined
            ? updateData.discountValue
            : existing.discountValue
                ? Number(existing.discountValue)
                : null;
        if (finalDiscountValue !== null && finalDiscountValue > 0 && !finalDiscountType) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tipe diskon wajib diisi jika nilai diskon ditentukan.",
                },
                { status: 400 }
            );
        }

        // maxDiscount
        if (body.maxDiscount !== undefined) {
            if (body.maxDiscount === null || body.maxDiscount === "") {
                updateData.maxDiscount = null;
            } else {
                const md = Number(body.maxDiscount);
                if (!Number.isFinite(md) || md <= 0) {
                    return NextResponse.json(
                        { success: false, message: "Diskon maksimal tidak valid." },
                        { status: 400 }
                    );
                }
                updateData.maxDiscount = md;
            }
        }

        // priority
        if (body.priority !== undefined) {
            const p = Number(body.priority);
            if (!Number.isInteger(p) || p < 0) {
                return NextResponse.json(
                    { success: false, message: "Prioritas tidak valid." },
                    { status: 400 }
                );
            }
            updateData.priority = p;
        }

        // productIds
        let newProductIds: number[] | undefined;
        if (body.productIds !== undefined) {
            if (!Array.isArray(body.productIds) || body.productIds.length === 0) {
                newProductIds = [];
            } else {
                const ids = body.productIds
                    .map(Number)
                    .filter((n: number) => Number.isInteger(n) && n > 0);
                // verify products exist
                if (ids.length > 0) {
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
                }
                newProductIds = ids;
            }
            hasTargetingChange = true;
        }

        // categories
        let newCategories: string[] | undefined;
        if (body.categories !== undefined) {
            if (!Array.isArray(body.categories) || body.categories.length === 0) {
                newCategories = [];
            } else {
                const cleaned: string[] = (body.categories as unknown[])
                    .map((c: unknown) =>
                        typeof c === "string" ? c.trim() : ""
                    )
                    .filter((c: string) => c.length > 0);
                newCategories = [...new Set(cleaned)];
            }
            hasTargetingChange = true;
        }

        // --- Execute update ---
        if (hasTargetingChange) {
            // Transaction: update campaign + replace targeting
            const updated = await prisma.$transaction(async (tx) => {
                // Update campaign fields
                const campaignUpdate: Record<string, any> = {};
                for (const [key, value] of Object.entries(updateData)) {
                    campaignUpdate[key] = value;
                }

                const campaign = await tx.campaign.update({
                    where: { id },
                    data: campaignUpdate,
                });

                // Replace CampaignProduct
                if (newProductIds !== undefined) {
                    await tx.campaignProduct.deleteMany({
                        where: { campaignId: id },
                    });
                    if (newProductIds.length > 0) {
                        await tx.campaignProduct.createMany({
                            data: newProductIds.map((productId) => ({
                                campaignId: id,
                                productId,
                            })),
                        });
                    }
                }

                // Replace CampaignCategory
                if (newCategories !== undefined) {
                    await tx.campaignCategory.deleteMany({
                        where: { campaignId: id },
                    });
                    if (newCategories.length > 0) {
                        await tx.campaignCategory.createMany({
                            data: newCategories.map((category) => ({
                                campaignId: id,
                                category,
                            })),
                        });
                    }
                }

                // Return with relations
                return tx.campaign.findUnique({
                    where: { id },
                    include: {
                        products: true,
                        categories: true,
                        vouchers: true,
                    },
                });
            });

            return NextResponse.json({
                success: true,
                data: serializeCampaign(updated),
            });
        } else {
            // Simple update without targeting changes
            const updated = await updateCampaign(id, updateData);
            return NextResponse.json({
                success: true,
                data: serializeCampaign(updated),
            });
        }
    } catch (error: any) {
        if (error instanceof MarketingError) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: error.statusCode }
            );
        }

        if (error?.code === "P2002") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Data kampanye sudah ada (slug atau kode duplikat).",
                },
                { status: 409 }
            );
        }

        console.error("UPDATE CAMPAIGN ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal memperbarui kampanye." },
            { status: 500 }
        );
    }
}

// ==========================================
// DELETE /api/admin/campaigns/[id]
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
                { success: false, message: "ID kampanye tidak valid." },
                { status: 400 }
            );
        }

        await deleteCampaign(id);

        return NextResponse.json({
            success: true,
            message: "Kampanye berhasil dihapus.",
        });
    } catch (error: any) {
        if (error instanceof MarketingError) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: error.statusCode }
            );
        }
        console.error("DELETE CAMPAIGN ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Gagal menghapus kampanye." },
            { status: 500 }
        );
    }
}
