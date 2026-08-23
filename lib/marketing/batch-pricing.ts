import { prisma } from "@/lib/prisma";
import { getActiveCampaigns, isCampaignActive } from "./campaign";

/**
 * ==========================================
 * BATCH MARKETING PRICING UTILITY
 * ==========================================
 *
 * Resolves marketing-adjusted prices for a list
 * of items using batch queries (fixes E4 N+1).
 *
 * Used by:
 * - Product listing/detail pages (display)
 * - Checkout order creation (authoritative)
 * - Buy Now page (display)
 *
 * Pricing priority (Phase 3 rules):
 * 1. FLASH_SALE — highest, overrides all
 * 2. PRODUCT_DISCOUNT — per-product/variant
 * 3. CAMPAIGN_DISCOUNT — campaign-wide
 * 4. ORIGINAL — raw variant.price
 */

export type BatchPricingItemInput = {
    productId: number;
    variantId: number;
    originalPrice: number;
    quantity?: number;
    category?: string | null;
};

export type BatchPricingResult = {
    productId: number;
    variantId: number;
    originalPrice: number;
    effectivePrice: number;
    discountAmount: number;
    source:
        | "ORIGINAL"
        | "FLASH_SALE"
        | "PRODUCT_DISCOUNT"
        | "CAMPAIGN"
        | "BULK_DISCOUNT";
    flashSaleId: number | null;
    flashSaleName: string | null;
    flashSaleEndAt: Date | null;
    bulkDiscountName: string | null;
    bulkMinQuantity: number | null;
    campaignId: number | null;
};

/**
 * Resolve the most relevant active campaign ID for a set of items.
 *
 * Returns the highest-priority active campaign that targets
 * at least one of the given products.
 *
 * Used by checkout to determine campaign context for
 * campaign-specific voucher validation.
 */
export async function resolveOrderCampaignId(
    items: { productId: number; category?: string | null }[],
    now: Date = new Date()
): Promise<number | null> {
    const activeCampaigns = await getActiveCampaigns(now);

    for (const campaign of activeCampaigns) {
        if (!campaign.discountType || !campaign.discountValue) continue;

        for (const item of items) {
            let targets = false;
            if (campaign.type === "GENERAL") {
                targets = true;
            } else if (campaign.type === "PRODUCT_DISCOUNT") {
                targets = campaign.products.some(
                    (p) => p.productId === item.productId
                );
            } else if (campaign.type === "CATEGORY_DISCOUNT" && item.category) {
                targets = campaign.categories.some(
                    (c) => c.category.toLowerCase() === item.category!.toLowerCase()
                );
            }

            if (targets) {
                return campaign.id;
            }
        }
    }

    return null;
}

/**
 * Resolve marketing prices for a batch of items.
 *
 * Performs 3 batch queries regardless of item count:
 * 1. Flash sales (batch by variant IDs)
 * 2. Product discounts (batch by product/variant IDs)
 * 3. Active campaigns (single query)
 *
 * Then resolves pricing in-memory per item.
 *
 * @param items - Items to resolve prices for
 * @param now - Current time (for testing)
 * @returns Array of pricing results
 */
