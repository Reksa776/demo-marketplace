/**
 * ==========================================
 * PRODUCT CARD — MARKETING PRICE DISPLAY TESTS
 * ==========================================
 *
 * Regression tests ensuring:
 * - Products without discount show normal price only
 * - Products with discount show strikethrough + marketing price + badge
 * - Discount percentage is calculated correctly
 * - Pricing engine consistency across all discount types
 * - No manual price calculation in UI
 *
 * Run: npx jest __tests__/marketing/product-card-pricing.test.ts
 */

// ==========================================
// MOCK PRISMA
// ==========================================

const mockPrisma = {
    flashSale: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
    },
    productDiscount: {
        findMany: jest.fn().mockResolvedValue([]),
    },
    bulkDiscount: {
        findMany: jest.fn().mockResolvedValue([]),
    },
    campaign: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
    },
    shippingDiscount: {
        findFirst: jest.fn().mockResolvedValue(null),
    },
    voucher: {
        findUnique: jest.fn().mockResolvedValue(null),
    },
    voucherUserUsage: {
        findUnique: jest.fn().mockResolvedValue(null),
    },
    order: {
        count: jest.fn().mockResolvedValue(0),
    },
    product: {
        findMany: jest.fn().mockResolvedValue([]),
    },
};

jest.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

// ==========================================
// IMPORTS
// ==========================================

import { resolveBatchPrices } from "@/lib/marketing/batch-pricing";

// ==========================================
// HELPERS
// ==========================================

function decimal(value: number) {
    return { toString: () => String(value), valueOf: () => value } as any;
}

function makeFlashSale(overrides: Partial<any> = {}) {
    return {
        variantId: 1,
        salePrice: decimal(75000),
        id: 10,
        name: "Flash Sale",
        endAt: new Date("2099-01-01"),
        ...overrides,
    };
}

function makeProductDiscount(overrides: Partial<any> = {}) {
    return {
        id: 1,
        productId: 1,
        variantId: 1,
        type: "PERCENTAGE",
        value: decimal(20),
        maxDiscount: null,
        ...overrides,
    };
}

function makeCampaign(overrides: Partial<any> = {}) {
    return {
        id: 1,
        name: "Test Campaign",
        slug: "test-campaign",
        type: "GENERAL",
        status: "ACTIVE",
        startAt: new Date("2020-01-01"),
        endAt: new Date("2099-12-31"),
        discountType: "PERCENTAGE",
        discountValue: decimal(10),
        maxDiscount: decimal(50000),
        priority: 0,
        products: [],
        categories: [],
        ...overrides,
    };
}

function makeBulkDiscount(overrides: Partial<any> = {}) {
    return {
        id: 1,
        name: "Bulk Deal",
        productId: 1,
        variantId: 1,
        minQuantity: 3,
        type: "PERCENTAGE",
        value: decimal(15),
        maxDiscount: null,
        ...overrides,
    };
}

// ==========================================
// DISCOUNT PERCENTAGE CALCULATION
// ==========================================

describe("Discount percentage calculation", () => {
    /**
     * This mirrors the calculateDiscountPercent function
     * used in ProductCard. Tests verify the formula is correct.
     */
    function calculateDiscountPercent(
        originalPrice: number,
        finalPrice: number
    ): number {
        if (
            originalPrice <= 0 ||
            finalPrice <= 0 ||
            finalPrice >= originalPrice
        ) {
            return 0;
        }
        return Math.round(
            ((originalPrice - finalPrice) / originalPrice) * 100
        );
    }

    test("Percentage discount: 20% off 100000 → 20%", () => {
        expect(calculateDiscountPercent(100000, 80000)).toBe(20);
    });

    test("Fixed discount: 25000 off 100000 → 25%", () => {
        expect(calculateDiscountPercent(100000, 75000)).toBe(25);
    });

    test("Flash Sale: 75000 from 100000 → 25%", () => {
        expect(calculateDiscountPercent(100000, 75000)).toBe(25);
    });

    test("Campaign 10% off 100000 → 10%", () => {
        expect(calculateDiscountPercent(100000, 90000)).toBe(10);
    });

    test("Bulk discount 15% off 100000 → 15%", () => {
        expect(calculateDiscountPercent(100000, 85000)).toBe(15);
    });

    test("No discount: same price → 0%", () => {
        expect(calculateDiscountPercent(100000, 100000)).toBe(0);
    });

    test("Final price higher than original → 0%", () => {
        expect(calculateDiscountPercent(80000, 100000)).toBe(0);
    });

    test("Zero original price → 0%", () => {
        expect(calculateDiscountPercent(0, 80000)).toBe(0);
    });

    test("Zero final price → 0%", () => {
        expect(calculateDiscountPercent(100000, 0)).toBe(0);
    });

    test("Large discount: 90% off 100000 → 90%", () => {
        expect(calculateDiscountPercent(100000, 10000)).toBe(90);
    });

    test("Small discount: 1% off 100000 → 1%", () => {
        expect(calculateDiscountPercent(100000, 99000)).toBe(1);
    });

    test("Rounding: 33.33% off 30000 → 33%", () => {
        expect(calculateDiscountPercent(30000, 20000)).toBe(33);
    });
});

