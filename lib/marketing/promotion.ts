import { prisma } from "@/lib/prisma";
import { PromotionPlacement } from "@prisma/client";
import { PromotionNotFoundError } from "./errors";

/**
 * ==========================================
 * PROMOTION / BANNER SERVICE
 * ==========================================
 *
 * Manages promotional banners with placement support:
 * - HOMEPAGE
 * - CAMPAIGN
 * - CATEGORY
 * - PRODUCT
 *
 * Rules:
 * - Expired promotions never returned as active
 * - Priority determines ordering
 * - isActive + time window must both pass
 */

// ==========================================
// TYPES
// ==========================================

export type PromotionWithPlacement = Awaited<
    ReturnType<typeof prisma.promotion.findUnique>
>;

// ==========================================
// CRUD OPERATIONS
// ==========================================

/**
 * Create a promotion.
 */
export async function createPromotion(data: {
    title: string;
    imageUrl: string;
    link?: string | null;
    placement?: PromotionPlacement;
    priority?: number;
    isActive?: boolean;
    startAt?: Date | null;
    endAt?: Date | null;
}) {
    if (data.startAt && data.endAt && data.endAt <= data.startAt) {
        throw new Error("Tanggal berakhir harus setelah tanggal mulai.");
    }

    return prisma.promotion.create({
        data: {
            title: data.title,
            imageUrl: data.imageUrl,
            link: data.link ?? null,
            placement: data.placement ?? "HOMEPAGE",
            priority: data.priority ?? 0,
            isActive: data.isActive ?? true,
            startAt: data.startAt ?? null,
            endAt: data.endAt ?? null,
        },
    });
}

/**
 * Update a promotion.
 */
export async function updatePromotion(
    id: number,
    data: {
        title?: string;
        imageUrl?: string;
        link?: string | null;
        placement?: PromotionPlacement;
        priority?: number;
        isActive?: boolean;
        startAt?: Date | null;
        endAt?: Date | null;
    }
) {
    const existing = await prisma.promotion.findUnique({ where: { id } });

    if (!existing) {
        throw new PromotionNotFoundError();
    }

    if (data.startAt && data.endAt && data.endAt <= data.startAt) {
        throw new Error("Tanggal berakhir harus setelah tanggal mulai.");
    }

    return prisma.promotion.update({
        where: { id },
        data,
    });
}

/**
 * Delete a promotion.
 */
export async function deletePromotion(id: number) {
    const existing = await prisma.promotion.findUnique({ where: { id } });

    if (!existing) {
        throw new PromotionNotFoundError();
    }

    return prisma.promotion.delete({ where: { id } });
}

/**
 * Get promotion by ID.
 */
export async function getPromotion(id: number) {
    const promotion = await prisma.promotion.findUnique({ where: { id } });

    if (!promotion) {
        throw new PromotionNotFoundError();
    }

    return promotion;
}

/**
 * List promotions with optional filters.
 */
export async function listPromotions(options?: {
    placement?: PromotionPlacement;
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
}) {
    const where: any = {};

    if (options?.placement) {
        where.placement = options.placement;
    }

    if (options?.isActive !== undefined) {
        where.isActive = options.isActive;
    }

    if (options?.search && options.search.trim()) {
        const term = options.search.trim();
        where.title = { contains: term };
    }

    const [promotions, total] = await Promise.all([
        prisma.promotion.findMany({
            where,
            orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
            take: options?.limit ?? 50,
            skip: options?.offset ?? 0,
        }),
        prisma.promotion.count({ where }),
    ]);

    return { promotions, total };
}

/**
 * Get all active promotions for a specific placement.
 *
 * Respects:
 * - isActive flag
 * - startAt / endAt time window
 * - Priority ordering
 */
export async function getActivePromotions(
    placement: PromotionPlacement,
    now: Date = new Date()
) {
    return prisma.promotion.findMany({
        where: {
            placement,
            isActive: true,
            OR: [
                { startAt: null },
                { startAt: { lte: now } },
            ],
            AND: [
                {
                    OR: [
                        { endAt: null },
                        { endAt: { gte: now } },
                    ],
                },
            ],
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
}

/**
 * Get active homepage promotions (convenience method).
 */
export async function getHomepagePromotions(now: Date = new Date()) {
    return getActivePromotions("HOMEPAGE", now);
}

/**
 * Get active promotions for a specific campaign.
 */
export async function getCampaignPromotions(
    campaignId: number,
    now: Date = new Date()
) {
    const promotions = await getActivePromotions("CAMPAIGN", now);
    // Note: In the future, we could filter by campaignId if we add that field
    // For now, all CAMPAIGN promotions are returned
    return promotions;
}
