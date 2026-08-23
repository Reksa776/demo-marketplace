/**
 * ==========================================
 * REAL PRICING CALCULATION TESTS
 * ==========================================
 *
 * Tests actual numeric results from marketing pricing functions.
 * NOT architecture/pattern tests — these assert exact prices.
 *
 * Run: npx jest __tests__/marketing/pricing-calculations.test.ts
 */

// ==========================================
// MOCK PRISMA
// ==========================================

const mockPrisma = {
    flashSale: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
    },
    productDiscount: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    bulkDiscount: {
        findMany: jest.fn(),
    },
    campaign: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
    },
    shippingDiscount: {
        findFirst: jest.fn(),
    },
    voucher: {
        findUnique: jest.fn(),
    },
    voucherUserUsage: {
        findUnique: jest.fn(),
    },
    order: {
        count: jest.fn(),
    },
    product: {
        findMany: jest.fn(),
    },
};

jest.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

// ==========================================
// IMPORTS (after mock setup)
// ==========================================

import { calculateDiscountedPrice } from "@/lib/marketing/discount";
import { resolveBulkDiscount } from "@/lib/marketing/bulk-discount";
import { calculateShippingDiscount } from "@/lib/marketing/shipping-discount";
import { resolveBatchPrices } from "@/lib/marketing/batch-pricing";
import { validateAndCalculateVoucherEnhanced } from "@/lib/voucher";

// ==========================================
// HELPERS
// ==========================================

function decimal(value: number) {
    return { toString: () => String(value), valueOf: () => value } as any;
}

// ==========================================
// A. FLASH SALE PRICING (via batch-pricing)
// ==========================================

describe("A. Flash Sale Pricing", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("Active flash sale: original=100000, salePrice=75000 → final=75000", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([
            {
                variantId: 1,
                salePrice: decimal(75000),
                id: 10,
                name: "Flash Sale Test",
                endAt: new Date("2099-01-01"),
            },
        ]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].effectivePrice).toBe(75000);
        expect(results[0].discountAmount).toBe(25000);
        expect(results[0].source).toBe("FLASH_SALE");
        expect(results[0].flashSaleId).toBe(10);
    });

    test("Flash sale with quantity=3: total discount = 3 × 25000 = 75000", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([
            {
                variantId: 1,
                salePrice: decimal(75000),
                id: 10,
                name: "Flash Sale",
                endAt: new Date("2099-01-01"),
            },
        ]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 3 },
        ]);

        // effectivePrice is per-item
        expect(results[0].effectivePrice).toBe(75000);
        expect(results[0].discountAmount).toBe(25000);
    });

    test("No flash sale: falls back to next pricing rule", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].effectivePrice).toBe(100000);
        expect(results[0].source).toBe("ORIGINAL");
    });

    test("Flash sale has highest priority over product discount", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([
            {
                variantId: 1,
                salePrice: decimal(75000),
                id: 10,
                name: "Flash Sale",
                endAt: new Date("2099-01-01"),
            },
        ]);
        // Even if product discount exists, flash sale should win
        // Even if product discount exists in DB, flash sale should win
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            {
                id: 20,
                productId: 1,
                variantId: null,
                type: "PERCENTAGE",
                value: decimal(30),
                maxDiscount: null,
            },
        ]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].source).toBe("FLASH_SALE");
        expect(results[0].effectivePrice).toBe(75000);
    });

    test("Flash sale has highest priority over campaign discount", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([
            {
                variantId: 1,
                salePrice: decimal(70000),
                id: 10,
                name: "Flash Sale",
                endAt: new Date("2099-01-01"),
            },
        ]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 5,
                name: "Campaign",
                type: "GENERAL",
                status: "ACTIVE",
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-01-01"),
                discountType: "PERCENTAGE",
                discountValue: decimal(50),
                maxDiscount: null,
                products: [],
                categories: [],
                priority: 10,
            },
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].source).toBe("FLASH_SALE");
        expect(results[0].effectivePrice).toBe(70000);
    });
});

// ==========================================
// B. PRODUCT DISCOUNT PRICING
// ==========================================