// ==========================================
// PRICING ENGINE → PRODUCT CARD CONSISTENCY
// ==========================================

describe("Pricing engine → Product Card data consistency", () => {
    beforeEach(() => jest.clearAllMocks());

    test("Product without discount: effectivePrice === price, hasDiscount=false", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        const r = results[0];
        expect(r.effectivePrice).toBe(100000);
        expect(r.discountAmount).toBe(0);
        expect(r.source).toBe("ORIGINAL");

        // ProductCard would compute:
        const hasDiscount = r.discountAmount > 0;
        expect(hasDiscount).toBe(false);
    });

    test("Product Discount 20%: effectivePrice=80000, discountAmount=20000", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            makeProductDiscount({ value: decimal(20) }),
        ]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        const r = results[0];
        expect(r.effectivePrice).toBe(80000);
        expect(r.discountAmount).toBe(20000);
        expect(r.source).toBe("PRODUCT_DISCOUNT");

        // Discount percentage: (100000 - 80000) / 100000 * 100 = 20%
        const discountPercent = Math.round(
            ((100000 - r.effectivePrice) / 100000) * 100
        );
        expect(discountPercent).toBe(20);
    });

    test("Fixed discount Rp25000: effectivePrice=75000, percentage=25%", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            makeProductDiscount({ type: "FIXED", value: decimal(25000) }),
        ]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        const r = results[0];
        expect(r.effectivePrice).toBe(75000);
        expect(r.discountAmount).toBe(25000);

        const discountPercent = Math.round(
            ((100000 - r.effectivePrice) / 100000) * 100
        );
        expect(discountPercent).toBe(25);
    });

    test("Flash Sale: effectivePrice=salePrice, no stacking with Product Discount", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([
            makeFlashSale({ salePrice: decimal(70000) }),
        ]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            makeProductDiscount({ value: decimal(20) }),
        ]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        const r = results[0];
        // Flash Sale wins, Product Discount is NOT stacked
        expect(r.source).toBe("FLASH_SALE");
        expect(r.effectivePrice).toBe(70000);
        expect(r.discountAmount).toBe(30000);
        expect(r.campaignId).toBeNull();

        const discountPercent = Math.round(
            ((100000 - r.effectivePrice) / 100000) * 100
        );
        expect(discountPercent).toBe(30);
    });

    test("Campaign 10%: effectivePrice=90000, percentage=10%", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            makeCampaign({ discountValue: decimal(10) }),
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        const r = results[0];
        expect(r.source).toBe("CAMPAIGN");
        expect(r.effectivePrice).toBe(90000);
        expect(r.discountAmount).toBe(10000);

        const discountPercent = Math.round(
            ((100000 - r.effectivePrice) / 100000) * 100
        );
        expect(discountPercent).toBe(10);
    });

    test("Bulk Discount 15% (qty≥min): effectivePrice=85000, percentage=15%", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([
            makeBulkDiscount({ minQuantity: 3, value: decimal(15) }),
        ]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 5 },
        ]);

        const r = results[0];
        expect(r.source).toBe("BULK_DISCOUNT");

        const discountPercent = Math.round(
            ((100000 - r.effectivePrice) / 100000) * 100
        );
        expect(discountPercent).toBe(15);
    });

    test("Bulk Discount NOT applied when qty < minQuantity", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([
            makeBulkDiscount({ minQuantity: 3, value: decimal(15) }),
        ]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 2 },
        ]);

        const r = results[0];
        expect(r.source).toBe("ORIGINAL");
        expect(r.effectivePrice).toBe(100000);
        expect(r.discountAmount).toBe(0);
    });
});

// ==========================================
// PRODUCT CARD DISPLAY RULES
// ==========================================

