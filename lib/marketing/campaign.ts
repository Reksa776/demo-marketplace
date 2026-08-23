import { prisma } from "@/lib/prisma";
import { CampaignStatus, CampaignType, Prisma } from "@prisma/client";
import {
    CampaignNotFoundError,
    CampaignNotActiveError,
} from "./errors";

/**
 * ==========================================
 * CAMPAIGN SERVICE
 * ==========================================
 *
 * Reusable campaign functions for:
 * - Admin API (CRUD)
 * - Pricing engine
 * - Future checkout integration
 *
 * Campaign lifecycle:
 * DRAFT → SCHEDULED → ACTIVE → ENDED → CANCELLED
 *
 * Status is always calculated server-side from startAt/endAt.
 * Never trust client-sent status.
 */

// ==========================================
// TYPES
// ==========================================

export type CampaignWithRelations = Awaited<
    ReturnType<typeof prisma.campaign.findUnique>
>;

export type CampaignListItem = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    bannerUrl: string | null;
    code: string | null;
    type: string;
    status: string;
    startAt: Date;
    endAt: Date;
    discountType: string | null;
    discountValue: import("@prisma/client").Prisma.Decimal | null;
    maxDiscount: import("@prisma/client").Prisma.Decimal | null;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
};

// ==========================================
// STATUS CALCULATION
// ==========================================

/**
 * Calculate actual campaign status from startAt/endAt.
 *
 * Rules:
 * - DRAFT: manual only, never auto-activates
 * - SCHEDULED: before startAt
 * - ACTIVE: startAt <= now <= endAt
 * - ENDED: now > endAt
 * - CANCELLED: manual only
 *
 * This is the SINGLE SOURCE OF TRUTH for campaign activity.
 */
export function calculateCampaignStatus(
    campaign: {
        status: CampaignStatus;
        startAt: Date;
        endAt: Date;
    },
    now: Date = new Date()
): CampaignStatus {
    // Manual statuses are never auto-changed
    if (campaign.status === "DRAFT") return "DRAFT";
    if (campaign.status === "CANCELLED") return "CANCELLED";

    // Time-based transitions
    if (now < campaign.startAt) return "SCHEDULED";
    if (now > campaign.endAt) return "ENDED";

    return "ACTIVE";
}

/**
 * Check if a campaign is currently active (can apply discounts).
 * Uses server-side time validation, never trusts client.
 */
export function isCampaignActive(
    campaign: {
        status: CampaignStatus;
        startAt: Date;
        endAt: Date;
    },
    now: Date = new Date()
): boolean {
    const actualStatus = calculateCampaignStatus(campaign, now);
    return actualStatus === "ACTIVE";
}

// ==========================================
// CRUD OPERATIONS
// ==========================================

/**
 * Create a new campaign.
 * Automatically sets status to DRAFT.
 */
export async function createCampaign(data: {
    name: string;
    slug: string;
    description?: string | null;
    bannerUrl?: string | null;
    code?: string | null;
    type?: string;
    startAt: Date;
    endAt: Date;
    discountType?: string | null;
    discountValue?: number | null;
    maxDiscount?: number | null;
    priority?: number;
    productIds?: number[];
    categories?: string[];
}) {
    if (data.endAt <= data.startAt) {
        throw new Error("Tanggal berakhir harus setelah tanggal mulai.");
    }

    return prisma.campaign.create({
        data: {
            name: data.name,
            slug: data.slug,
            description: data.description ?? null,
            bannerUrl: data.bannerUrl ?? null,
            code: data.code ?? null,
            type: (data.type as any) ?? "GENERAL",
            status: "DRAFT",
            startAt: data.startAt,
            endAt: data.endAt,
            discountType: (data.discountType as any) ?? null,
            discountValue: data.discountValue ?? null,
            maxDiscount: data.maxDiscount ?? null,
            priority: data.priority ?? 0,
            ...(data.productIds && data.productIds.length > 0
                ? {
                      products: {
                          create: data.productIds.map((productId) => ({
                              productId,
                          })),
                      },
                  }
                : {}),
            ...(data.categories && data.categories.length > 0
                ? {
                      categories: {
                          create: data.categories.map((category) => ({
                              category,
                          })),
                      },
                  }
                : {}),
        },
        include: {
            products: true,
            categories: true,
            vouchers: true,
        },
    });
}

/**
 * Get campaign by ID with all relations.
 */
export async function getCampaignById(id: number) {
    const campaign = await prisma.campaign.findUnique({
        where: { id },
        include: {
            products: true,
            categories: true,
            vouchers: true,
        },
    });

    if (!campaign) {
        throw new CampaignNotFoundError(id);
    }

    return campaign;
}

/**
 * Get campaign by slug with all relations.
 */
export async function getCampaignBySlug(slug: string) {
    const campaign = await prisma.campaign.findUnique({
        where: { slug },
        include: {
            products: true,
            categories: true,
            vouchers: true,
        },
    });

    if (!campaign) {
        throw new CampaignNotFoundError(slug);
    }

    return campaign;
}

/**
 * List campaigns with optional filters.
 */