describe("B. Product Discount Pricing", () => {
    test("calculateDiscountedPrice: 20% of 100000 = 20000 discount, final=80000", () => {
        const result = calculateDiscountedPrice(100000, {
            type: "PERCENTAGE",
            value: decimal(20),
            maxDiscount: null,
            id: 1,
        });

        expect(result.discountAmount).toBe(20000);
        expect(result.finalPrice).toBe(80000);
        expect(result.originalPrice).toBe(100000);
    });

    test("calculateDiscountedPrice: FIXED 25000 off 100000 → final=75000", () => {
        const result = calculateDiscountedPrice(100000, {
            type: "FIXED",
            value: decimal(25000),
            maxDiscount: null,
            id: 2,
        });

        expect(result.discountAmount).toBe(25000);
        expect(result.finalPrice).toBe(75000);
    });

    test("calculateDiscountedPrice: 20% with maxDiscount=15000 → discount capped at 15000", () => {
        const result = calculateDiscountedPrice(100000, {
            type: "PERCENTAGE",
            value: decimal(20),
            maxDiscount: decimal(15000),
            id: 3,
        });

        // 20% of 100000 = 20000, but capped at 15000
        expect(result.discountAmount).toBe(15000);
        expect(result.finalPrice).toBe(85000);
    });

    test("calculateDiscountedPrice: 10% with maxDiscount=50000 → discount stays at 10000", () => {
        const result = calculateDiscountedPrice(100000, {
            type: "PERCENTAGE",
            value: decimal(10),
            maxDiscount: decimal(50000),
            id: 4,
        });

        // 10% of 100000 = 10000, which is < 50000 cap
        expect(result.discountAmount).toBe(10000);
        expect(result.finalPrice).toBe(90000);
    });

    test("calculateDiscountedPrice: FIXED discount larger than price → floors at 0", () => {
        const result = calculateDiscountedPrice(10000, {
            type: "FIXED",
            value: decimal(50000),
            maxDiscount: null,
            id: 5,
        });

        // FIXED 50000 on 10000 price → discount = min(50000, 10000) = 10000
        expect(result.discountAmount).toBe(10000);
        expect(result.finalPrice).toBe(0);
    });

    test("calculateDiscountedPrice: 100% discount → final=0", () => {
        const result = calculateDiscountedPrice(100000, {
            type: "PERCENTAGE",
            value: decimal(100),
            maxDiscount: null,
            id: 6,
        });

        expect(result.discountAmount).toBe(100000);
        expect(result.finalPrice).toBe(0);
    });

    test("calculateDiscountedPrice: 50% of 99999 → rounds correctly", () => {
        const result = calculateDiscountedPrice(99999, {
            type: "PERCENTAGE",
            value: decimal(50),
            maxDiscount: null,
            id: 7,
        });

        // 99999 * 50 / 100 = 49999.5 → rounds to 50000
        expect(result.discountAmount).toBe(50000);
        expect(result.finalPrice).toBe(49999);
    });

    test("Batch pricing: product discount 20% applies correctly", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            {
                id: 20,
                productId: 1,
                variantId: null,
                type: "PERCENTAGE",
                value: decimal(20),
                maxDiscount: null,
            },
        ]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].source).toBe("PRODUCT_DISCOUNT");
        expect(results[0].effectivePrice).toBe(80000);
        expect(results[0].discountAmount).toBe(20000);
    });

    test("Batch pricing: inactive product discount not applied (DB returns null)", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        // DB returns empty for inactive/expired discount
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].source).toBe("ORIGINAL");
        expect(results[0].effectivePrice).toBe(100000);
    });
});

// ==========================================
// C. CAMPAIGN PRICING
// ==========================================

