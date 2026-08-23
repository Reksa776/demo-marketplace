/**
 * ==========================================
 * MARKETING PHASE M7 — AUDIT & FIXES TESTS
 * ==========================================
 *
 * Tests for M7 audit findings and fixes:
 * - M7-1/M7-2: Bulk discount tier display calculation
 * - M7-3/M7-4: Shipping discount preview
 * - M7-5: Midtrans item details shipping cost fix
 * - M7-6: Dynamic banner slider
 * - M7-7: Promotion image upload
 *
 * Run: npx jest __tests__/marketing/m7-audit-fixes.test.ts
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

console.log("\n=== M7 AUDIT & FIXES TESTS ===\n");

// ==========================================
// M7-5: Midtrans Item Details Fix
// ==========================================
console.log("M7-5: Midtrans Item Details Fix:");

const checkoutCode = readFile("lib/checkout.ts");

test("Checkout passes finalShippingCost (not verifiedShippingCost) to createMidtransItemDetails", () => {
    // Find the CALL to createMidtransItemDetails (skip the function definition)
    const defIdx = checkoutCode.indexOf("function createMidtransItemDetails(");
    const callIdx = checkoutCode.indexOf("createMidtransItemDetails(", defIdx + 30);
    assert(callIdx > 0, "createMidtransItemDetails call not found");

    // Read the arguments after the call
    const callContext = checkoutCode.substring(callIdx, callIdx + 300);
    assert(
        callContext.includes("finalShippingCost"),
        "createMidtransItemDetails must receive finalShippingCost, not verifiedShippingCost"
    );
});

test("grossAmount uses finalShippingCost", () => {
    const grossIdx = checkoutCode.indexOf("grossAmount =");
    const grossContext = checkoutCode.substring(grossIdx, grossIdx + 200);
    assert(
        grossContext.includes("finalShippingCost"),
        "grossAmount must be calculated using finalShippingCost"
    );
});

// ==========================================
// M7-6: Dynamic Banner Slider
// ==========================================
console.log("\nM7-6: Dynamic Banner Slider:");

const bannerCode = readFile("components/products/BannerSlider.tsx");
const homePageCode = readFile("app/home/page.tsx");

test("BannerSlider accepts banners prop", () => {
    assert(
        bannerCode.includes("banners") && bannerCode.includes("BannerItem"),
        "BannerSlider must accept a banners prop with BannerItem type"
    );
});

test("BannerSlider has fallback banners", () => {
    assert(
        bannerCode.includes("fallbackBanners"),
        "BannerSlider must have fallback banners for when no promotions exist"
    );
});

test("BannerSlider renders links when banner has link", () => {
    assert(
        bannerCode.includes("banner.link") && bannerCode.includes("Link"),
        "BannerSlider must wrap banners with Link when link is provided"
    );
});

test("Homepage fetches HOMEPAGE promotions", () => {
    assert(
        homePageCode.includes("getActivePromotions") && homePageCode.includes('"HOMEPAGE"'),
        "Homepage must fetch HOMEPAGE promotions from promotion service"
    );
});

test("Homepage passes banners to BannerSlider", () => {
    assert(
        homePageCode.includes("BannerSlider banners={banners}") || homePageCode.includes("<BannerSlider banners="),
        "Homepage must pass banners prop to BannerSlider"
    );
});

test("Homepage imports promotion service", () => {
    assert(
        homePageCode.includes('getActivePromotions') && homePageCode.includes('marketing/promotion'),
        "Homepage must import from marketing/promotion"
    );
});

// ==========================================
// M7-1/M7-2: Bulk Discount Display
// ==========================================
console.log("\nM7-1/M7-2: Bulk Discount Tier Display:");

const productDetailCode = readFile("components/products/ProductDetail.tsx");

test("ProductDetail calculates savings per item for bulk tiers", () => {
    assert(
        productDetailCode.includes("savingsPerItem"),
        "ProductDetail must calculate savingsPerItem for bulk discount tiers"
    );
});

test("ProductDetail calculates finalPrice per item for bulk tiers", () => {
    assert(
        productDetailCode.includes("finalPrice") && productDetailCode.includes("originalPrice"),
        "ProductDetail must show finalPrice per item for bulk discount tiers"
    );
});

test("ProductDetail shows savings per item in bulk tier display", () => {
    assert(
        productDetailCode.includes("Hemat Rp") && productDetailCode.includes("/item"),
        "ProductDetail must show 'Hemat Rp X/item' in bulk tier display"
    );
});

test("ProductDetail shows final price per item in bulk tier display", () => {
    assert(
        productDetailCode.includes("Harga:") && productDetailCode.includes("/item"),
        "ProductDetail must show 'Harga: Rp X/item' in bulk tier display"
    );
});

// ==========================================
// M7-3/M7-4: Shipping Discount Display
// ==========================================
console.log("\nM7-3/M7-4: Shipping Discount Display:");

const checkoutPageCode = readFile("app/checkout/CheckoutPage.tsx");
const buyNowPageCode = readFile("app/buy-now/BuyNowPage.tsx");

test("Checkout has shipping discount state", () => {
    assert(
        checkoutPageCode.includes("shippingDiscount") && checkoutPageCode.includes("shippingDiscountName"),
        "Checkout must have shippingDiscount and shippingDiscountName state"
    );
});

test("Checkout fetches shipping discount preview", () => {
    assert(
        checkoutPageCode.includes("shipping/discount-preview"),
        "Checkout must fetch shipping discount preview from API"
    );
});

test("Checkout grandTotal uses finalShippingCost (shipping - discount)", () => {
    assert(
        checkoutPageCode.includes("finalShippingCost") && checkoutPageCode.includes("Math.max(0, shippingCost - shippingDiscount)"),
        "Checkout grandTotal must use finalShippingCost = max(0, shippingCost - shippingDiscount)"
    );
});

test("Checkout displays shipping discount in order summary", () => {
    assert(
        checkoutPageCode.includes("Diskon Ongkir"),
        "Checkout must display 'Diskon Ongkir' in order summary"
    );
});

test("Buy Now has shipping discount state", () => {
    assert(
        buyNowPageCode.includes("shippingDiscount") && buyNowPageCode.includes("shippingDiscountName"),
        "Buy Now must have shippingDiscount and shippingDiscountName state"
    );
});

test("Buy Now fetches shipping discount preview", () => {
    assert(
        buyNowPageCode.includes("shipping/discount-preview"),
        "Buy Now must fetch shipping discount preview from API"
    );
});

test("Buy Now grandTotal uses finalShippingCost", () => {
    assert(
        buyNowPageCode.includes("finalShippingCost") && buyNowPageCode.includes("shippingCost - shippingDiscount"),
        "Buy Now grandTotal must use finalShippingCost"
    );
});

test("Buy Now displays shipping discount in order summary", () => {
    assert(
        buyNowPageCode.includes("Diskon Ongkir"),
        "Buy Now must display 'Diskon Ongkir' in order summary"
    );
});

// ==========================================
// M7-7: Promotion Image Upload
// ==========================================
console.log("\nM7-7: Promotion Image Upload:");

const adminPromoCode = readFile("app/admin/promotions/page.tsx");

test("Admin promotions imports ProductImageUpload", () => {
    assert(
        adminPromoCode.includes("ProductImageUpload"),
        "Admin promotions must import ProductImageUpload component"
    );
});

test("Admin promotions uses ProductImageUpload for imageUrl field", () => {
    assert(
        adminPromoCode.includes("<ProductImageUpload") && adminPromoCode.includes("imageUrl"),
        "Admin promotions must use ProductImageUpload for imageUrl field"
    );
});

// ==========================================
// SHIPPING DISCOUNT PREVIEW API
// ==========================================
console.log("\nShipping Discount Preview API:");

const previewApiCode = readFile("app/api/shipping/discount-preview/route.ts");

test("Shipping discount preview API exists", () => {
    assert(previewApiCode.includes("POST"), "Shipping discount preview must be a POST endpoint");
});

test("Shipping discount preview validates shippingCost", () => {
    assert(
        previewApiCode.includes("shippingCost") && previewApiCode.includes("isFinite"),
        "Shipping discount preview must validate shippingCost"
    );
});

test("Shipping discount preview validates subtotal", () => {
    assert(
        previewApiCode.includes("subtotal") && previewApiCode.includes("isFinite"),
        "Shipping discount preview must validate subtotal"
    );
});

test("Shipping discount preview calls calculateShippingDiscount", () => {
    assert(
        previewApiCode.includes("calculateShippingDiscount"),
        "Shipping discount preview must call calculateShippingDiscount"
    );
});

test("Shipping discount preview returns hasDiscount flag", () => {
    assert(
        previewApiCode.includes("hasDiscount"),
        "Shipping discount preview must return hasDiscount flag"
    );
});

test("Shipping discount preview handles errors gracefully", () => {
    assert(
        previewApiCode.includes("catch") && previewApiCode.includes("hasDiscount: false"),
        "Shipping discount preview must handle errors gracefully"
    );
});

// ==========================================
// CAMPAIGN SAFETY VERIFICATION
// ==========================================
console.log("\nCampaign Safety Verification (NOT removed):");

const campaignServiceCode = readFile("lib/marketing/campaign.ts");
const campaignIndexCode = readFile("lib/marketing/index.ts");

test("Campaign service still exists", () => {
    assert(
        campaignServiceCode.includes("export async function"),
        "Campaign service must still exist with exports"
    );
});

test("Campaign exports still in marketing index", () => {
    assert(
        campaignIndexCode.includes('createCampaign') && campaignIndexCode.includes('getCampaignById'),
        "Campaign must still be exported from marketing index"
    );
});

test("Pricing engine still references campaign", () => {
    assert(
        campaignIndexCode.includes("resolveCampaignForProduct") || campaignIndexCode.includes("resolveCampaignDiscount"),
        "Pricing engine must still reference campaign functions"
    );
});

test("Voucher still supports campaignId", () => {
    const voucherCode = readFile("lib/voucher.ts");
    assert(
        voucherCode.includes("campaignId"),
        "Voucher validation must still support campaignId"
    );
});

test("Checkout still resolves campaign context", () => {
    assert(
        checkoutCode.includes("resolveOrderCampaignId"),
        "Checkout must still resolve campaign context for vouchers"
    );
});

// ==========================================
// M5: SHIPPING DISCOUNT SERVICE INTEGRITY
// ==========================================
console.log("\nShipping Discount Service Integrity:");

const shippingDiscountCode = readFile("lib/marketing/shipping-discount.ts");

test("calculateShippingDiscount prevents negative final cost", () => {
    assert(
        shippingDiscountCode.includes("Math.min(discountAmount, shippingCost)"),
        "calculateShippingDiscount must cap discount at shipping cost (prevent negative)"
    );
});

test("calculateShippingDiscount rounds discount amount", () => {
    assert(
        shippingDiscountCode.includes("Math.round(discountAmount)"),
        "calculateShippingDiscount must round discount amount"
    );
});

test("calculateShippingDiscount supports PERCENTAGE type", () => {
    assert(
        shippingDiscountCode.includes('"PERCENTAGE"'),
        "calculateShippingDiscount must support PERCENTAGE type"
    );
});

test("calculateShippingDiscount supports FIXED type (else branch)", () => {
    // FIXED is handled as the else branch after checking PERCENTAGE
    assert(
        shippingDiscountCode.includes('discount.type === "PERCENTAGE"') && 
        shippingDiscountCode.includes('discountAmount = Number(discount.value)'),
        "calculateShippingDiscount must handle FIXED type via else branch"
    );
});

test("calculateShippingDiscount checks maxDiscount cap", () => {
    assert(
        shippingDiscountCode.includes("maxDiscount"),
        "calculateShippingDiscount must support maxDiscount cap"
    );
});

test("calculateShippingDiscount checks minPurchase threshold", () => {
    assert(
        shippingDiscountCode.includes("minPurchase"),
        "calculateShippingDiscount must support minPurchase threshold"
    );
});

// ==========================================
// RESULTS
// ==========================================
console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
    process.exit(1);
}
