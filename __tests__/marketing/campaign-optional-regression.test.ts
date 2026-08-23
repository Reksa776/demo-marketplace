/**
 * ==========================================
 * CAMPAIGN OPTIONAL — RUNTIME REGRESSION TESTS
 * ==========================================
 *
 * 14 regression test cases verifying that:
 * - All marketing features work WITHOUT Campaign
 * - Campaign remains functional WITH Campaign
 * - Pricing priority is preserved
 * - Checkout/BuyNow flows work correctly
 *
 * Run: npx jest __tests__/marketing/campaign-optional-regression.test.ts
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
    voucherProduct: {
        findMany: jest.fn().mockResolvedValue([]),
    },
    voucherCategory: {
        findMany: jest.fn().mockResolvedValue([]),
    },
};

jest.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

// ==========================================
// IMPORTS (after mock setup)
// ==========================================

import {
    resolveBatchPrices,
    resolveOrderCampaignId,
} from "@/lib/marketing/batch-pricing";
import {
    validateAndCalculateVoucherEnhanced,
    validateAndCalculateVoucher,
} from "@/lib/voucher";
import {
    isCampaignActive,
} from "@/lib/marketing/campaign";
import {
    calculateShippingDiscount,
} from "@/lib/marketing/shipping-discount";

// ==========================================
// HELPERS
// ==========================================

function decimal(value: number) {
    return { toString: () => String(value), valueOf: () => value } as any;
}

function makeVoucher(overrides: Partial<any> = {}) {
    return {
        id: 1,
        code: "SAVE10",
        type: "PERCENTAGE",
        value: decimal(10),
        maxDiscount: decimal(50000),
        minPurchase: decimal(50000),
        quota: 100,
        usedCount: 0,
        isActive: true,
        startDate: null,
        endDate: null,
        campaignId: null,
        maxUsagePerUser: null,
        eligibility: "ALL",
        productRestrictions: [],
        categoryRestrictions: [],
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

function makeShippingDiscount(overrides: Partial<any> = {}) {
    return {
        id: 1,
        name: "Free Shipping",
        code: null,
        type: "FIXED",
        value: decimal(25000),
        maxDiscount: null,
        minPurchase: null,
        startAt: new Date("2020-01-01"),
        endAt: new Date("2099-12-31"),
        isActive: true,
        ...overrides,
    };
}

// ==========================================
// 1. VOUCHER STANDALONE (NO CAMPAIGN)
// ==========================================

describe("1. Voucher standalone (no Campaign)", () => {
    beforeEach(() => jest.clearAllMocks());

    test("Voucher without campaignId validates successfully", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue(
            makeVoucher({ campaignId: null })
        );
        mockPrisma.voucherUserUsage.findUnique.mockResolvedValue(null);

        const result = await validateAndCalculateVoucherEnhanced(
            "SAVE10",
            100000,
            [{ productId: 1, variantId: 1, quantity: 1, price: 100000 }],
            "user-1",
            null, // no campaign
            mockPrisma as any
        );

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.discount).toBe(10000);
        }
    });

    test("Voucher without campaignId skips campaign restriction entirely", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue(
            makeVoucher({ campaignId: null })
        );
        mockPrisma.voucherUserUsage.findUnique.mockResolvedValue(null);

        // campaign.findUnique should NOT be called for voucher validation
        // when voucher.campaignId is null
        const result = await validateAndCalculateVoucherEnhanced(
            "SAVE10",
            100000,
            [{ productId: 1, variantId: 1, quantity: 1, price: 100000 }],
            "user-1",
            null,
            mockPrisma as any
        );

        expect(result.valid).toBe(true);
        // campaign.findUnique should NOT have been called
        expect(mockPrisma.campaign.findUnique).not.toHaveBeenCalled();
    });
});

// ==========================================
// 2. VOUCHER WITH CAMPAIGN
// ==========================================

describe("2. Voucher with Campaign", () => {
    beforeEach(() => jest.clearAllMocks());

    test("Campaign-specific voucher validates when correct campaignId passed", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue(
            makeVoucher({ campaignId: 99 })
        );
        mockPrisma.campaign.findUnique.mockResolvedValue(
            makeCampaign({ id: 99 })
        );
        mockPrisma.voucherUserUsage.findUnique.mockResolvedValue(null);

        const result = await validateAndCalculateVoucherEnhanced(
            "SAVE10",
            100000,
            [{ productId: 1, variantId: 1, quantity: 1, price: 100000 }],
            "user-1",
            99, // correct campaign
            mockPrisma as any
        );

        expect(result.valid).toBe(true);
    });

    test("Campaign-specific voucher FAILS when campaignId is null", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue(
            makeVoucher({ campaignId: 99 })
        );
        mockPrisma.campaign.findUnique.mockResolvedValue(
            makeCampaign({ id: 99 })
        );

        const result = await validateAndCalculateVoucherEnhanced(
            "SAVE10",
            100000,
            [{ productId: 1, variantId: 1, quantity: 1, price: 100000 }],
            "user-1",
            null, // no campaign passed
            mockPrisma as any
        );

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.message).toContain("kampanye");
        }
    });

    test("Campaign-specific voucher FAILS when wrong campaignId passed", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue(
            makeVoucher({ campaignId: 99 })
        );
        mockPrisma.campaign.findUnique.mockResolvedValue(
            makeCampaign({ id: 99 })
        );

        const result = await validateAndCalculateVoucherEnhanced(
            "SAVE10",
            100000,
            [{ productId: 1, variantId: 1, quantity: 1, price: 100000 }],
            "user-1",
            50, // wrong campaign
            mockPrisma as any
        );

        expect(result.valid).toBe(false);
    });
});

// ==========================================
// 3. PRODUCT DISCOUNT (NO CAMPAIGN)
// ==========================================

describe("3. Product Discount (no Campaign)", () => {
    beforeEach(() => jest.clearAllMocks());

    test("Product discount applies without campaign", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            makeProductDiscount(),
        ]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].source).toBe("PRODUCT_DISCOUNT");
        expect(results[0].discountAmount).toBe(20000);
        expect(results[0].effectivePrice).toBe(80000);
        expect(results[0].campaignId).toBeNull();
    });
});

// ==========================================
// 4. FLASH SALE (NO CAMPAIGN)
// ==========================================

describe("4. Flash Sale (no Campaign)", () => {
    beforeEach(() => jest.clearAllMocks());

    test("Flash sale applies without campaign", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([
            makeFlashSale(),
        ]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(results[0].source).toBe("FLASH_SALE");
        expect(results[0].effectivePrice).toBe(75000);
        expect(results[0].campaignId).toBeNull();
    });
});

// ==========================================
// 5. BULK DISCOUNT (NO CAMPAIGN)
// ==========================================

describe("5. Bulk Discount (no Campaign)", () => {
    beforeEach(() => jest.clearAllMocks());

    test("Bulk discount applies without campaign when quantity meets minimum", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([
            makeBulkDiscount({ minQuantity: 3 }),
        ]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 5 },
        ]);

        expect(results[0].source).toBe("BULK_DISCOUNT");
        expect(results[0].discountAmount).toBeGreaterThan(0);
        expect(results[0].campaignId).toBeNull();
    });

    test("Bulk discount does NOT apply when quantity below minimum", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([
            makeBulkDiscount({ minQuantity: 3 }),
        ]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 2 },
        ]);

        expect(results[0].source).toBe("ORIGINAL");
        expect(results[0].discountAmount).toBe(0);
    });
});

// ==========================================
// 6. SHIPPING DISCOUNT (NO CAMPAIGN)
// ==========================================

describe("6. Shipping Discount (no Campaign)", () => {
    beforeEach(() => jest.clearAllMocks());

    test("Shipping discount applies without campaign", async () => {
        mockPrisma.shippingDiscount.findFirst.mockResolvedValue(
            makeShippingDiscount()
        );

        const result = await calculateShippingDiscount(
            25000,
            100000,
            null,
            new Date("2025-06-01")
        );

        expect(result).not.toBeNull();
        if (result) {
            expect(result.discountAmount).toBe(25000);
            expect(result.finalShippingCost).toBe(0);
        }
    });
});

// ==========================================
// 7. VOUCHER + PRODUCT DISCOUNT (NO CAMPAIGN)
// ==========================================

describe("7. Voucher + Product Discount (no Campaign)", () => {
    beforeEach(() => jest.clearAllMocks());

    test("Product discount applied via pricing, voucher applied separately", async () => {
        // Pricing gives product discount
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            makeProductDiscount({ value: decimal(20) }),
        ]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const pricingResults = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(pricingResults[0].source).toBe("PRODUCT_DISCOUNT");
        expect(pricingResults[0].effectivePrice).toBe(80000);

        // Voucher validates independently
        mockPrisma.voucher.findUnique.mockResolvedValue(
            makeVoucher({ campaignId: null, value: decimal(10) })
        );
        mockPrisma.voucherUserUsage.findUnique.mockResolvedValue(null);

        const voucherResult = await validateAndCalculateVoucherEnhanced(
            "SAVE10",
            80000, // subtotal after product discount
            [{ productId: 1, variantId: 1, quantity: 1, price: 80000 }],
            "user-1",
            null,
            mockPrisma as any
        );

        expect(voucherResult.valid).toBe(true);
        if (voucherResult.valid) {
            expect(voucherResult.discount).toBe(8000); // 10% of 80000
        }
    });
});

// ==========================================
// 8. VOUCHER + FLASH SALE (NO CAMPAIGN)
// ==========================================

describe("8. Voucher + Flash Sale (no Campaign)", () => {
    beforeEach(() => jest.clearAllMocks());

    test("Flash sale applied via pricing, voucher applied separately", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([
            makeFlashSale({ salePrice: decimal(75000) }),
        ]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const pricingResults = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(pricingResults[0].source).toBe("FLASH_SALE");
        expect(pricingResults[0].effectivePrice).toBe(75000);

        // Voucher validates independently
        mockPrisma.voucher.findUnique.mockResolvedValue(
            makeVoucher({ campaignId: null, value: decimal(10) })
        );
        mockPrisma.voucherUserUsage.findUnique.mockResolvedValue(null);

        const voucherResult = await validateAndCalculateVoucherEnhanced(
            "SAVE10",
            75000,
            [{ productId: 1, variantId: 1, quantity: 1, price: 75000 }],
            "user-1",
            null,
            mockPrisma as any
        );

        expect(voucherResult.valid).toBe(true);
        if (voucherResult.valid) {
            expect(voucherResult.discount).toBe(7500); // 10% of 75000
        }
    });
});

// ==========================================
// 9. VOUCHER + BULK DISCOUNT (NO CAMPAIGN)
// ==========================================

describe("9. Voucher + Bulk Discount (no Campaign)", () => {
    beforeEach(() => jest.clearAllMocks());

    test("Bulk discount applied via pricing, voucher applied separately", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([
            makeBulkDiscount({ minQuantity: 3, value: decimal(15) }),
        ]);

        const pricingResults = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 5 },
        ]);

        expect(pricingResults[0].source).toBe("BULK_DISCOUNT");

        // Voucher validates independently
        mockPrisma.voucher.findUnique.mockResolvedValue(
            makeVoucher({ campaignId: null, value: decimal(10) })
        );
        mockPrisma.voucherUserUsage.findUnique.mockResolvedValue(null);

        const effectivePrice = pricingResults[0].effectivePrice;
        const voucherResult = await validateAndCalculateVoucherEnhanced(
            "SAVE10",
            effectivePrice,
            [{ productId: 1, variantId: 1, quantity: 1, price: effectivePrice }],
            "user-1",
            null,
            mockPrisma as any
        );

        expect(voucherResult.valid).toBe(true);
    });
});

// ==========================================
// 10. VOUCHER + SHIPPING DISCOUNT (NO CAMPAIGN)
// ==========================================

describe("10. Voucher + Shipping Discount (no Campaign)", () => {
    beforeEach(() => jest.clearAllMocks());

    test("Shipping discount and voucher both apply independently", async () => {
        // Shipping discount
        mockPrisma.shippingDiscount.findFirst.mockResolvedValue(
            makeShippingDiscount({ value: decimal(15000) })
        );

        const shippingResult = await calculateShippingDiscount(
            25000,
            100000,
            null,
            new Date("2025-06-01")
        );

        expect(shippingResult).not.toBeNull();
        if (shippingResult) {
            expect(shippingResult.discountAmount).toBe(15000);
            expect(shippingResult.finalShippingCost).toBe(10000);
        }

        // Voucher
        mockPrisma.voucher.findUnique.mockResolvedValue(
            makeVoucher({ campaignId: null, value: decimal(10) })
        );
        mockPrisma.voucherUserUsage.findUnique.mockResolvedValue(null);

        const voucherResult = await validateAndCalculateVoucherEnhanced(
            "SAVE10",
            100000,
            [{ productId: 1, variantId: 1, quantity: 1, price: 100000 }],
            "user-1",
            null,
            mockPrisma as any
        );

        expect(voucherResult.valid).toBe(true);
    });
});

// ==========================================
// 11. EXISTING CAMPAIGN + VOUCHER STILL WORKS
// ==========================================

describe("11. Existing Campaign + Voucher still works", () => {
    beforeEach(() => jest.clearAllMocks());

    test("Campaign discount applied via pricing, campaign-specific voucher validates", async () => {
        // Campaign pricing
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            makeCampaign({ id: 10, discountValue: decimal(10) }),
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const pricingResults = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(pricingResults[0].source).toBe("CAMPAIGN");
        expect(pricingResults[0].campaignId).toBe(10);

        // Campaign-specific voucher validates
        mockPrisma.voucher.findUnique.mockResolvedValue(
            makeVoucher({ campaignId: 10, value: decimal(5) })
        );
        mockPrisma.campaign.findUnique.mockResolvedValue(
            makeCampaign({ id: 10 })
        );
        mockPrisma.voucherUserUsage.findUnique.mockResolvedValue(null);

        const voucherResult = await validateAndCalculateVoucherEnhanced(
            "SAVE10",
            90000, // subtotal after 10% campaign discount
            [{ productId: 1, variantId: 1, quantity: 1, price: 90000 }],
            "user-1",
            10, // correct campaign
            mockPrisma as any
        );

        expect(voucherResult.valid).toBe(true);
    });

    test("resolveOrderCampaignId returns correct campaign for products", async () => {
        mockPrisma.campaign.findMany.mockResolvedValue([
            makeCampaign({ id: 10, type: "PRODUCT_DISCOUNT", products: [{ productId: 1 }] }),
        ]);

        const campaignId = await resolveOrderCampaignId([
            { productId: 1 },
        ]);

        expect(campaignId).toBe(10);
    });
});

// ==========================================
// 12. PRICING PRIORITY PRESERVED
// ==========================================

describe("12. Pricing priority preserved (no stacking)", () => {
    beforeEach(() => jest.clearAllMocks());

    test("Flash Sale beats Product Discount", async () => {
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

        expect(results[0].source).toBe("FLASH_SALE");
        expect(results[0].effectivePrice).toBe(70000);
    });

    test("Product Discount beats Campaign", async () => {
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

        expect(results[0].source).toBe("PRODUCT_DISCOUNT");
        expect(results[0].effectivePrice).toBe(80000);
    });

    test("Campaign beats Bulk Discount", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            makeCampaign({ discountValue: decimal(10) }),
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([
            makeBulkDiscount({ minQuantity: 1, value: decimal(20) }),
        ]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 5 },
        ]);

        expect(results[0].source).toBe("CAMPAIGN");
        expect(results[0].effectivePrice).toBe(90000);
    });

    test("Single pricing rule wins per item (no stacking)", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([
            makeFlashSale({ salePrice: decimal(70000) }),
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

        // Only one source wins
        expect(results[0].source).toBe("FLASH_SALE");
        // Discount is NOT cumulative — only flash sale discount
        expect(results[0].discountAmount).toBe(30000); // 100000 - 70000
        expect(results[0].effectivePrice).toBe(70000);
    });
});

// ==========================================
// 13. resolveOrderCampaignId RETURNS NULL WHEN NO CAMPAIGN
// ==========================================

describe("13. resolveOrderCampaignId returns null when no campaign exists", () => {
    beforeEach(() => jest.clearAllMocks());

    test("Returns null when no active campaigns", async () => {
        mockPrisma.campaign.findMany.mockResolvedValue([]);

        const result = await resolveOrderCampaignId([
            { productId: 1 },
        ]);

        expect(result).toBeNull();
    });

    test("Returns null when campaign has no discount config", async () => {
        mockPrisma.campaign.findMany.mockResolvedValue([
            makeCampaign({ discountType: null, discountValue: null }),
        ]);

        const result = await resolveOrderCampaignId([
            { productId: 1 },
        ]);

        expect(result).toBeNull();
    });
});

// ==========================================
// 14. IS CAMPAIGN ACTIVE UTILITY
// ==========================================

describe("14. Campaign utility functions", () => {
    test("isCampaignActive returns true for active campaign", () => {
        const campaign = makeCampaign({
            status: "ACTIVE",
            startAt: new Date("2020-01-01"),
            endAt: new Date("2099-12-31"),
        }) as any;

        expect(isCampaignActive(campaign, new Date("2025-06-01"))).toBe(true);
    });

    test("isCampaignActive returns false for ended campaign", () => {
        const campaign = makeCampaign({
            status: "ACTIVE",
            startAt: new Date("2020-01-01"),
            endAt: new Date("2024-12-31"),
        }) as any;

        expect(isCampaignActive(campaign, new Date("2025-06-01"))).toBe(false);
    });

    test("isCampaignActive returns false for future campaign", () => {
        const campaign = makeCampaign({
            status: "ACTIVE",
            startAt: new Date("2030-01-01"),
            endAt: new Date("2099-12-31"),
        }) as any;

        expect(isCampaignActive(campaign, new Date("2025-06-01"))).toBe(false);
    });

    test("isCampaignActive returns false for draft campaign", () => {
        const campaign = makeCampaign({
            status: "DRAFT",
            startAt: new Date("2020-01-01"),
            endAt: new Date("2099-12-31"),
        }) as any;

        expect(isCampaignActive(campaign, new Date("2025-06-01"))).toBe(false);
    });
});