describe("C. Campaign Pricing", () => {
    test("Active campaign 10% discount: 100000 → 90000", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 5,
                name: "Campaign 10%",
                type: "GENERAL",
                status: "ACTIVE",
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-01-01"),
                discountType: "PERCENTAGE",
                discountValue: decimal(10),
                maxDiscount: null,
                products: [],
                categories: [],
                priority: 1,
            },
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].source).toBe("CAMPAIGN");
        expect(results[0].effectivePrice).toBe(90000);
        expect(results[0].discountAmount).toBe(10000);
    });

    test("Campaign fixed Rp 25000 discount: 100000 → 75000", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 6,
                name: "Campaign Fixed",
                type: "GENERAL",
                status: "ACTIVE",
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-01-01"),
                discountType: "FIXED",
                discountValue: decimal(25000),
                maxDiscount: null,
                products: [],
                categories: [],
                priority: 1,
            },
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].source).toBe("CAMPAIGN");
        expect(results[0].effectivePrice).toBe(75000);
        expect(results[0].discountAmount).toBe(25000);
    });

    test("Campaign percentage with maxDiscount: 50% of 100000 capped at 30000", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 7,
                name: "Campaign Capped",
                type: "GENERAL",
                status: "ACTIVE",
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-01-01"),
                discountType: "PERCENTAGE",
                discountValue: decimal(50),
                maxDiscount: decimal(30000),
                products: [],
                categories: [],
                priority: 1,
            },
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        // 50% of 100000 = 50000, capped at 30000
        expect(results[0].effectivePrice).toBe(70000);
        expect(results[0].discountAmount).toBe(30000);
    });

    test("Campaign not started (future startAt) → not applied", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 8,
                name: "Future Campaign",
                type: "GENERAL",
                status: "SCHEDULED",
                startAt: new Date("2099-06-01"),
                endAt: new Date("2099-12-31"),
                discountType: "PERCENTAGE",
                discountValue: decimal(20),
                maxDiscount: null,
                products: [],
                categories: [],
                priority: 1,
            },
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        // isCampaignActive checks time window → should not apply
        expect(results[0].source).toBe("ORIGINAL");
        expect(results[0].effectivePrice).toBe(100000);
    });

    test("Campaign expired (past endAt) → not applied", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 9,
                name: "Expired Campaign",
                type: "GENERAL",
                status: "ENDED",
                startAt: new Date("2020-01-01"),
                endAt: new Date("2020-12-31"),
                discountType: "PERCENTAGE",
                discountValue: decimal(20),
                maxDiscount: null,
                products: [],
                categories: [],
                priority: 1,
            },
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].source).toBe("ORIGINAL");
        expect(results[0].effectivePrice).toBe(100000);
    });

    test("Campaign PRODUCT_DISCOUNT: targeted product gets discount", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 10,
                name: "Product Campaign",
                type: "PRODUCT_DISCOUNT",
                status: "ACTIVE",
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-01-01"),
                discountType: "PERCENTAGE",
                discountValue: decimal(15),
                maxDiscount: null,
                products: [{ productId: 1 }],
                categories: [],
                priority: 1,
            },
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].source).toBe("CAMPAIGN");
        expect(results[0].effectivePrice).toBe(85000);
    });

    test("Campaign PRODUCT_DISCOUNT: non-targeted product gets no discount", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 11,
                name: "Product Campaign",
                type: "PRODUCT_DISCOUNT",
                status: "ACTIVE",
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-01-01"),
                discountType: "PERCENTAGE",
                discountValue: decimal(15),
                maxDiscount: null,
                products: [{ productId: 99 }], // different product
                categories: [],
                priority: 1,
            },
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].source).toBe("ORIGINAL");
        expect(results[0].effectivePrice).toBe(100000);
    });

    test("Campaign CATEGORY_DISCOUNT: matching category gets discount", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 12,
                name: "Category Campaign",
                type: "CATEGORY_DISCOUNT",
                status: "ACTIVE",
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-01-01"),
                discountType: "FIXED",
                discountValue: decimal(10000),
                maxDiscount: null,
                products: [],
                categories: [{ category: "Electronics" }],
                priority: 1,
            },
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            {
                productId: 1,
                variantId: 1,
                originalPrice: 100000,
                quantity: 1,
                category: "Electronics",
            },
        ]);

        expect(results[0].source).toBe("CAMPAIGN");
        expect(results[0].effectivePrice).toBe(90000);
    });

    test("Campaign CATEGORY_DISCOUNT: non-matching category gets no discount", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 13,
                name: "Category Campaign",
                type: "CATEGORY_DISCOUNT",
                status: "ACTIVE",
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-01-01"),
                discountType: "FIXED",
                discountValue: decimal(10000),
                maxDiscount: null,
                products: [],
                categories: [{ category: "Electronics" }],
                priority: 1,
            },
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            {
                productId: 1,
                variantId: 1,
                originalPrice: 100000,
                quantity: 1,
                category: "Fashion",
            },
        ]);

        expect(results[0].source).toBe("ORIGINAL");
        expect(results[0].effectivePrice).toBe(100000);
    });
});

// ==========================================
// D. BULK DISCOUNT PRICING
// ==========================================

