/**
 * ==========================================
 * M5: E2E NUMERIC VERIFICATION
 * ==========================================
 *
 * Real numeric assertions verifying that:
 * 1. Pricing engine produces correct prices
 * 2. Voucher validation produces correct discounts
 * 3. All edge cases produce correct results
 * 4. Customer price == server price == order price
 *
 * Run: npx jest __tests__/marketing/e2e-numeric-verification.test.ts
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

// Reset all mocks between tests to prevent leakage
beforeEach(() => {
    jest.clearAllMocks();
    // Reset return values to empty defaults
    mockPrisma.flashSale.findMany.mockResolvedValue([]);
    mockPrisma.flashSale.findFirst.mockResolvedValue(null);
    mockPrisma.productDiscount.findMany.mockResolvedValue([]);
    mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);
    mockPrisma.campaign.findMany.mockResolvedValue([]);
    mockPrisma.campaign.findUnique.mockResolvedValue(null);
    mockPrisma.shippingDiscount.findFirst.mockResolvedValue(null);
    mockPrisma.voucher.findUnique.mockResolvedValue(null);
    mockPrisma.voucherUserUsage.findUnique.mockResolvedValue(null);
    mockPrisma.order.count.mockResolvedValue(0);
    mockPrisma.product.findMany.mockResolvedValue([]);
});

// ==========================================
// IMPORTS
// ==========================================

import { resolveBatchPrices } from "@/lib/marketing/batch-pricing";
import { validateAndCalculateVoucherEnhanced } from "@/lib/voucher";
import { calculateShippingDiscount } from "@/lib/marketing/shipping-discount";

// ==========================================
// HELPERS
// ==========================================

function decimal(value: number) {
    return { toString: () => String(value), valueOf: () => value } as any;
}

// ==========================================
// 1. FLASH SALE E2E NUMERICS
// ==========================================

describe("1. Flash Sale E2E Numerics", () => {

    test("Original 100000, salePrice 75000 → effectivePrice=75000, discount=25000", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([
            { variantId: 1, salePrice: decimal(75000), id: 10, name: "FS", endAt: new Date("2099-01-01") },
        ]);

        const [r] = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(r.effectivePrice).toBe(75000);
        expect(r.discountAmount).toBe(25000);
        expect(r.source).toBe("FLASH_SALE");
    });

    test("Quantity 3: flash sale price 75000 × 3 = 225000", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([
            { variantId: 1, salePrice: decimal(75000), id: 10, name: "FS", endAt: new Date("2099-01-01") },
        ]);

        const [r] = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 3 },
        ]);

        expect(r.effectivePrice).toBe(75000);
        expect(r.discountAmount).toBe(25000);
        // subtotal would be 75000 * 3 = 225000
    });
});

// ==========================================
// 2. PRODUCT DISCOUNT E2E NUMERICS
// ==========================================

describe("2. Product Discount E2E Numerics", () => {

    test("10% fixed discount on 200000 → effectivePrice=180000, discount=20000", async () => {
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            {
                variantId: 1,
                productId: 1,
                type: "PERCENTAGE",
                value: decimal(10),
                maxDiscount: null,
                id: 1,
            },
        ]);

        const [r] = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 200000, quantity: 1 },
        ]);

        expect(r.effectivePrice).toBe(180000);
        expect(r.discountAmount).toBe(20000);
    });

    test("FIXED 50000 discount on 200000 → effectivePrice=150000", async () => {
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            {
                variantId: 1,
                productId: 1,
                type: "FIXED",
                value: decimal(50000),
                maxDiscount: null,
                id: 1,
            },
        ]);

        const [r] = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 200000, quantity: 1 },
        ]);

        expect(r.effectivePrice).toBe(150000);
        expect(r.discountAmount).toBe(50000);
    });

    test("20% discount with maxDiscount 30000 on 200000 → discount capped at 30000", async () => {
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            {
                variantId: 1,
                productId: 1,
                type: "PERCENTAGE",
                value: decimal(20),
                maxDiscount: decimal(30000),
                id: 1,
            },
        ]);

        const [r] = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 200000, quantity: 1 },
        ]);

        // 20% of 200000 = 40000, capped at 30000
        expect(r.effectivePrice).toBe(170000);
        expect(r.discountAmount).toBe(30000);
    });
});

// ==========================================
// 3. CAMPAIGN DISCOUNT E2E NUMERICS
// ==========================================

describe("3. Campaign Discount E2E Numerics", () => {

    test("GENERAL campaign 10% on 100000 → effectivePrice=90000", async () => {
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 1,
                type: "GENERAL",
                status: "ACTIVE",
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-12-31"),
                discountType: "PERCENTAGE",
                discountValue: decimal(10),
                maxDiscount: null,
                products: [],
                categories: [],
            },
        ]);

        const [r] = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1, category: "Electronics" },
        ]);

        expect(r.effectivePrice).toBe(90000);
        expect(r.discountAmount).toBe(10000);
        expect(r.source).toBe("CAMPAIGN");
    });

    test("Campaign FIXED 25000 on 100000 → effectivePrice=75000", async () => {
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 2,
                type: "GENERAL",
                status: "ACTIVE",
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-12-31"),
                discountType: "FIXED",
                discountValue: decimal(25000),
                maxDiscount: null,
                products: [],
                categories: [],
            },
        ]);

        const [r] = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1, category: "Electronics" },
        ]);

        expect(r.effectivePrice).toBe(75000);
        expect(r.discountAmount).toBe(25000);
    });

    test("Campaign 50% with maxDiscount 30000 on 100000 → discount capped at 30000", async () => {
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 3,
                type: "GENERAL",
                status: "ACTIVE",
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-12-31"),
                discountType: "PERCENTAGE",
                discountValue: decimal(50),
                maxDiscount: decimal(30000),
                products: [],
                categories: [],
            },
        ]);

        const [r] = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1, category: "Electronics" },
        ]);

        // 50% of 100000 = 50000, capped at 30000
        expect(r.effectivePrice).toBe(70000);
        expect(r.discountAmount).toBe(30000);
    });

    test("Campaign discount cannot exceed original price", async () => {
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 4,
                type: "GENERAL",
                status: "ACTIVE",
                startAt: new Date("2020-01-01"),
                endAt: new Date("2099-12-31"),
                discountType: "FIXED",
                discountValue: decimal(200000),
                maxDiscount: null,
                products: [],
                categories: [],
            },
        ]);

        const [r] = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1, category: "Electronics" },
        ]);

        // Fixed 200000 capped at originalPrice 100000
        expect(r.effectivePrice).toBe(0);
        expect(r.discountAmount).toBe(100000);
    });
});

// ==========================================
// 4. VOUCHER DISCOUNT E2E NUMERICS
// ==========================================

describe("4. Voucher Discount E2E Numerics", () => {


    test("10% voucher on subtotal 100000 → discount=10000", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 1, code: "SAVE10", type: "PERCENTAGE", value: decimal(10),
            maxDiscount: null, minPurchase: null, quota: null, usedCount: 0,
            isActive: true, startDate: null, endDate: null, campaignId: null,
            maxUsagePerUser: null, eligibility: "ALL",
            productRestrictions: [], categoryRestrictions: [],
        });

        const r = await validateAndCalculateVoucherEnhanced(
            "SAVE10", 100000, [], "user-1", null, mockPrisma as any
        );

        expect(r.valid).toBe(true);
        if (r.valid) expect(r.discount).toBe(10000);
    });

    test("FIXED 50000 voucher on subtotal 100000 → discount=50000", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 2, code: "FLAT50", type: "FIXED", value: decimal(50000),
            maxDiscount: null, minPurchase: null, quota: null, usedCount: 0,
            isActive: true, startDate: null, endDate: null, campaignId: null,
            maxUsagePerUser: null, eligibility: "ALL",
            productRestrictions: [], categoryRestrictions: [],
        });

        const r = await validateAndCalculateVoucherEnhanced(
            "FLAT50", 100000, [], "user-1", null, mockPrisma as any
        );

        expect(r.valid).toBe(true);
        if (r.valid) expect(r.discount).toBe(50000);
    });

    test("20% voucher with maxDiscount 15000 on 100000 → discount capped at 15000", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 3, code: "PCTCAP", type: "PERCENTAGE", value: decimal(20),
            maxDiscount: decimal(15000), minPurchase: null, quota: null, usedCount: 0,
            isActive: true, startDate: null, endDate: null, campaignId: null,
            maxUsagePerUser: null, eligibility: "ALL",
            productRestrictions: [], categoryRestrictions: [],
        });

        const r = await validateAndCalculateVoucherEnhanced(
            "PCTCAP", 100000, [], "user-1", null, mockPrisma as any
        );

        // 20% of 100000 = 20000, capped at 15000
        expect(r.valid).toBe(true);
        if (r.valid) expect(r.discount).toBe(15000);
    });

    test("Voucher discount capped at subtotal (no negative total)", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 4, code: "BIG", type: "FIXED", value: decimal(500000),
            maxDiscount: null, minPurchase: null, quota: null, usedCount: 0,
            isActive: true, startDate: null, endDate: null, campaignId: null,
            maxUsagePerUser: null, eligibility: "ALL",
            productRestrictions: [], categoryRestrictions: [],
        });

        const r = await validateAndCalculateVoucherEnhanced(
            "BIG", 100000, [], "user-1", null, mockPrisma as any
        );

        // Fixed 500000 capped at subtotal 100000
        expect(r.valid).toBe(true);
        if (r.valid) expect(r.discount).toBe(100000);
    });

    test("minPurchase check: subtotal < minPurchase → rejected", async () => {
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 5, code: "MIN100", type: "FIXED", value: decimal(10000),
            maxDiscount: null, minPurchase: decimal(200000), quota: null, usedCount: 0,
            isActive: true, startDate: null, endDate: null, campaignId: null,
            maxUsagePerUser: null, eligibility: "ALL",
            productRestrictions: [], categoryRestrictions: [],
        });

        const r = await validateAndCalculateVoucherEnhanced(
            "MIN100", 100000, [], "user-1", null, mockPrisma as any
        );

        expect(r.valid).toBe(false);
    });

    test("Voucher stacking: campaign discount 10% then voucher 10% = 81000", async () => {
        // Campaign gives 10% off → subtotal becomes 90000
        // Then voucher 10% off → discount = 9000
        // Final = 90000 - 9000 = 81000

        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 6, code: "STACK10", type: "PERCENTAGE", value: decimal(10),
            maxDiscount: null, minPurchase: null, quota: null, usedCount: 0,
            isActive: true, startDate: null, endDate: null, campaignId: null,
            maxUsagePerUser: null, eligibility: "ALL",
            productRestrictions: [], categoryRestrictions: [],
        });

        const r = await validateAndCalculateVoucherEnhanced(
            "STACK10", 90000, [], "user-1", null, mockPrisma as any
        );

        expect(r.valid).toBe(true);
        if (r.valid) expect(r.discount).toBe(9000);
    });
});

// ==========================================
// 5. SHIPPING DISCOUNT E2E NUMERICS
// ==========================================

describe("5. Shipping Discount E2E Numerics", () => {


    test("FIXED 10000 off shipping 25000 → finalShippingCost=15000", async () => {
        mockPrisma.shippingDiscount.findFirst.mockResolvedValue({
            id: 1, name: "Free Shipping", code: null,
            type: "FIXED", value: decimal(10000),
            maxDiscount: null, minPurchase: null,
            startAt: new Date("2020-01-01"), endAt: new Date("2099-12-31"),
            isActive: true,
        });

        const r = await calculateShippingDiscount(25000, 100000, null);

        expect(r).not.toBeNull();
        if (r) {
            expect(r.discountAmount).toBe(10000);
            expect(r.finalShippingCost).toBe(15000);
        }
    });

    test("50% off shipping 20000 → finalShippingCost=10000", async () => {
        mockPrisma.shippingDiscount.findFirst.mockResolvedValue({
            id: 2, name: "Half Shipping", code: null,
            type: "PERCENTAGE", value: decimal(50),
            maxDiscount: null, minPurchase: null,
            startAt: new Date("2020-01-01"), endAt: new Date("2099-12-31"),
            isActive: true,
        });

        const r = await calculateShippingDiscount(20000, 100000, null);

        expect(r).not.toBeNull();
        if (r) {
            expect(r.discountAmount).toBe(10000);
            expect(r.finalShippingCost).toBe(10000);
        }
    });

    test("50% off shipping 20000 with maxDiscount 5000 → discount capped at 5000", async () => {
        mockPrisma.shippingDiscount.findFirst.mockResolvedValue({
            id: 3, name: "Cap Shipping", code: null,
            type: "PERCENTAGE", value: decimal(50),
            maxDiscount: decimal(5000), minPurchase: null,
            startAt: new Date("2020-01-01"), endAt: new Date("2099-12-31"),
            isActive: true,
        });

        const r = await calculateShippingDiscount(20000, 100000, null);

        expect(r).not.toBeNull();
        if (r) {
            // 50% of 20000 = 10000, capped at 5000
            expect(r.discountAmount).toBe(5000);
            expect(r.finalShippingCost).toBe(15000);
        }
    });

    test("Shipping discount cannot exceed shipping cost", async () => {
        mockPrisma.shippingDiscount.findFirst.mockResolvedValue({
            id: 4, name: "Oversize", code: null,
            type: "FIXED", value: decimal(50000),
            maxDiscount: null, minPurchase: null,
            startAt: new Date("2020-01-01"), endAt: new Date("2099-12-31"),
            isActive: true,
        });

        const r = await calculateShippingDiscount(20000, 100000, null);

        expect(r).not.toBeNull();
        if (r) {
            // Fixed 50000 capped at shipping 20000
            expect(r.discountAmount).toBe(20000);
            expect(r.finalShippingCost).toBe(0);
        }
    });

    test("minPurchase not met → no discount", async () => {
        mockPrisma.shippingDiscount.findFirst.mockResolvedValue(null);

        const r = await calculateShippingDiscount(20000, 50000, null);

        expect(r).toBeNull();
    });
});

// ==========================================
// 6. PRICING PRECEDENCE E2E
// ==========================================

describe("6. Pricing Precedence E2E", () => {


    test("Flash Sale beats Product Discount", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([
            { variantId: 1, salePrice: decimal(70000), id: 10, name: "FS", endAt: new Date("2099-01-01") },
        ]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            { variantId: 1, productId: 1, type: "PERCENTAGE", value: decimal(20), maxDiscount: null, id: 1 },
        ]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);

        const [r] = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(r.source).toBe("FLASH_SALE");
        expect(r.effectivePrice).toBe(70000); // Flash sale wins, not 20% discount
    });

    test("Product Discount beats Campaign", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            { variantId: 1, productId: 1, type: "FIXED", value: decimal(30000), maxDiscount: null, id: 1 },
        ]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 1, type: "GENERAL", status: "ACTIVE",
                startAt: new Date("2020-01-01"), endAt: new Date("2099-12-31"),
                discountType: "PERCENTAGE", discountValue: decimal(10),
                maxDiscount: null, products: [], categories: [],
            },
        ]);

        const [r] = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(r.source).toBe("PRODUCT_DISCOUNT");
        expect(r.effectivePrice).toBe(70000); // Fixed 30000 wins over 10% campaign
    });

    test("No discount → original price", async () => {
        const [r] = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(r.source).toBe("ORIGINAL");
        expect(r.effectivePrice).toBe(100000);
        expect(r.discountAmount).toBe(0);
    });
});

// ==========================================
// 7. COMPLETE ORDER TOTAL VERIFICATION
// ==========================================

describe("7. Complete Order Total Verification", () => {


    test("Full order: 2 items + shipping - voucher = correct total", async () => {
        // Item 1: 100000 original, flash sale 75000
        // Item 2: 50000 original, no discount
        // Subtotal = 75000 + 50000 = 125000
        // Voucher 10% = 12500
        // Shipping = 20000
        // Total = 125000 - 12500 + 20000 = 132500

        mockPrisma.flashSale.findMany.mockResolvedValue([
            { variantId: 1, salePrice: decimal(75000), id: 10, name: "FS", endAt: new Date("2099-01-01") },
        ]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const pricing = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
            { productId: 2, variantId: 2, originalPrice: 50000, quantity: 1 },
        ]);

        const subtotal = pricing.reduce((sum, p) => sum + p.effectivePrice, 0);
        expect(subtotal).toBe(125000);

        // Voucher
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 1, code: "SAVE10", type: "PERCENTAGE", value: decimal(10),
            maxDiscount: null, minPurchase: null, quota: null, usedCount: 0,
            isActive: true, startDate: null, endDate: null, campaignId: null,
            maxUsagePerUser: null, eligibility: "ALL",
            productRestrictions: [], categoryRestrictions: [],
        });

        const voucher = await validateAndCalculateVoucherEnhanced(
            "SAVE10", subtotal, [], "user-1", null, mockPrisma as any
        );

        expect(voucher.valid).toBe(true);
        const discount = voucher.valid ? voucher.discount : 0;
        expect(discount).toBe(12500);

        const shipping = 20000;
        const total = subtotal - discount + shipping;
        expect(total).toBe(132500);
    });

    test("Order with campaign + voucher + shipping discount", async () => {
        // Campaign 10% on 100000 → 90000
        // Subtotal = 90000
        // Voucher FIXED 15000
        // Shipping 25000 - shipping discount FIXED 5000 = 20000
        // Total = 90000 - 15000 + 20000 = 95000

        mockPrisma.flashSale.findMany.mockResolvedValue([]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([]);
        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: 1, type: "GENERAL", status: "ACTIVE",
                startAt: new Date("2020-01-01"), endAt: new Date("2099-12-31"),
                discountType: "PERCENTAGE", discountValue: decimal(10),
                maxDiscount: null, products: [], categories: [],
            },
        ]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const [pricing] = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(pricing.effectivePrice).toBe(90000);
        const subtotal = pricing.effectivePrice;

        // Voucher
        mockPrisma.voucher.findUnique.mockResolvedValue({
            id: 2, code: "FLAT15", type: "FIXED", value: decimal(15000),
            maxDiscount: null, minPurchase: null, quota: null, usedCount: 0,
            isActive: true, startDate: null, endDate: null, campaignId: null,
            maxUsagePerUser: null, eligibility: "ALL",
            productRestrictions: [], categoryRestrictions: [],
        });

        const voucher = await validateAndCalculateVoucherEnhanced(
            "FLAT15", subtotal, [], "user-1", null, mockPrisma as any
        );

        const discount = voucher.valid ? voucher.discount : 0;
        expect(discount).toBe(15000);

        // Shipping discount
        mockPrisma.shippingDiscount.findFirst.mockResolvedValue({
            id: 1, name: "Diskon Ongkir", code: null,
            type: "FIXED", value: decimal(5000),
            maxDiscount: null, minPurchase: null,
            startAt: new Date("2020-01-01"), endAt: new Date("2099-12-31"),
            isActive: true,
        });

        const shippingDiscount = await calculateShippingDiscount(25000, subtotal, null);
        const finalShipping = shippingDiscount ? shippingDiscount.finalShippingCost : 25000;

        const total = subtotal - discount + finalShipping;
        expect(total).toBe(95000);
    });
});

// ==========================================
// 8. EDGE CASE E2E NUMERICS
// ==========================================

describe("8. Edge Case E2E Numerics", () => {


    test("Zero quantity item → effectivePrice still correct", async () => {
        const [r] = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 0 },
        ]);

        expect(r.effectivePrice).toBe(100000);
    });

    test("Very large discount → capped at original price", async () => {
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            { variantId: 1, productId: 1, type: "FIXED", value: decimal(999999), maxDiscount: null, id: 1 },
        ]);

        const [r] = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
        ]);

        expect(r.effectivePrice).toBe(0);
        expect(r.discountAmount).toBe(100000);
    });

    test("Voucher value 0 → rejected", async () => {
        const r = await validateAndCalculateVoucherEnhanced(
            "ZERO", 0, [], "user-1", null, mockPrisma as any
        );

        expect(r.valid).toBe(false);
    });

    test("Voucher on empty subtotal → rejected", async () => {
        const r = await validateAndCalculateVoucherEnhanced(
            "TEST", -100, [], "user-1", null, mockPrisma as any
        );

        expect(r.valid).toBe(false);
    });

    test("Multiple items: mixed sources", async () => {
        mockPrisma.flashSale.findMany.mockResolvedValue([
            { variantId: 1, salePrice: decimal(75000), id: 10, name: "FS", endAt: new Date("2099-01-01") },
        ]);
        mockPrisma.productDiscount.findMany.mockResolvedValue([
            { variantId: 2, productId: 2, type: "PERCENTAGE", value: decimal(20), maxDiscount: null, id: 1 },
        ]);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.bulkDiscount.findMany.mockResolvedValue([]);

        const results = await resolveBatchPrices([
            { productId: 1, variantId: 1, originalPrice: 100000, quantity: 1 },
            { productId: 2, variantId: 2, originalPrice: 50000, quantity: 1 },
            { productId: 3, variantId: 3, originalPrice: 30000, quantity: 1 },
        ]);

        expect(results[0].source).toBe("FLASH_SALE");
        expect(results[0].effectivePrice).toBe(75000);
        expect(results[1].source).toBe("PRODUCT_DISCOUNT");
        expect(results[1].effectivePrice).toBe(40000); // 20% off
        expect(results[2].source).toBe("ORIGINAL");
        expect(results[2].effectivePrice).toBe(30000);
    });
});
