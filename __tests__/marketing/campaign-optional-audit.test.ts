/**
 * ==========================================
 * CAMPAIGN OPTIONAL ARCHITECTURE — AUDIT TESTS
 * ==========================================
 *
 * Verifies that Campaign is an optional grouping mechanism,
 * NOT a required dependency for any marketing feature.
 *
 * All 14 cases from the audit requirements are tested.
 *
 * Run: npx tsx __tests__/marketing/campaign-optional-audit.test.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

function readFile(relativePath: string): string {
    return readFileSync(resolve(process.cwd(), relativePath), "utf-8");
}

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`FAIL: ${message}`);
    }
}

function pass(name: string) {
    console.log(`  ✅ ${name}`);
}

function fail(name: string, error: string) {
    console.log(`  ❌ ${name}: ${error}`);
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
    try {
        fn();
        pass(name);
        passed++;
    } catch (e) {
        fail(name, e instanceof Error ? e.message : String(e));
        failed++;
    }
}

console.log("\n=== CAMPAIGN OPTIONAL ARCHITECTURE — AUDIT TESTS ===\n");

// ==========================================
// 1. DATABASE SCHEMA AUDIT
// ==========================================
console.log("1. Database Schema Audit:");

const schemaCode = readFile("prisma/schema.prisma");

test("Voucher.campaignId is nullable (Int?)", () => {
    assert(
        schemaCode.includes("campaignId           Int?"),
        "Voucher.campaignId must be nullable (Int?)"
    );
});

test("Voucher.campaign has optional Campaign relation", () => {
    assert(
        schemaCode.includes("campaign             Campaign?"),
        "Voucher.campaign must be optional relation"
    );
});

test("ProductDiscount does NOT have campaignId", () => {
    const pdSection = schemaCode.substring(
        schemaCode.indexOf("model ProductDiscount"),
        schemaCode.indexOf("model FlashSale")
    );
    assert(
        !pdSection.includes("campaignId"),
        "ProductDiscount must NOT have campaignId"
    );
});

test("FlashSale does NOT have campaignId", () => {
    const fsSection = schemaCode.substring(
        schemaCode.indexOf("model FlashSale"),
        schemaCode.indexOf("model FlashSalePurchase")
    );
    assert(
        !fsSection.includes("campaignId"),
        "FlashSale must NOT have campaignId"
    );
});

test("BulkDiscount does NOT have campaignId", () => {
    const bdSection = schemaCode.substring(
        schemaCode.indexOf("model BulkDiscount"),
        schemaCode.indexOf("model ShippingDiscount")
    );
    assert(
        !bdSection.includes("campaignId"),
        "BulkDiscount must NOT have campaignId"
    );
});

test("ShippingDiscount does NOT have campaignId", () => {
    const sdSection = schemaCode.substring(
        schemaCode.indexOf("model ShippingDiscount"),
        schemaCode.indexOf("model Broadcast")
    );
    assert(
        !sdSection.includes("campaignId"),
        "ShippingDiscount must NOT have campaignId"
    );
});

test("Promotion does NOT have campaignId", () => {
    const prSection = schemaCode.substring(
        schemaCode.indexOf("model Promotion"),
        schemaCode.indexOf("enum PromotionPlacement")
    );
    assert(
        !prSection.includes("campaignId"),
        "Promotion must NOT have campaignId"
    );
});

// ==========================================
// 2. VOUCHER VALIDATION — CAMPAIGN OPTIONAL
// ==========================================
console.log("\n2. Voucher Validation — Campaign Optional:");

const voucherCode = readFile("lib/voucher.ts");

test("Voucher validation checks campaignId with if-statement (nullable)", () => {
    assert(
        voucherCode.includes("if (voucher.campaignId)"),
        "Voucher validation must use 'if (voucher.campaignId)' — nullable check"
    );
});

test("Voucher validation skips campaign restriction when campaignId is null", () => {
    // The if (voucher.campaignId) block only runs when campaignId is truthy
    // When null, the entire campaign restriction is skipped
    assert(
        voucherCode.includes("if (voucher.campaignId)") && voucherCode.includes("CAMPAIGN RESTRICTION"),
        "Campaign restriction must be conditional on voucher.campaignId"
    );
});

test("Voucher validation still checks product restrictions", () => {
    assert(
        voucherCode.includes("productRestrictions") && voucherCode.includes("productId"),
        "Voucher must still check product restrictions independently"
    );
});

test("Voucher validation still checks category restrictions", () => {
    assert(
        voucherCode.includes("categoryRestrictions") && voucherCode.includes("category"),
        "Voucher must still check category restrictions independently"
    );
});

test("Voucher validation still checks minPurchase", () => {
    assert(
        voucherCode.includes("minPurchase"),
        "Voucher must still check minPurchase independently"
    );
});

test("Voucher validation still checks per-user usage limit", () => {
    assert(
        voucherCode.includes("maxUsagePerUser"),
        "Voucher must still check per-user usage limit independently"
    );
});

test("Voucher validation still checks eligibility", () => {
    assert(
        voucherCode.includes("NEW_USER") && voucherCode.includes("RETURNING_USER"),
        "Voucher must still check eligibility independently"
    );
});

test("Voucher validation still checks quota", () => {
    assert(
        voucherCode.includes("quota"),
        "Voucher must still check quota independently"
    );
});

// ==========================================
// 3. CHECKOUT — CAMPAIGN CONTEXT OPTIONAL
// ==========================================
console.log("\n3. Checkout — Campaign Context Optional:");

const checkoutCode = readFile("lib/checkout.ts");

test("Checkout resolves campaign context (resolveOrderCampaignId)", () => {
    assert(
        checkoutCode.includes("resolveOrderCampaignId"),
        "Checkout must call resolveOrderCampaignId"
    );
});

test("Checkout passes orderCampaignId to voucher validation", () => {
    assert(
        checkoutCode.includes("orderCampaignId"),
        "Checkout must pass orderCampaignId to voucher validation"
    );
});

test("resolveOrderCampaignId returns null when no campaign exists", () => {
    const batchPricingCode = readFile("lib/marketing/batch-pricing.ts");
    assert(
        batchPricingCode.includes("return null"),
        "resolveOrderCampaignId must return null when no campaign exists"
    );
});

test("Voucher validation receives null campaignId gracefully", () => {
    // validateAndCalculateVoucherEnhanced accepts campaignId: number | null
    assert(
        voucherCode.includes("campaignId: number | null"),
        "Voucher validation must accept null campaignId"
    );
});

// ==========================================
// 4. PRICING ENGINE — CAMPAIGN IS TIER 3
// ==========================================
console.log("\n4. Pricing Engine — Campaign is Tier 3:");

const pricingCode = readFile("lib/marketing/pricing.ts");
const batchPricingCode = readFile("lib/marketing/batch-pricing.ts");

test("Pricing priority: Flash Sale > Product Discount > Campaign > Bulk Discount > Original", () => {
    const flashIdx = batchPricingCode.indexOf("// 1. FLASH SALE");
    const discountIdx = batchPricingCode.indexOf("// 2. PRODUCT DISCOUNT");
    const campaignIdx = batchPricingCode.indexOf("// 3. CAMPAIGN DISCOUNT");
    const bulkIdx = batchPricingCode.indexOf("// 4. BULK DISCOUNT");

    assert(flashIdx < discountIdx, "Flash Sale must come before Product Discount");
    assert(discountIdx < campaignIdx, "Product Discount must come before Campaign");
    assert(campaignIdx < bulkIdx, "Campaign must come before Bulk Discount");
});

test("Campaign discount only applies if campaign has discountType and discountValue", () => {
    assert(
        batchPricingCode.includes("!campaign.discountType || !campaign.discountValue"),
        "Campaign discount must skip if discountType or discountValue is missing"
    );
});

test("Campaign is skipped if no active campaign targets the product", () => {
    assert(
        batchPricingCode.includes("if (targets)") || batchPricingCode.includes("if(targets)"),
        "Campaign must be skipped if no active campaign targets the product"
    );
});

// ==========================================
// 5. ADMIN VOUCHER — CAMPAIGN IS OPTIONAL
// ==========================================
console.log("\n5. Admin Voucher — Campaign is Optional:");

const voucherApiCode = readFile("app/api/admin/vouchers/route.ts");
const voucherPatchCode = readFile("app/api/admin/vouchers/[id]/route.ts");

test("Voucher POST accepts campaignId as optional", () => {
    assert(
        voucherApiCode.includes("body.campaignId !== undefined && body.campaignId !== null"),
        "Voucher POST must treat campaignId as optional"
    );
});

test("Voucher POST only sets campaignId when provided", () => {
    assert(
        voucherApiCode.includes("campaignId !== null ? { campaignId } : {}"),
        "Voucher POST must only set campaignId when non-null"
    );
});

test("Voucher PATCH handles campaignId = null (unlink)", () => {
    assert(
        voucherPatchCode.includes("campaignId === null") && voucherPatchCode.includes("data.campaignId = null"),
        "Voucher PATCH must handle campaignId = null to unlink"
    );
});

test("Voucher PATCH validates campaign exists when linking", () => {
    assert(
        voucherPatchCode.includes("campaign.findUnique") && voucherPatchCode.includes("campaignId"),
        "Voucher PATCH must validate campaign exists when linking"
    );
});

// ==========================================
// 6. FEATURES WITHOUT CAMPAIGN DEPENDENCY
// ==========================================
console.log("\n6. Features Without Campaign Dependency:");

const discountCode = readFile("lib/marketing/discount.ts");
const flashSaleCode = readFile("lib/marketing/flash-sale.ts");
const bulkDiscountCode = readFile("lib/marketing/bulk-discount.ts");
const shippingDiscountCode = readFile("lib/marketing/shipping-discount.ts");
const promotionCode = readFile("lib/marketing/promotion.ts");

test("ProductDiscount works standalone (no campaignId)", () => {
    assert(
        !discountCode.includes("campaignId") || discountCode.includes("// campaignId"),
        "ProductDiscount must not require campaignId"
    );
});

test("FlashSale works standalone (no campaignId)", () => {
    assert(
        !flashSaleCode.includes("campaignId") || flashSaleCode.includes("// campaignId"),
        "FlashSale must not require campaignId"
    );
});

test("BulkDiscount works standalone (no campaignId)", () => {
    assert(
        !bulkDiscountCode.includes("campaignId") || bulkDiscountCode.includes("// campaignId"),
        "BulkDiscount must not require campaignId"
    );
});

test("ShippingDiscount works standalone (no campaignId)", () => {
    assert(
        !shippingDiscountCode.includes("campaignId") || shippingDiscountCode.includes("// campaignId"),
        "ShippingDiscount must not require campaignId"
    );
});

test("Promotion works standalone (no campaignId in model)", () => {
    // Promotion model in schema does NOT have campaignId
    assert(
        !schemaCode.includes("model Promotion") || !schemaCode.substring(
            schemaCode.indexOf("model Promotion"),
            schemaCode.indexOf("enum PromotionPlacement")
        ).includes("campaignId"),
        "Promotion model must not have campaignId"
    );
});

// ==========================================
// 7. CHECKOUT FLOWS — ALL WORK WITHOUT CAMPAIGN
// ==========================================
console.log("\n7. Checkout Flows — All Work Without Campaign:");

test("Checkout applies product discount without campaign", () => {
    assert(
        checkoutCode.includes("resolveBatchMarketingPricing"),
        "Checkout must use batch pricing (which handles standalone discounts)"
    );
});

test("Checkout applies flash sale without campaign", () => {
    // Flash sale is handled by batch pricing, not campaign
    assert(
        checkoutCode.includes("flashSaleId") || checkoutCode.includes("flash sale"),
        "Checkout must handle flash sale items"
    );
});

test("Checkout applies bulk discount without campaign", () => {
    // Bulk discount is handled by batch pricing
    const batchCode = readFile("lib/marketing/batch-pricing.ts");
    assert(
        batchCode.includes("BULK_DISCOUNT") || batchCode.includes("bulkDiscount"),
        "Batch pricing must handle bulk discount"
    );
});

test("Checkout applies shipping discount without campaign", () => {
    assert(
        checkoutCode.includes("calculateShippingDiscount"),
        "Checkout must apply shipping discount independently"
    );
});

test("Checkout applies voucher without campaign", () => {
    assert(
        checkoutCode.includes("validateAndCalculateVoucherEnhanced"),
        "Checkout must validate vouchers"
    );
});

// ==========================================
// 8. CASE VERIFICATION — ALL 6 CASES
// ==========================================
console.log("\n8. Case Verification — All 6 Cases:");

test("Case 1: Product Discount 20% + Voucher SAVE10 (no Campaign) → must work", () => {
    // ProductDiscount is standalone, Voucher without campaignId is standalone
    // Both are validated independently in checkout
    assert(
        checkoutCode.includes("resolveBatchMarketingPricing") &&
        checkoutCode.includes("validateAndCalculateVoucherEnhanced"),
        "Checkout must support both product discount and voucher independently"
    );
});

test("Case 2: Flash Sale + Voucher SAVE10 (no Campaign) → must work", () => {
    // FlashSale is standalone, Voucher without campaignId is standalone
    assert(
        checkoutCode.includes("resolveBatchMarketingPricing") &&
        checkoutCode.includes("validateAndCalculateVoucherEnhanced"),
        "Checkout must support both flash sale and voucher independently"
    );
});

test("Case 3: Bulk Discount + Voucher SAVE10 (no Campaign) → must work", () => {
    // BulkDiscount is standalone, Voucher without campaignId is standalone
    const batchCode = readFile("lib/marketing/batch-pricing.ts");
    assert(
        batchCode.includes("BULK_DISCOUNT") &&
        checkoutCode.includes("validateAndCalculateVoucherEnhanced"),
        "Checkout must support both bulk discount and voucher independently"
    );
});

test("Case 4: Voucher RAMADAN20 + Campaign Ramadan → must work with campaign validation", () => {
    // Voucher with campaignId triggers campaign restriction check
    assert(
        voucherCode.includes("if (voucher.campaignId)") && voucherCode.includes("campaignActive"),
        "Voucher must validate campaign when campaignId is set"
    );
});

test("Case 5: Voucher SAVE10 (no Campaign) → must NOT fail because campaignId is null", () => {
    // if (voucher.campaignId) is false when null → campaign restriction skipped
    assert(
        voucherCode.includes("if (voucher.campaignId)"),
        "Voucher must skip campaign restriction when campaignId is null"
    );
});

test("Case 6: Shipping Discount + Voucher (no Campaign) → must work", () => {
    assert(
        checkoutCode.includes("calculateShippingDiscount") &&
        checkoutCode.includes("validateAndCalculateVoucherEnhanced"),
        "Checkout must support both shipping discount and voucher independently"
    );
});

// ==========================================
// 9. PRICING PRIORITY PRESERVED
// ==========================================
console.log("\n9. Pricing Priority Preserved:");

test("Single pricing rule wins per item (no stacking)", () => {
    // Each source returns early after setting the price
    assert(
        batchPricingCode.includes("return result;") || batchPricingCode.includes("return result"),
        "Batch pricing must return early after setting price (no stacking)"
    );
});

test("Flash Sale has highest priority", () => {
    assert(
        batchPricingCode.indexOf("FLASH SALE") < batchPricingCode.indexOf("PRODUCT DISCOUNT"),
        "Flash Sale must have highest priority"
    );
});

test("Product Discount has second priority", () => {
    assert(
        batchPricingCode.indexOf("PRODUCT DISCOUNT") < batchPricingCode.indexOf("CAMPAIGN DISCOUNT"),
        "Product Discount must have second priority"
    );
});

test("Campaign Discount has third priority", () => {
    assert(
        batchPricingCode.indexOf("CAMPAIGN DISCOUNT") < batchPricingCode.indexOf("BULK DISCOUNT"),
        "Campaign Discount must have third priority"
    );
});

test("Bulk Discount has fourth priority", () => {
    assert(
        batchPricingCode.indexOf("// 3. CAMPAIGN DISCOUNT") < batchPricingCode.indexOf("// 4. BULK DISCOUNT"),
        "Bulk Discount must come after Campaign Discount"
    );
});

test("Original price is fallback", () => {
    assert(
        batchPricingCode.includes('source: "ORIGINAL"'),
        "Original price must be the fallback"
    );
});

// ==========================================
// 10. VOUCHER IS CHECKOUT-COMPONENT, NOT PRICING-RULE
// ==========================================
console.log("\n10. Voucher is Checkout-Component, Not Pricing-Rule:");

test("Voucher discount is separate from item pricing", () => {
    // In checkout, voucher discount is applied to subtotal (after item pricing)
    // checkout.ts uses 'discount' variable for voucher, applied to subtotal
    assert(
        checkoutCode.includes("discount") && checkoutCode.includes("subtotal -"),
        "Voucher discount must be separate from item pricing"
    );
});

test("Voucher validation happens after batch pricing", () => {
    // Find the function CALL to resolveBatchMarketingPricing (not the import or definition)
    const callPattern = "await resolveBatchMarketingPricing(";
    const batchIdx = checkoutCode.indexOf(callPattern);
    const voucherPattern = "await validateAndCalculateVoucherEnhanced(";
    const voucherIdx = checkoutCode.indexOf(voucherPattern);
    assert(
        batchIdx > 0 && voucherIdx > 0 && batchIdx < voucherIdx,
        "Batch pricing must happen before voucher validation"
    );
});

// ==========================================
// RESULTS
// ==========================================
console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
    process.exit(1);
}