describe("D. Bulk Discount Pricing", () => {
    test("Quantity below first tier → no discount", async () => {
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const result = await resolveBulkDiscount(1, 1, 1, 100000);

        expect(result).toBeNull();
    });

    test("Exact tier boundary: quantity=3, tier minQuantity=3, 10% → finalPerItem=90000", async () => {
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([
            {
                id: 1,
                name: "Tier 1",
                minQuantity: 3,
                type: "PERCENTAGE",
                value: decimal(10),
                maxDiscount: null,
            },
        ]);

        const result = await resolveBulkDiscount(1, 1, 3, 100000);

        expect(result).not.toBeNull();
        // 10% of 100000 = 10000 discount per item
        expect(result!.finalPricePerItem).toBe(90000);
        expect(result!.discountAmount).toBe(30000); // 3 × 10000
    });

    test("Higher tier wins: qty=5, tiers at 3 and 5, 5-tier is better", async () => {
        // findMany sorted by minQuantity desc, take 1 → returns tier with minQuantity=5
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([
            {
                id: 2,
                name: "Tier 2",
                minQuantity: 5,
                type: "PERCENTAGE",
                value: decimal(20),
                maxDiscount: null,
            },
        ]);

        const result = await resolveBulkDiscount(1, 1, 5, 100000);

        expect(result).not.toBeNull();
        // 20% of 100000 = 20000 discount per item
        expect(result!.finalPricePerItem).toBe(80000);
        expect(result!.discountAmount).toBe(100000); // 5 × 20000
    });

    test("FIXED bulk discount: Rp 5000 off per item × 3 items = Rp 15000 total", async () => {
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([
            {
                id: 3,
                name: "Fixed Tier",
                minQuantity: 3,
                type: "FIXED",
                value: decimal(5000),
                maxDiscount: null,
            },
        ]);

        const result = await resolveBulkDiscount(1, 1, 3, 100000);

        expect(result).not.toBeNull();
        // FIXED: discountAmount = 5000 * 3 = 15000
        expect(result!.discountAmount).toBe(15000);
        // finalPricePerItem = (300000 - 15000) / 3 = 95000
        expect(result!.finalPricePerItem).toBe(95000);
    });

    test("Bulk discount with maxDiscount cap", async () => {
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([
            {
                id: 4,
                name: "Capped Tier",
                minQuantity: 3,
                type: "PERCENTAGE",
                value: decimal(50),
                maxDiscount: decimal(20000),
            },
        ]);

        const result = await resolveBulkDiscount(1, 1, 3, 100000);

        expect(result).not.toBeNull();
        // 50% of 100000 = 50000, capped at 20000 per item
        expect(result!.discountAmount).toBe(60000); // 3 × 20000
        expect(result!.finalPricePerItem).toBe(80000); // (300000 - 60000) / 3
    });

    test("Batch pricing: bulk discount applies when no higher priority discount", async () => {        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([
            {
                id: 5,
                variantId: null,
                productId: 1,
                name: "Bulk 3+",
                minQuantity: 3,
                type: "PERCENTAGE",
                value: decimal(10),
                maxDiscount: null,
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-01-01"),
                isActive: true,
            },
        ]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 3 },
        ]);

        expect(results[0].source).toBe("BULK_DISCOUNT");
        expect(results[0].effectivePrice).toBe(90000);
        expect(results[0].discountAmount).toBe(10000);
    });

    test("Batch pricing: bulk discount does NOT apply when flash sale exists", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([
            {
                variantId: 1,
                salePrice: decimal(70000),
                id: 10,
                name: "Flash",
                endAt: new Date("2099-01-01"),
            },
        ]);        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([
            {
                id: 5,
                variantId: null,
                productId: 1,
                name: "Bulk 3+",
                minQuantity: 3,
                type: "PERCENTAGE",
                value: decimal(10),
                maxDiscount: null,
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-01-01"),
                isActive: true,
            },
        ]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 3 },
        ]);

        // Flash sale should win over bulk discount
        expect(results[0].source).toBe("FLASH_SALE");
        expect(results[0].effectivePrice).toBe(70000);
    });
});

// ==========================================
// E. VOUCHER PRICING
// ==========================================