export async function resolveBatchPrices(
    items: BatchPricingItemInput[],
    now: Date = new Date()
): Promise<BatchPricingResult[]> {
    if (items.length === 0) return [];

    const variantIds = [
        ...new Set(items.map((i) => i.variantId)),
    ];
    const productIds = [
        ...new Set(items.map((i) => i.productId)),
    ];

    // ==========================================
    // BATCH 1: Flash Sales
    // ==========================================
    const flashSales =
        await prisma.flashSale.findMany({
            where: {
                variantId: { in: variantIds },
                isActive: true,
                startAt: { lte: now },
                endAt: { gte: now },
                saleStock: { gt: 0 },
            },
        });

    const flashSaleMap = new Map(
        flashSales.map((fs) => [fs.variantId, fs])
    );

    // ==========================================
    // BATCH 2: Product Discounts
    // ==========================================
    const allDiscounts =
        await prisma.productDiscount.findMany({
            where: {
                OR: [
                    {
                        productId: { in: productIds },
                        variantId: null,
                        isActive: true,
                        startAt: { lte: now },
                        endAt: { gte: now },
                    },
                    {
                        variantId: { in: variantIds },
                        isActive: true,
                        startAt: { lte: now },
                        endAt: { gte: now },
                    },
                ],
            },
        });

    // Variant-specific takes priority over product-wide
    const discountMap = new Map<
        number,
        (typeof allDiscounts)[0]
    >();
    for (const d of allDiscounts) {
        if (d.variantId) {
            if (!discountMap.has(d.variantId)) {
                discountMap.set(d.variantId, d);
            }
        } else {
            const key = -d.productId;
            if (!discountMap.has(key)) {
                discountMap.set(key, d);
            }
        }
    }

    // ==========================================
    // BATCH 3: Active Campaigns
    // ==========================================
    const activeCampaigns =
        await getActiveCampaigns(now);

    // ==========================================
    // BATCH 4: Bulk Discounts
    // ==========================================
    const bulkDiscounts =
        await prisma.bulkDiscount.findMany({
            where: {
                OR: [
                    {
                        productId: { in: productIds },
                        variantId: null,
                        isActive: true,
                        startAt: { lte: now },
                        endAt: { gte: now },
                    },
                    {
                        variantId: { in: variantIds },
                        isActive: true,
                        startAt: { lte: now },
                        endAt: { gte: now },
                    },
                ],
            },
            orderBy: { minQuantity: "desc" },
        });

    // Group by variantId/productId and pick best tier per quantity
    const bulkDiscountMap = new Map<
        number,
        (typeof bulkDiscounts)[0]
    >();
    const bulkDiscountProductMap = new Map<
        number,
        (typeof bulkDiscounts)[0]
    >();
    for (const bd of bulkDiscounts) {
        if (bd.variantId && !bulkDiscountMap.has(bd.variantId)) {
            bulkDiscountMap.set(bd.variantId, bd);
        } else if (!bd.variantId && !bulkDiscountProductMap.has(bd.productId)) {
            bulkDiscountProductMap.set(bd.productId, bd);
        }
    }

    // ==========================================
    // RESOLVE PER ITEM (in-memory, 0 queries)
    // ==========================================
    return items.map((item) => {
        const result: BatchPricingResult = {
            productId: item.productId,
            variantId: item.variantId,
            originalPrice: item.originalPrice,
            effectivePrice: item.originalPrice,
            discountAmount: 0,
            source: "ORIGINAL",
            flashSaleId: null,
            flashSaleName: null,
            flashSaleEndAt: null,
            bulkDiscountName: null,
            bulkMinQuantity: null,
            campaignId: null,
        };

        // 1. FLASH SALE — highest priority
        const fs = flashSaleMap.get(item.variantId);
        if (fs) {
            const salePrice = Math.round(
                Number(fs.salePrice)
            );
            result.effectivePrice = salePrice;
            result.discountAmount =
                item.originalPrice - salePrice;
            result.source = "FLASH_SALE";
            result.flashSaleId = fs.id;
            result.flashSaleName = fs.name;
            result.flashSaleEndAt = fs.endAt;
            return result;
        }

        // 2. PRODUCT DISCOUNT
        const discount =
            discountMap.get(item.variantId) ??
            discountMap.get(-item.productId);
        if (discount) {
            const dv = Number(discount.value);
            let amt = 0;
            if (discount.type === "PERCENTAGE") {
                amt = (item.originalPrice * dv) / 100;
                if (discount.maxDiscount) {
                    const max = Number(
                        discount.maxDiscount
                    );
                    if (amt > max) amt = max;
                }
            } else {
                amt = dv;
            }
            amt = Math.min(amt, item.originalPrice);
            amt = Math.round(amt);
            result.effectivePrice =
                item.originalPrice - amt;
            result.discountAmount = amt;
            result.source = "PRODUCT_DISCOUNT";
            return result;
        }

        // 3. CAMPAIGN DISCOUNT
        for (const campaign of activeCampaigns) {
            let targets = false;
            if (campaign.type === "GENERAL") {
                targets = true;
            } else if (
                campaign.type === "PRODUCT_DISCOUNT"
            ) {
                targets = campaign.products.some(
                    (p) =>
                        p.productId === item.productId
                );
            } else if (
                campaign.type === "CATEGORY_DISCOUNT"
            ) {
                targets =
                    campaign.categories.some(
                        (c) =>
                            c.category.toLowerCase() ===
                            (
                                item.category ?? ""
                            ).toLowerCase()
                    );
            }

        if (
            targets &&
            campaign.discountType &&
            campaign.discountValue &&
            isCampaignActive(campaign, now)
        ) {
            const val = Number(
                campaign.discountValue
            );
            let amt = 0;
            if (
                campaign.discountType ===
                "PERCENTAGE"
            ) {
                amt =
                    (item.originalPrice *
                        val) /
                    100;
                if (campaign.maxDiscount) {
                    const max = Number(
                        campaign.maxDiscount
                    );
                    if (amt > max) amt = max;
                }
            } else {
                amt = val;
            }
            amt = Math.min(
                amt,
                item.originalPrice
            );
            amt = Math.round(amt);
            result.effectivePrice =
                item.originalPrice - amt;
            result.discountAmount = amt;
            result.source = "CAMPAIGN";
            result.campaignId = campaign.id;
            break;
        }
    }

    // 4. BULK DISCOUNT — lowest priority, quantity-based
    //    Only applies if no higher-priority discount gave a better price
    const quantity = item.quantity ?? 1;
    if (result.source === "ORIGINAL" || result.discountAmount === 0) {
        const bd = bulkDiscountMap.get(item.variantId) ?? bulkDiscountProductMap.get(item.productId);
        if (bd && quantity >= bd.minQuantity) {
            const dv = Number(bd.value);
            let amt = 0;
            if (bd.type === "PERCENTAGE") {
                // Per-item discount, cap per-item, then multiply by quantity
                let perItem = (item.originalPrice * dv) / 100;
                if (bd.maxDiscount) {
                    const max = Number(bd.maxDiscount);
                    if (perItem > max) perItem = max;
                }
                amt = perItem * quantity;
            } else {
                amt = dv * quantity;
            }
            amt = Math.min(amt, item.originalPrice * quantity);
            const perItem = Math.round(amt / quantity);
            if (perItem > 0) {
                result.effectivePrice = item.originalPrice - perItem;
                result.discountAmount = perItem;
                result.source = "BULK_DISCOUNT";
                result.bulkDiscountName = bd.name;
                result.bulkMinQuantity = bd.minQuantity;
            }
        }
    }

    return result;
    });
}