describe("Product Card display rules", () => {
    /**
     * Simulates ProductCard logic:
     * - hasDiscount = effectivePrice < originalPrice
     * - showMarketingLayout = hasDiscount
     * - discountPercent = calculateDiscountPercent(originalPrice, effectivePrice)
     */

    function simulateProductCard(originalPrice: number, effectivePrice: number) {
        const hasDiscount = effectivePrice < originalPrice;
        const discountPercent =
            hasDiscount && originalPrice > 0
                ? Math.round(((originalPrice - effectivePrice) / originalPrice) * 100)
                : 0;

        return {
            hasDiscount,
            discountPercent,
            showStrikethrough: hasDiscount,
            showBadge: hasDiscount && discountPercent > 0,
            showRosePrice: hasDiscount,
        };
    }

    test("No discount: normal price only, no strikethrough, no badge", () => {
        const card = simulateProductCard(100000, 100000);
        expect(card.hasDiscount).toBe(false);
        expect(card.showStrikethrough).toBe(false);
        expect(card.showBadge).toBe(false);
        expect(card.showRosePrice).toBe(false);
    });

    test("Percentage discount: strikethrough + rose price + badge", () => {
        const card = simulateProductCard(100000, 80000);
        expect(card.hasDiscount).toBe(true);
        expect(card.showStrikethrough).toBe(true);
        expect(card.showBadge).toBe(true);
        expect(card.discountPercent).toBe(20);
    });

    test("Fixed discount: strikethrough + rose price + badge", () => {
        const card = simulateProductCard(100000, 75000);
        expect(card.hasDiscount).toBe(true);
        expect(card.showStrikethrough).toBe(true);
        expect(card.showBadge).toBe(true);
        expect(card.discountPercent).toBe(25);
    });

    test("Flash Sale: strikethrough + rose price + badge", () => {
        const card = simulateProductCard(100000, 70000);
        expect(card.hasDiscount).toBe(true);
        expect(card.discountPercent).toBe(30);
    });

    test("Campaign discount: strikethrough + rose price + badge", () => {
        const card = simulateProductCard(100000, 90000);
        expect(card.hasDiscount).toBe(true);
        expect(card.discountPercent).toBe(10);
    });

    test("Bulk discount: strikethrough + rose price + badge", () => {
        const card = simulateProductCard(100000, 85000);
        expect(card.hasDiscount).toBe(true);
        expect(card.discountPercent).toBe(15);
    });
});

// ==========================================
// MULTI-VARIANT PRICE RANGE
// ==========================================

describe("Multi-variant price range", () => {
    beforeEach(() => jest.clearAllMocks());

    test("Variants with different prices: range shows lowest effective price", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            makeProductDiscount({ variantId: 1, value: decimal(20) }),
        ]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
            { productId: 1, variantId: 2, originalPrice: 150000, quantity: 1 },
        ]);

        // Only variant 1 has discount, variant 2 is original
        expect(results[0].effectivePrice).toBe(80000); // 20% off
        expect(results[1].effectivePrice).toBe(150000); // no discount

        // ProductCard would show range: Rp 80.000 - Rp 150.000
        const prices = results.map((r) => r.effectivePrice);
        expect(Math.min(...prices)).toBe(80000);
        expect(Math.max(...prices)).toBe(150000);
    });

    test("All variants discounted: range shows effective prices", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            makeProductDiscount({ variantId: 1, value: decimal(20) }),
            makeProductDiscount({ variantId: 2, value: decimal(10) }),
        ]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
            { productId: 1, variantId: 2, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].effectivePrice).toBe(80000);
        expect(results[1].effectivePrice).toBe(90000);

        const prices = results.map((r) => r.effectivePrice);
        expect(Math.min(...prices)).toBe(80000);
        expect(Math.max(...prices)).toBe(90000);
    });
});

// ==========================================
// PRICING PRIORITY → CARD DISPLAY
// ==========================================

describe("Pricing priority → card display", () => {
    beforeEach(() => jest.clearAllMocks());

    test("Product Discount beats Campaign in card display", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            makeProductDiscount({ value: decimal(20) }),
        ]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            makeCampaign({ discountValue: decimal(30) }),
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        // Product Discount wins → card shows 20% off, not 30%
        expect(results[0].source).toBe("PRODUCT_DISCOUNT");
        expect(results[0].effectivePrice).toBe(80000);

        const discountPercent = Math.round(
            ((100000 - results[0].effectivePrice) / 100000) * 100
        );
        expect(discountPercent).toBe(20);
    });

    test("Flash Sale beats all in card display", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([
            makeFlashSale({ salePrice: decimal(60000) }),
        ]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            makeProductDiscount({ value: decimal(20) }),
        ]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            makeCampaign({ discountValue: decimal(30) }),
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([
            makeBulkDiscount({ minQuantity: 1, value: decimal(40) }),
        ]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 5 },
        ]);

        // Flash Sale wins → card shows 40% off
        expect(results[0].source).toBe("FLASH_SALE");
        expect(results[0].effectivePrice).toBe(60000);

        const discountPercent = Math.round(
            ((100000 - results[0].effectivePrice) / 100000) * 100
        );
        expect(discountPercent).toBe(40);
    });
});