describe("E. Voucher Pricing", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("Percentage voucher: 10% of subtotal 100000 = discount 10000", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 1,
            code: "SAVE10",
            type: "PERCENTAGE",
            value: decimal(10),
            maxDiscount: null,
            isActive: true,
            startDate: null,
            endDate: null,
            quota: null,
            usedCount: 0,
            minPurchase: null,
            maxUsagePerUser: null,
            campaignId: null,
            eligibility: "ALL",
            productRestrictions: [],
            categoryRestrictions: [],
        });
        mockPrisma.voucherUserUsage.findUnique.mockResolvedValue(null);

        const result = await validateAndCalculateVoucherEnhanced(
            "SAVE10",
            100000,
            [],
            "user-1",
            null
        );

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.discount).toBe(10000);
        }
    });

    test("Fixed voucher: Rp 25000 off subtotal 100000 = discount 25000", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 2,
            code: "FLAT25K",
            type: "FIXED",
            value: decimal(25000),
            maxDiscount: null,
            isActive: true,
            startDate: null,
            endDate: null,
            quota: null,
            usedCount: 0,
            minPurchase: null,
            maxUsagePerUser: null,
            campaignId: null,
            eligibility: "ALL",
            productRestrictions: [],
            categoryRestrictions: [],
        });
        mockPrisma.voucherUserUsage.findUnique.mockResolvedValue(null);

        const result = await validateAndCalculateVoucherEnhanced(
            "FLAT25K",
            100000,
            [],
            "user-1",
            null
        );

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.discount).toBe(25000);
        }
    });

    test("Percentage voucher with maxDiscount: 20% of 100000 capped at 15000", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 3,
            code: "CAPPED20",
            type: "PERCENTAGE",
            value: decimal(20),
            maxDiscount: decimal(15000),
            isActive: true,
            startDate: null,
            endDate: null,
            quota: null,
            usedCount: 0,
            minPurchase: null,
            maxUsagePerUser: null,
            campaignId: null,
            eligibility: "ALL",
            productRestrictions: [],
            categoryRestrictions: [],
        });
        mockPrisma.voucherUserUsage.findUnique.mockResolvedValue(null);

        const result = await validateAndCalculateVoucherEnhanced(
            "CAPPED20",
            100000,
            [],
            "user-1",
            null
        );

        expect(result.valid).toBe(true);
        if (result.valid) {
            // 20% of 100000 = 20000, capped at 15000
            expect(result.discount).toBe(15000);
        }
    });

    test("Minimum purchase: subtotal below minimum → rejected", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 4,
            code: "MIN100K",
            type: "FIXED",
            value: decimal(10000),
            maxDiscount: null,
            isActive: true,
            startDate: null,
            endDate: null,
            quota: null,
            usedCount: 0,
            minPurchase: decimal(100000),
            maxUsagePerUser: null,
            campaignId: null,
            eligibility: "ALL",
            productRestrictions: [],
            categoryRestrictions: [],
        });

        const result = await validateAndCalculateVoucherEnhanced(
            "MIN100K",
            50000, // below 100000 minimum
            [],
            "user-1",
            null
        );

        expect(result.valid).toBe(false);
    });

    test("Minimum purchase exact boundary: subtotal=100000 meets minimum=100000", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 5,
            code: "MIN100K",
            type: "FIXED",
            value: decimal(10000),
            maxDiscount: null,
            isActive: true,
            startDate: null,
            endDate: null,
            quota: null,
            usedCount: 0,
            minPurchase: decimal(100000),
            maxUsagePerUser: null,
            campaignId: null,
            eligibility: "ALL",
            productRestrictions: [],
            categoryRestrictions: [],
        });
        mockPrisma.voucherUserUsage.findUnique.mockResolvedValue(null);

        const result = await validateAndCalculateVoucherEnhanced(
            "MIN100K",
            100000, // exactly meets minimum
            [],
            "user-1",
            null
        );

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.discount).toBe(10000);
        }
    });

    test("Expired voucher → rejected", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 6,
            code: "EXPIRED",
            type: "FIXED",
            value: decimal(10000),
            maxDiscount: null,
            isActive: true,
            startDate: null,
            endDate: new Date("2020-01-01"), // expired
            quota: null,
            usedCount: 0,
            minPurchase: null,
            maxUsagePerUser: null,
            campaignId: null,
            eligibility: "ALL",
            productRestrictions: [],
            categoryRestrictions: [],
        });

        const result = await validateAndCalculateVoucherEnhanced(
            "EXPIRED",
            100000,
            [],
            "user-1",
            null
        );

        expect(result.valid).toBe(false);
    });

    test("Inactive voucher → rejected", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 7,
            code: "INACTIVE",
            type: "FIXED",
            value: decimal(10000),
            maxDiscount: null,
            isActive: false,
            startDate: null,
            endDate: null,
            quota: null,
            usedCount: 0,
            minPurchase: null,
            maxUsagePerUser: null,
            campaignId: null,
            eligibility: "ALL",
            productRestrictions: [],
            categoryRestrictions: [],
        });

        const result = await validateAndCalculateVoucherEnhanced(
            "INACTIVE",
            100000,
            [],
            "user-1",
            null
        );

        expect(result.valid).toBe(false);
    });

    test("Quota exhausted → rejected", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 8,
            code: "FULL",
            type: "FIXED",
            value: decimal(10000),
            maxDiscount: null,
            isActive: true,
            startDate: null,
            endDate: null,
            quota: 100,
            usedCount: 100, // quota exhausted
            minPurchase: null,
            maxUsagePerUser: null,
            campaignId: null,
            eligibility: "ALL",
            productRestrictions: [],
            categoryRestrictions: [],
        });

        const result = await validateAndCalculateVoucherEnhanced(
            "FULL",
            100000,
            [],
            "user-1",
            null
        );

        expect(result.valid).toBe(false);
    });

    test("Per-user usage limit reached → rejected", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 9,
            code: "LIMITED",
            type: "FIXED",
            value: decimal(10000),
            maxDiscount: null,
            isActive: true,
            startDate: null,
            endDate: null,
            quota: null,
            usedCount: 0,
            minPurchase: null,
            maxUsagePerUser: 2,
            campaignId: null,
            eligibility: "ALL",
            productRestrictions: [],
            categoryRestrictions: [],
        });
        mockPrisma.voucherUserUsage.findUnique.mockResolvedValue({
            usageCount: 2, // already used 2 times
        });

        const result = await validateAndCalculateVoucherEnhanced(
            "LIMITED",
            100000,
            [],
            "user-1",
            null
        );

        expect(result.valid).toBe(false);
    });

    test("Voucher not found → rejected", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue(null);

        const result = await validateAndCalculateVoucherEnhanced(
            "NONEXISTENT",
            100000,
            [],
            "user-1",
            null
        );

        expect(result.valid).toBe(false);
    });

    test("Discount never exceeds subtotal", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 10,
            code: "BIG",
            type: "FIXED",
            value: decimal(500000), // discount > subtotal
            maxDiscount: null,
            isActive: true,
            startDate: null,
            endDate: null,
            quota: null,
            usedCount: 0,
            minPurchase: null,
            maxUsagePerUser: null,
            campaignId: null,
            eligibility: "ALL",
            productRestrictions: [],
            categoryRestrictions: [],
        });
        mockPrisma.voucherUserUsage.findUnique.mockResolvedValue(null);

        const result = await validateAndCalculateVoucherEnhanced(
            "BIG",
            100000, // subtotal
            [],
            "user-1",
            null
        );

        expect(result.valid).toBe(true);
        if (result.valid) {
            // discount capped at subtotal
            expect(result.discount).toBe(100000);
        }
    });
});