export async function listCampaigns(options?: {
    status?: CampaignStatus;
    includeEnded?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
}) {
    const where: any = {};

    if (options?.status) {
        where.status = options.status;
    }

    if (!options?.includeEnded) {
        where.status = { notIn: ["ENDED", "CANCELLED"] };
    }

    if (options?.search && options.search.trim()) {
        const term = options.search.trim();
        where.OR = [
            { name: { contains: term } },
            { slug: { contains: term } },
        ];
    }

    const [campaigns, total] = await Promise.all([
        prisma.campaign.findMany({
            where,
            include: {
                products: true,
                categories: true,
            },
            orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
            take: options?.limit ?? 50,
            skip: options?.offset ?? 0,
        }),
        prisma.campaign.count({ where }),
    ]);

    return { campaigns, total };
}

/**
 * Update campaign fields.
 * Cannot update a CANCELLED campaign.
 */
export async function updateCampaign(
    id: number,
    data: {
        name?: string;
        slug?: string;
        description?: string | null;
        bannerUrl?: string | null;
        code?: string | null;
        type?: CampaignType;
        startAt?: Date;
        endAt?: Date;
        discountType?: CampaignType extends string ? string : never;
        discountValue?: number | null;
        maxDiscount?: number | null;
        priority?: number;
    }
) {
    const existing = await getCampaignById(id);

    if (existing.status === "CANCELLED") {
        throw new Error("Kampanye yang sudah dibatalkan tidak bisa diubah.");
    }

    if (data.startAt && data.endAt && data.endAt <= data.startAt) {
        throw new Error("Tanggal berakhir harus setelah tanggal mulai.");
    }

    const updateData: Prisma.CampaignUpdateInput = {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.bannerUrl !== undefined && { bannerUrl: data.bannerUrl }),
        ...(data.code !== undefined && { code: data.code }),
        ...(data.type !== undefined && { type: data.type as CampaignType }),
        ...(data.startAt !== undefined && { startAt: data.startAt }),
        ...(data.endAt !== undefined && { endAt: data.endAt }),
        ...(data.discountType !== undefined && { discountType: data.discountType as any }),
        ...(data.discountValue !== undefined && { discountValue: data.discountValue }),
        ...(data.maxDiscount !== undefined && { maxDiscount: data.maxDiscount }),
        ...(data.priority !== undefined && { priority: data.priority }),
    };

    return prisma.campaign.update({
        where: { id },
        data: updateData,
        include: {
            products: true,
            categories: true,
            vouchers: true,
        },
    });
}

/**
 * Cancel a campaign.
 * Sets status to CANCELLED.
 */
export async function cancelCampaign(id: number) {
    const existing = await getCampaignById(id);

    if (existing.status === "ENDED") {
        throw new Error("Kampanye yang sudah selesai tidak bisa dibatalkan.");
    }

    if (existing.status === "CANCELLED") {
        throw new Error("Kampanye sudah dalam status dibatalkan.");
    }

    return prisma.campaign.update({
        where: { id },
        data: { status: "CANCELLED" },
    });
}

/**
 * Get all currently active campaigns.
 * Uses server-side time validation.
 */
export async function getActiveCampaigns(now: Date = new Date()) {
    const campaigns = await prisma.campaign.findMany({
        where: {
            status: { notIn: ["DRAFT", "CANCELLED"] },
            startAt: { lte: now },
            endAt: { gte: now },
        },
        include: {
            products: true,
            categories: true,
        },
        orderBy: [{ priority: "desc" }, { startAt: "asc" }],
    });

    return campaigns.filter((c) => isCampaignActive(c, now));
}

/**
 * Resolve which campaign applies to a specific product.
 * Returns the highest-priority active campaign that targets this product.
 */
export async function resolveCampaignForProduct(
    productId: number,
    productCategory: string | null,
    now: Date = new Date()
) {
    const activeCampaigns = await getActiveCampaigns(now);

    for (const campaign of activeCampaigns) {
        // GENERAL campaigns apply to all products
        if (campaign.type === "GENERAL") {
            return campaign;
        }

        // PRODUCT_DISCOUNT: check if product is in campaign's product list
        if (campaign.type === "PRODUCT_DISCOUNT") {
            const isProductInCampaign = campaign.products.some(
                (p) => p.productId === productId
            );
            if (isProductInCampaign) {
                return campaign;
            }
        }

        // CATEGORY_DISCOUNT: check if product category is in campaign's category list
        if (campaign.type === "CATEGORY_DISCOUNT" && productCategory) {
            const isCategoryInCampaign = campaign.categories.some(
                (c) => c.category.toLowerCase() === productCategory.toLowerCase()
            );
            if (isCategoryInCampaign) {
                return campaign;
            }
        }
    }

    return null;
}

/**
 * Delete a campaign.
 * Only DRAFT campaigns can be deleted.
 */
export async function deleteCampaign(id: number) {
    const existing = await getCampaignById(id);

    if (existing.status !== "DRAFT") {
        throw new Error(
            "Hanya kampanye dengan status DRAFT yang bisa dihapus."
        );
    }

    return prisma.campaign.delete({
        where: { id },
    });
}

/**
 * Get campaign with computed effective status.
 */
export async function getCampaignStatus(id: number, now: Date = new Date()) {
    const campaign = await getCampaignById(id);
    const effectiveStatus = calculateCampaignStatus(campaign, now);

    return {
        ...campaign,
        effectiveStatus,
    };
}