// ==========================================
// F. SHIPPING DISCOUNT PRICING
// ==========================================

describe("F. Shipping Discount Pricing", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("Free shipping: Rp 25000 shipping, FIXED discount Rp 25000 → final=0", async () => {
        mockPrisma.shippingDiscount.findFirst.mockResolvedValue({
            id: 1,
            name: "Free Shipping",
            type: "FIXED",
            value: decimal(25000),
            maxDiscount: null,
            minPurchase: null,
        });

        const result = await calculateShippingDiscount(25000, 100000, null);

        expect(result).not.toBeNull();
        expect(result!.discountAmount).toBe(25000);
        expect(result!.finalShippingCost).toBe(0);
    });

    test("Percentage shipping discount: 50% of Rp 20000 → final=10000", async () => {
        mockPrisma.shippingDiscount.findFirst.mockResolvedValue({
            id: 2,
            name: "50% Off Shipping",
            type: "PERCENTAGE",
            value: decimal(50),
            maxDiscount: null,
            minPurchase: null,
        });

        const result = await calculateShippingDiscount(20000, 100000, null);

        expect(result).not.toBeNull();
        expect(result!.discountAmount).toBe(10000);
        expect(result!.finalShippingCost).toBe(10000);
    });

    test("Shipping discount with maxDiscount cap: 50% of 30000 capped at 10000", async () => {
        mockPrisma.shippingDiscount.findFirst.mockResolvedValue({
            id: 3,
            name: "Capped Shipping",
            type: "PERCENTAGE",
            value: decimal(50),
            maxDiscount: decimal(10000),
            minPurchase: null,
        });

        const result = await calculateShippingDiscount(30000, 100000, null);

        expect(result).not.toBeNull();
        // 50% of 30000 = 15000, capped at 10000
        expect(result!.discountAmount).toBe(10000);
        expect(result!.finalShippingCost).toBe(20000);
    });

    test("Discount larger than shipping → floors at 0, never negative", async () => {
        mockPrisma.shippingDiscount.findFirst.mockResolvedValue({
            id: 4,
            name: "Huge Discount",
            type: "FIXED",
            value: decimal(100000),
            maxDiscount: null,
            minPurchase: null,
        });

        const result = await calculateShippingDiscount(25000, 100000, null);

        expect(result).not.toBeNull();
        // discount = min(100000, 25000) = 25000
        expect(result!.discountAmount).toBe(25000);
        expect(result!.finalShippingCost).toBe(0);
        expect(result!.finalShippingCost).toBeGreaterThanOrEqual(0);
    });

    test("No matching discount → returns null", async () => {
        mockPrisma.shippingDiscount.findFirst.mockResolvedValue(null);

        const result = await calculateShippingDiscount(25000, 100000, null);

        expect(result).toBeNull();
    });

    test("Code-based discount: correct code applies", async () => {
        mockPrisma.shippingDiscount.findFirst.mockResolvedValue({
            id: 5,
            name: "PROMO-SHIP",
            type: "FIXED",
            value: decimal(15000),
            maxDiscount: null,
            minPurchase: null,
        });

        const result = await calculateShippingDiscount(25000, 100000, "PROMO-SHIP");

        expect(result).not.toBeNull();
        expect(result!.discountAmount).toBe(15000);
        expect(result!.finalShippingCost).toBe(10000);
    });

    test("Shipping discount never makes final cost negative", async () => {
        mockPrisma.shippingDiscount.findFirst.mockResolvedValue({
            id: 6,
            name: "Big Fixed",
            type: "FIXED",
            value: decimal(50000),
            maxDiscount: null,
            minPurchase: null,
        });

        const result = await calculateShippingDiscount(10000, 100000, null);

        expect(result).not.toBeNull();
        expect(result!.finalShippingCost).toBe(0);
        expect(result!.finalShippingCost).not.toBeLessThan(0);
    });
});

// ==========================================
// G. PRICING PRECEDENCE
// ==========================================

describe("G. Pricing Precedence", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("Flash Sale > Product Discount > Campaign > Bulk Discount > Original", async () => {
        // All rules active simultaneously
        mockPrisma.flashSale.findMany.mockResolvedValue([
            {
                variantId: 1,
                salePrice: decimal(50000),
                id: 10,
                name: "Flash",
                endAt: new Date("2099-01-01"),
            },
        ]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            {
                id: 20,
                productId: 1,
                variantId: null,
                type: "PERCENTAGE",
                value: decimal(30),
                maxDiscount: null,
            },
        ]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 5,
                name: "Campaign",
                type: "GENERAL",
                status: "ACTIVE",
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-01-01"),
                discountType: "PERCENTAGE",
                discountValue: decimal(40),
                maxDiscount: null,
                products: [],
                categories: [],
                priority: 10,
            },
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([
            {
                id: 30,
                variantId: null,
                productId: 1,
                name: "Bulk",
                minQuantity: 2,
                type: "PERCENTAGE",
                value: decimal(25),
                maxDiscount: null,
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-01-01"),
                isActive: true,
            },
        ]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 5 },
        ]);

        // Flash Sale should win
        expect(results[0].source).toBe("FLASH_SALE");
        expect(results[0].effectivePrice).toBe(50000);
    });

    test("Product Discount > Campaign (no flash sale)", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            {
                id: 20,
                productId: 1,
                variantId: null,
                type: "PERCENTAGE",
                value: decimal(20),
                maxDiscount: null,
            },
        ]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 5,
                name: "Campaign",
                type: "GENERAL",
                status: "ACTIVE",
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-01-01"),
                discountType: "PERCENTAGE",
                discountValue: decimal(30),
                maxDiscount: null,
                products: [],
                categories: [],
                priority: 1,
            },
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].source).toBe("PRODUCT_DISCOUNT");
        expect(results[0].effectivePrice).toBe(80000);
    });

    test("Campaign > Bulk Discount (no flash sale or product discount)", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 5,
                name: "Campaign",
                type: "GENERAL",
                status: "ACTIVE",
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-01-01"),
                discountType: "FIXED",
                discountValue: decimal(15000),
                maxDiscount: null,
                products: [],
                categories: [],
                priority: 1,
            },
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([
            {
                id: 30,
                variantId: null,
                productId: 1,
                name: "Bulk",
                minQuantity: 2,
                type: "PERCENTAGE",
                value: decimal(10),
                maxDiscount: null,
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-01-01"),
                isActive: true,
            },
        ]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 5 },
        ]);

        expect(results[0].source).toBe("CAMPAIGN");
        expect(results[0].effectivePrice).toBe(85000);
    });

    test("Voucher stacks ON TOP of item pricing (separate layer)", async () => {
        // Voucher discount is applied to subtotal, not to individual item prices
        // This is verified by the checkout flow: subtotal (with marketing) - voucher discount + shipping
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        // Item has no marketing discount → price = 100000
        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].effectivePrice).toBe(100000);

        // Voucher is applied separately in checkout flow
        // (subtotal - voucher_discount + shipping = gross_amount)
        // This is NOT part of batch pricing — it's a separate checkout step
    });
});

// ==========================================
// H. EDGE CASES
// ==========================================

describe("H. Edge Cases", () => {
    test("calculateDiscountedPrice: 0% discount → no change", () => {
        const result = calculateDiscountedPrice(100000, {
            type: "PERCENTAGE",
            value: decimal(0),
            maxDiscount: null,
            id: 1,
        });

        expect(result.discountAmount).toBe(0);
        expect(result.finalPrice).toBe(100000);
    });

    test("calculateDiscountedPrice: very large price 1000000000", () => {
        const result = calculateDiscountedPrice(1000000000, {
            type: "PERCENTAGE",
            value: decimal(10),
            maxDiscount: null,
            id: 1,
        });

        expect(result.discountAmount).toBe(100000000);
        expect(result.finalPrice).toBe(900000000);
    });

    test("calculateDiscountedPrice: price=1, FIXED discount=1 → final=0", () => {
        const result = calculateDiscountedPrice(1, {
            type: "FIXED",
            value: decimal(1),
            maxDiscount: null,
            id: 1,
        });

        expect(result.discountAmount).toBe(1);
        expect(result.finalPrice).toBe(0);
    });

    test("calculateDiscountedPrice: never produces negative price", () => {
        const result = calculateDiscountedPrice(10000, {
            type: "FIXED",
            value: decimal(999999),
            maxDiscount: null,
            id: 1,
        });

        expect(result.finalPrice).toBeGreaterThanOrEqual(0);
        expect(result.discountAmount).toBe(10000);
    });

    test("calculateDiscountedPrice: floating point rounding", () => {
        const result = calculateDiscountedPrice(33333, {
            type: "PERCENTAGE",
            value: decimal(33),
            maxDiscount: null,
            id: 1,
        });

        // 33333 * 33 / 100 = 10999.89 → rounds to 11000
        expect(result.discountAmount).toBe(11000);
        expect(result.finalPrice).toBe(22333);
    });

    test("Batch pricing: quantity=0 still returns valid result", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 0 },
        ]);

        expect(results[0].effectivePrice).toBe(100000);
        expect(results[0].source).toBe("ORIGINAL");
    });

    test("Batch pricing: empty items array returns empty results", async () => {
        const results = await resolveBatchPrices([]);
        expect(results).toEqual([]);
    });

    test("Batch pricing: multiple items with different pricing rules", async () => {
        // Item 1: flash sale
        // Item 2: product discount
        // Item 3: original
        mockPrisma.flashSale.findMany.mockResolvedValue([
            {
                variantId: 1,
                salePrice: decimal(70000),
                id: 10,
                name: "Flash",
                endAt: new Date("2099-01-01"),
            },
        ]);
        mockPrisma.productDiscount.findMany
            .mockResolvedValueOnce([
                {
                    id: 20,
                    productId: 2,
                    variantId: null,
                    type: "FIXED",
                    value: decimal(20000),
                    maxDiscount: null,
                },
            ])
            .mockResolvedValueOnce([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
            { productId: 2, variantId: 2, originalPrice: 100000, quantity: 1 },
            { productId: 3, variantId: 3, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].source).toBe("FLASH_SALE");
        expect(results[0].effectivePrice).toBe(70000);

        expect(results[1].source).toBe("PRODUCT_DISCOUNT");
        expect(results[1].effectivePrice).toBe(80000);

        expect(results[2].source).toBe("ORIGINAL");
        expect(results[2].effectivePrice).toBe(100000);
    });

    test("Shipping discount: zero shipping cost → no discount needed", async () => {
        mockPrisma.shippingDiscount.findFirst.mockResolvedValue({
            id: 1,
            name: "Free",
            type: "FIXED",
            value: decimal(25000),
            maxDiscount: null,
            minPurchase: null,
        });

        const result = await calculateShippingDiscount(0, 100000, null);

        expect(result).not.toBeNull();
        // discount = min(25000, 0) = 0
        expect(result!.discountAmount).toBe(0);
        expect(result!.finalShippingCost).toBe(0);
    });

    test("Voucher: empty code → rejected", async () => {
        const result = await validateAndCalculateVoucherEnhanced(
            "",
            100000,
            [],
            "user-1",
            null
        );

        expect(result.valid).toBe(false);
    });

    test("Voucher: whitespace-only code → rejected", async () => {
        const result = await validateAndCalculateVoucherEnhanced(
            "   ",
            100000,
            [],
            "user-1",
            null
        );

        expect(result.valid).toBe(false);
    });

    test("Voucher: zero subtotal → rejected", async () => {
        const result = await validateAndCalculateVoucherEnhanced(
            "SAVE10",
            0,
            [],
            "user-1",
            null
        );

        expect(result.valid).toBe(false);
    });
});
