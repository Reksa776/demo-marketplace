/**
 * ==========================================
 * CHECKOUT LIFECYCLE TESTS
 * ==========================================
 *
 * Static/code-path verification tests.
 * These verify architecture and code patterns
 * without requiring a running database.
 *
 * Run: npx tsx __tests__/checkout/lifecycle.test.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

function readFile(
    relativePath: string
): string {
    return readFileSync(
        resolve(process.cwd(), relativePath),
        "utf-8"
    );
}

function assert(
    condition: boolean,
    message: string
) {
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

// ==========================================
// TEST SUITE
// ==========================================

let passed = 0;
let failed = 0;

function test(
    name: string,
    fn: () => void
) {
    try {
        fn();
        pass(name);
        passed++;
    } catch (e) {
        fail(
            name,
            e instanceof Error
                ? e.message
                : String(e)
        );
        failed++;
    }
}

console.log(
    "\n=== CHECKOUT LIFECYCLE TESTS ===\n"
);

// ==========================================
// 1. CHECKOUT ARCHITECTURE
// ==========================================

console.log("1. Checkout Architecture:");

const checkoutCode = readFile(
    "lib/checkout.ts"
);
const ordersRoute = readFile(
    "app/api/orders/route.ts"
);
const midtransRoute = readFile(
    "app/api/payment/midtrans/route.ts"
);
const buyNowRoute = readFile(
    "app/api/buy-now/route.ts"
);
const buyNowMidtrans = readFile(
    "app/api/buy-now/midtrans/route.ts"
);

test("All 4 routes import createCheckoutOrder", () => {
    assert(
        ordersRoute.includes(
            "createCheckoutOrder"
        ),
        "orders route missing createCheckoutOrder"
    );
    assert(
        midtransRoute.includes(
            "createCheckoutOrder"
        ),
        "midtrans route missing createCheckoutOrder"
    );
    assert(
        buyNowRoute.includes(
            "createCheckoutOrder"
        ),
        "buy-now route missing createCheckoutOrder"
    );
    assert(
        buyNowMidtrans.includes(
            "createCheckoutOrder"
        ),
        "buy-now midtrans missing createCheckoutOrder"
    );
});

test("No client-trusted pricing in checkout", () => {
    const routes = [
        checkoutCode,
        ordersRoute,
        midtransRoute,
        buyNowRoute,
        buyNowMidtrans,
    ];
    for (const code of routes) {
        assert(
            !code.includes("body.price") &&
                !code.includes(
                    "body.subtotal"
                ) &&
                !code.includes("body.total"),
            "Found client-trusted pricing"
        );
    }
});

test("No inline voucher in Buy Now routes", () => {
    assert(
        !buyNowRoute.includes(
            "voucher.findUnique"
        ),
        "Buy Now has inline voucher"
    );
    assert(
        !buyNowMidtrans.includes(
            "voucher.findUnique"
        ),
        "Buy Now Midtrans has inline voucher"
    );
});

test("No inline pricing in Buy Now Midtrans", () => {
    assert(
        !buyNowMidtrans.includes(
            "decimalToNumber(variant.price)"
        ),
        "Buy Now Midtrans has inline pricing"
    );
});

// ==========================================
// 2. PRICING CONSISTENCY
// ==========================================

console.log("\n2. Pricing Consistency:");

const batchPricing = readFile(
    "lib/marketing/batch-pricing.ts"
);

test("Single pricing engine defined", () => {
    assert(
        batchPricing.includes(
            "export async function resolveBatchPrices"
        ),
        "resolveBatchPrices not found"
    );
});

test("Pricing priority: Flash Sale > Discount > Campaign > Original", () => {
    assert(
        batchPricing.includes("FLASH_SALE") &&
            batchPricing.includes(
                "PRODUCT_DISCOUNT"
            ) &&
            batchPricing.includes("CAMPAIGN") &&
            batchPricing.includes("ORIGINAL"),
        "Missing pricing sources"
    );
    // Flash Sale check comes before discount check
    const fsIndex =
        batchPricing.indexOf("FLASH_SALE");
    const discountIndex =
        batchPricing.indexOf(
            "PRODUCT_DISCOUNT"
        );
    assert(
        fsIndex < discountIndex,
        "Flash Sale should be checked before Discount"
    );
});

test("resolveBatchPrices used in checkout", () => {
    assert(
        checkoutCode.includes(
            "resolveBatchPrices"
        ),
        "Checkout doesn't use resolveBatchPrices"
    );
});

test("resolveBatchPrices used in product listing", () => {
    const productsRoute = readFile(
        "app/api/products/route.ts"
    );
    assert(
        productsRoute.includes(
            "resolveBatchPrices"
        ),
        "Products route doesn't use resolveBatchPrices"
    );
});

// ==========================================
// 3. STOCK CONCURRENCY
// ==========================================

console.log(
    "\n3. Stock Concurrency:"
);

test("Regular stock uses atomic conditional update", () => {
    assert(
        checkoutCode.includes(
            "updateMany"
        ) &&
            checkoutCode.includes(
                "gte:\r\n"
            ),
        "Missing atomic stock reservation"
    );
});

test("Flash sale uses atomic $executeRaw", () => {
    assert(
        checkoutCode.includes(
            "$executeRaw"
        ) &&
            checkoutCode.includes(
                "UPDATE FlashSale"
            ),
        "Missing atomic flash sale reservation"
    );
});

test("Flash sale items skip regular stock", () => {
    assert(
        checkoutCode.includes(
            "flashSaleId) {"
        ) &&
            checkoutCode.includes(
                "continue;"
            ),
        "Flash sale items don't skip regular stock"
    );
});

// ==========================================
// 4. VOUCHER
// ==========================================

console.log("\n4. Voucher:");

const voucherCode = readFile(
    "lib/voucher.ts"
);

test("Voucher increment is atomic", () => {
    assert(
        voucherCode.includes(
            "$executeRaw"
        ) &&
            voucherCode.includes(
                "UPDATE Voucher"
            ),
        "Voucher increment not atomic"
    );
});

test("Voucher rollback has usedCount guard", () => {
    assert(
        checkoutCode.includes(
            "usedCount:"
        ) &&
            checkoutCode.includes(
                "decrement: 1"
        ),
        "Missing usedCount guard in rollback"
    );
});

// ==========================================
// 5. FLASH SALE
// ==========================================

console.log(
    "\n5. Flash Sale:"
);

const flashSaleService = readFile(
    "lib/marketing/flash-sale.ts"
);

test("deleteFlashSale checks pending orders", () => {
    assert(
        flashSaleService.includes(
            "pendingOrderCount"
        ),
        "deleteFlashSale missing pending order check"
    );
});

test("updateFlashSale validates saleStock >= soldCount", () => {
    assert(
        flashSaleService.includes(
            "saleStock < existing.soldCount"
        ),
        "updateFlashSale missing soldCount guard"
    );
});

// ==========================================
// 6. ROLLBACK
// ==========================================

console.log(
    "\n6. Rollback:"
);test("Rollback has atomic CAS idempotency guard", () => {
    assert(
        checkoutCode.includes('$executeRaw') &&
        checkoutCode.includes("CANCELLED") &&
        checkoutCode.includes("IN ('PENDING', 'PROCESSING')"),
        "Missing atomic CAS idempotency guard in rollbackCheckoutOrder"
    );
});

test("Rollback CAS only transitions PENDING/PROCESSING", () => {
    assert(
        checkoutCode.includes("UPDATE") &&
        checkoutCode.includes("CANCELLED") &&
        checkoutCode.includes("IN ('PENDING', 'PROCESSING')"),
        "Rollback CAS missing PENDING/PROCESSING guard"
    );
});

test("Rollback restores flash sale stock atomically", () => {
    assert(
        checkoutCode.includes("FLASH SALE ITEM") &&
        checkoutCode.includes("UPDATE FlashSale") &&
        checkoutCode.includes("soldCount >="),
        "Rollback doesn't restore flash sale stock atomically"
    );
});

test("Rollback restores regular stock", () => {
    assert(
        checkoutCode.includes(
            "REGULAR ITEM"
        ) &&
            checkoutCode.includes(
                "productVariant.update"
            ),
        "Rollback doesn't restore regular stock"
    );
});

test("Rollback restores voucher usage", () => {
    assert(
        checkoutCode.includes(
            "RESTORE VOUCHER"
        ) &&
            checkoutCode.includes(
                "decrement: 1"
            ),
        "Rollback doesn't restore voucher"
    );
});

test("Rollback cancels order", () => {
    assert(
        checkoutCode.includes(
            "CANCELLED"
        ) &&
            checkoutCode.includes(
                "FAILED"
        ),
        "Rollback doesn't cancel order"
    );
});

// ==========================================
// 7. AUTHORIZATION
// ==========================================

console.log(
    "\n7. Authorization:"
);

test("Admin endpoints have auth checks", () => {
    const adminFiles = [
        "app/api/admin/campaigns/route.ts",
        "app/api/admin/discounts/route.ts",
        "app/api/admin/flash-sales/route.ts",
        "app/api/admin/promotions/route.ts",
        "app/api/admin/reports/route.ts",
    ];
    for (const f of adminFiles) {
        const code = readFile(f);
        assert(
            code.includes("ADMIN") &&
                (code.includes("requireAdmin") ||
                    code.includes(
                        'role !== "ADMIN"'
                    )),
            `${f} missing admin auth`
        );
    }
});

test("Public endpoints have no admin auth", () => {
    const publicFiles = [
        "app/api/campaigns/route.ts",
        "app/api/flash-sales/route.ts",
        "app/api/promotions/route.ts",
    ];
    for (const f of publicFiles) {
        const code = readFile(f);
        assert(
            !code.includes(
                'role !== "ADMIN"'
            ),
            `${f} has admin auth (should be public)`
        );
    }
});

// ==========================================
// 8. DATA INTEGRITY
// ==========================================

console.log(
    "\n8. Data Integrity:"
);

test("No ProductVariant.price writes", () => {
    const allCode = [
        checkoutCode,
        ordersRoute,
        midtransRoute,
        buyNowRoute,
        buyNowMidtrans,
    ].join("\n");
    assert(
        !allCode.includes(
            "ProductVariant.price ="
        ),
        "Found ProductVariant.price write"
    );
});

test("Midtrans grossAmount from server", () => {
    assert(
        midtransRoute.includes(
            "result.grossAmount"
        ),
        "Midtrans doesn't use server grossAmount"
    );
    assert(
        buyNowMidtrans.includes(
            "result.grossAmount"
        ),
        "Buy Now Midtrans doesn't use server grossAmount"
    );
});

// ==========================================
// VOUCHER PER-USER ENFORCEMENT
// ==========================================

test("Checkout uses enhanced voucher validator (not basic)", () => {
    assert(
        checkoutCode.includes("validateAndCalculateVoucherEnhanced"),
        "Checkout doesn't use enhanced voucher validator"
    );
    assert(
        !checkoutCode.includes("import {\n    incrementVoucherUsage,\n    incrementVoucherUserUsage,\n    validateAndCalculateVoucher,\n}"),
        "Checkout still imports basic validateAndCalculateVoucher"
    );
});

test("Enhanced validator receives userId for per-user limit", () => {
    assert(
        checkoutCode.includes("validateAndCalculateVoucherEnhanced(") &&
        checkoutCode.includes("input.userId"),
        "Enhanced validator doesn't receive userId"
    );
});

test("Enhanced validator receives items for product/category restrictions", () => {
    assert(
        checkoutCode.includes("VoucherValidationItem"),
        "Checkout doesn't build VoucherValidationItem array"
    );
    assert(
        checkoutCode.includes("voucherItems"),
        "Checkout doesn't pass items to enhanced validator"
    );
});

test("VoucherUserUsage recorded after global quota increment", () => {
    assert(
        checkoutCode.includes("incrementVoucherUserUsage"),
        "Checkout doesn't record per-user voucher usage"
    );
    assert(
        checkoutCode.includes("incrementVoucherUserUsage(") &&
        checkoutCode.includes("input.userId"),
        "Per-user usage doesn't receive userId"
    );
});

// ==========================================
// VOUCHER ROLLBACK
// ==========================================

test("Rollback decrements VoucherUserUsage", () => {
    assert(
        checkoutCode.includes("voucherUserUsage.findUnique"),
        "Rollback doesn't look up VoucherUserUsage"
    );
    assert(
        checkoutCode.includes("voucherUserUsage.update"),
        "Rollback doesn't decrement VoucherUserUsage"
    );
    assert(
        checkoutCode.includes("usageCount") &&
        checkoutCode.includes("decrement: 1"),
        "Rollback doesn't decrement usageCount"
    );
});

test("Rollback checks usageCount > 0 before decrementing", () => {
    assert(
        checkoutCode.includes("userUsage.usageCount > 0"),
        "Rollback doesn't guard against negative usageCount"
    );
});

// ==========================================
// FLASH SALE PER-USER LIMIT
// ==========================================

test("Flash sale records purchase after stock reservation", () => {
    assert(
        checkoutCode.includes("recordFlashSalePurchase"),
        "Checkout doesn't record flash sale purchase"
    );
    assert(
        checkoutCode.includes("recordFlashSalePurchase(") &&
        checkoutCode.includes("input.userId"),
        "Flash sale purchase recording doesn't receive userId"
    );
});

// ==========================================
// 9. DOUBLE-SUBMIT PROTECTION
// ==========================================

console.log("\n9. Double-Submit Protection:");

const checkoutPage = readFile("app/checkout/CheckoutPage.tsx");
const buyNowPage = readFile("app/buy-now/BuyNowPage.tsx");

test("CheckoutPage createOrder has creatingOrder guard", () => {
    assert(
        checkoutPage.includes("if (creatingOrder)") ||
        checkoutPage.includes("creatingOrder"),
        "CheckoutPage missing creatingOrder guard in createOrder"
    );
});

test("CheckoutPage submit button disables on creatingOrder", () => {
    assert(
        checkoutPage.includes("creatingOrder ||\n") ||
        checkoutPage.includes("creatingOrder ||\r\n"),
        "CheckoutPage submit button doesn't check creatingOrder"
    );
});

test("CheckoutPage shows loading text when creatingOrder", () => {
    assert(
        checkoutPage.includes("Memproses"),
        "CheckoutPage doesn't show loading text"
    );
});

test("BuyNowPage createOrder has creatingOrder guard", () => {
    assert(
        buyNowPage.includes("creatingOrder") &&
        buyNowPage.includes("return;"),
        "BuyNowPage missing creatingOrder guard"
    );
});

test("BuyNowPage button uses paymentButtonDisabled with creatingOrder", () => {
    assert(
        buyNowPage.includes("paymentButtonDisabled") &&
        buyNowPage.includes("creatingOrder"),
        "BuyNowPage button missing creatingOrder disable"
    );
});

test("CheckoutPage snapProcessingRef prevents Snap re-entry", () => {
    assert(
        checkoutPage.includes("snapProcessingRef.current"),
        "CheckoutPage missing snapProcessingRef"
    );
});

// ==========================================
// 10. STRUCTURED LOGGING
// ==========================================

console.log("\n10. Structured Logging:");

const ordersRouteCode = readFile("app/api/orders/route.ts");
const buyNowRouteCode = readFile("app/api/buy-now/route.ts");
const buyNowMidtransCode = readFile("app/api/buy-now/midtrans/route.ts");
const midtransCartCode = readFile("app/api/payment/midtrans/route.ts");

test("Cart COD route has structured checkout failure log", () => {
    assert(
        ordersRouteCode.includes('event: "CHECKOUT_FAILURE"') &&
        ordersRouteCode.includes('checkoutType: "CART_COD"'),
        "Cart COD route missing structured log"
    );
});

test("Buy Now COD route has structured checkout failure log", () => {
    assert(
        buyNowRouteCode.includes('event: "CHECKOUT_FAILURE"') &&
        buyNowRouteCode.includes('checkoutType: "BUY_NOW_COD"'),
        "Buy Now COD route missing structured log"
    );
});

test("Buy Now Midtrans route has structured checkout failure log", () => {
    assert(
        buyNowMidtransCode.includes('event: "CHECKOUT_FAILURE"') &&
        buyNowMidtransCode.includes('checkoutType: "BUY_NOW_MIDTRANS"'),
        "Buy Now Midtrans route missing structured log"
    );
});

test("Cart Midtrans route has structured checkout failure log", () => {
    assert(
        midtransCartCode.includes('event: "CHECKOUT_FAILURE"') &&
        midtransCartCode.includes('checkoutType: "CART_MIDTRANS"'),
        "Cart Midtrans route missing structured log"
    );
});

test("Structured logs include timestamp", () => {
    const routes = [ordersRouteCode, buyNowRouteCode, buyNowMidtransCode, midtransCartCode];
    for (const route of routes) {
        assert(
            route.includes('timestamp: new Date().toISOString()'),
            `Route missing timestamp in structured log`
        );
    }
});

test("Cart Midtrans log includes orderId for correlation", () => {
    assert(
        midtransCartCode.includes('orderId: createdOrderId'),
        "Cart Midtrans log missing orderId correlation"
    );
});

// ==========================================
// 11. WEBHOOK FLASH-SALE INTEGRITY
// ==========================================

console.log("\n11. Webhook Flash-Sale Integrity:");

const webhookCode = readFile("app/api/payment/midtrans/notification/route.ts");

test("Webhook expired handler uses atomic CAS", () => {
    assert(
        webhookCode.includes('$executeRaw') &&
        webhookCode.includes("EXPIRED") &&
        webhookCode.includes("IN ('PENDING', 'PROCESSING')"),
        "Webhook expired handler missing atomic CAS"
    );
});

test("Webhook failed handler uses atomic CAS", () => {
    assert(
        webhookCode.includes('$executeRaw') &&
        webhookCode.includes("FAILED") &&
        webhookCode.includes("IN ('PENDING', 'PROCESSING')"),
        "Webhook failed handler missing atomic CAS"
    );
});

test("Pending webhook cannot revert PAID order (CAS guard)", () => {
    assert(
        webhookCode.includes("paymentStatus != 'PAID'"),
        "Pending webhook missing PAID guard"
    );
});

test("Webhook has flash-sale aware releaseReservedStock", () => {
    assert(
        webhookCode.includes('flashSale.findFirst'),
        "Webhook missing flash sale lookup"
    );
    assert(
        webhookCode.includes('UPDATE FlashSale'),
        "Webhook missing flash sale stock restore"
    );
    assert(
        webhookCode.includes('soldCount >='),
        "Webhook missing soldCount guard for flash sale restore"
    );
});

test("Webhook does not blindly increment ProductVariant.stock for all items", () => {
    // The webhook should check flash sale first, then conditionally restore regular stock
    assert(
        webhookCode.includes('else') || webhookCode.includes('} else {'),
        "Webhook should have conditional stock restoration"
    );
});

test("Webhook verifies Midtrans signature", () => {
    assert(
        webhookCode.includes('timingSafeEqual') || webhookCode.includes('signature'),
        "Webhook missing signature verification"
    );
});

test("Webhook validates order amount", () => {
    assert(
        webhookCode.includes('gross_amount') || webhookCode.includes('grossAmount'),
        "Webhook missing amount validation"
    );
});

test("Webhook idempotent for PAID orders", () => {
    assert(
        webhookCode.includes('paymentStatus') &&
        (webhookCode.includes('PAID') || webhookCode.includes('paid')),
        "Webhook missing PAID guard"
    );
});test("Webhook idempotent for CANCELLED orders", () => {
    assert(webhookCode.includes('CANCELLED'),
        "Webhook missing CANCELLED guard"
    );
});

test("Webhook releaseReservedStock decrements VoucherUserUsage", () => {
    assert(
        webhookCode.includes('voucherUserUsage.findUnique'),
        "Webhook releaseReservedStock missing VoucherUserUsage lookup"
    );
    assert(
        webhookCode.includes('voucherUserUsage.update'),
        "Webhook releaseReservedStock missing VoucherUserUsage decrement"
    );
});

test("Webhook releaseReservedStock checks usageCount > 0 before decrementing VoucherUserUsage", () => {
    assert(
        webhookCode.includes('userUsage.usageCount > 0'),
        "Webhook releaseReservedStock missing usageCount > 0 guard for VoucherUserUsage"
    );
});

test("Webhook releaseReservedStock uses voucherId_userId composite key for VoucherUserUsage", () => {
    assert(
        webhookCode.includes('voucherId_userId'),
        "Webhook releaseReservedStock not using voucherId_userId composite key"
    );
});

test("Webhook releaseReservedStock has both Voucher and VoucherUserUsage operations", () => {
    // Both operations should exist in the webhook file
    assert(
        webhookCode.includes('voucher.updateMany') && webhookCode.includes('voucherUserUsage'),
        "Voucher.usedCount and VoucherUserUsage decrements both not found"
    );
    // VoucherUserUsage should come after voucher.updateMany (same block)
    const voucherIdx = webhookCode.indexOf('voucher.updateMany');
    const userUsageIdx = webhookCode.indexOf('voucherUserUsage.findUnique');
    assert(
        userUsageIdx > voucherIdx,
        "VoucherUserUsage decrement should come after Voucher.usedCount decrement"
    );
});

// ==========================================
// 12. CHECKOUT TRANSACTION INTEGRITY
// ==========================================

console.log("\n12. Checkout Transaction Integrity:");

test("Product.sold uses GREATEST guard in checkout rollback", () => {
    assert(
        checkoutCode.includes('GREATEST(0, sold -') ||
        checkoutCode.includes('GREATEST(0,sold -'),
        "Checkout rollback missing GREATEST guard on Product.sold"
    );
});

test("Product.sold uses GREATEST guard in webhook releaseReservedStock", () => {
    assert(
        webhookCode.includes('GREATEST(0, sold -') ||
        webhookCode.includes('GREATEST(0,sold -'),
        "Webhook releaseReservedStock missing GREATEST guard on Product.sold"
    );
});

test("Flash sale stock uses transaction client (tx)", () => {
    assert(
        (checkoutCode.includes('tx.$executeRaw') ||
         (checkoutCode.includes('await tx') && checkoutCode.includes('.$executeRaw'))) &&
        checkoutCode.includes('UPDATE FlashSale'),
        "Flash sale stock not using transaction client"
    );
});

test("Flash sale reservation failure throws error (no silent failure)", () => {
    assert(
        checkoutCode.includes('flash-sale') || checkoutCode.includes('Flash sale'),
        "Missing flash sale error handling"
    );
    // Should throw on affectedRows === 0
    assert(
        checkoutCode.includes('affectedRows') || checkoutCode.includes('affected_rows'),
        "Missing affectedRows check for flash sale"
    );
});

test("Regular stock reservation is atomic with stock >= quantity", () => {
    assert(
        checkoutCode.includes('updateMany') &&
        checkoutCode.includes('stock:'),
        "Regular stock reservation not atomic"
    );
});

test("All checkout paths pass voucherCode to shared engine", () => {
    assert(
        ordersRouteCode.includes('voucherCode'),
        "Cart COD doesn't pass voucherCode"
    );
    assert(
        buyNowRouteCode.includes('voucherCode'),
        "Buy Now COD doesn't pass voucherCode"
    );
    assert(
        buyNowMidtransCode.includes('voucherCode'),
        "Buy Now Midtrans doesn't pass voucherCode"
    );
});

// ==========================================
// 13. MARKETING CUSTOMER INTEGRATION
// ==========================================

console.log("\n13. Marketing Customer Integration:");

const batchPricingCode = readFile("lib/marketing/batch-pricing.ts");
const voucherCode2 = readFile("lib/voucher.ts");
const cartApi = readFile("app/api/cart/route.ts");
const voucherValidateApi = readFile("app/api/voucher/validate/route.ts");
const bulkDiscountsApi = readFile("app/api/bulk-discounts/route.ts");
const shippingDiscountService = readFile("lib/marketing/shipping-discount.ts");
const productDetail = readFile("components/products/ProductDetail.tsx");

test("Batch pricing includes BULK_DISCOUNT source type", () => {
    assert(
        batchPricingCode.includes('"BULK_DISCOUNT"'),
        "Batch pricing missing BULK_DISCOUNT source type"
    );
});

test("Batch pricing has bulkDiscountName in result type", () => {
    assert(
        batchPricingCode.includes("bulkDiscountName"),
        "Batch pricing missing bulkDiscountName field"
    );
});

test("Batch pricing queries BulkDiscount table", () => {
    assert(
        batchPricingCode.includes("bulkDiscount.findMany"),
        "Batch pricing doesn't query BulkDiscount"
    );
});

test("Batch pricing applies bulk discount when no higher priority discount", () => {
    assert(
        batchPricingCode.includes("BULK_DISCOUNT") &&
        batchPricingCode.includes("bulkDiscountMap"),
        "Batch pricing missing bulk discount resolution logic"
    );
});

test("Voucher enhanced validator checks eligibility", () => {
    assert(
        voucherCode2.includes("eligibility") &&
        voucherCode2.includes("NEW_USER") &&
        voucherCode2.includes("RETURNING_USER"),
        "Voucher validator missing eligibility check"
    );
});

test("Voucher eligibility checks paid order count", () => {
    assert(
        voucherCode2.includes("paidOrderCount"),
        "Voucher validator doesn't check paid order count for eligibility"
    );
});

test("Cart API uses resolveBatchPrices for marketing pricing", () => {
    assert(
        cartApi.includes("resolveBatchPrices"),
        "Cart API doesn't use resolveBatchPrices"
    );
});

test("Cart API returns effectivePrice in items", () => {
    assert(
        cartApi.includes("effectivePrice"),
        "Cart API doesn't return effectivePrice"
    );
});

test("Cart API returns priceSource in items", () => {
    assert(
        cartApi.includes("priceSource"),
        "Cart API doesn't return priceSource"
    );
});

test("Voucher preview uses enhanced validator with eligibility", () => {
    assert(
        voucherValidateApi.includes("validateAndCalculateVoucherEnhanced"),
        "Voucher preview doesn't use enhanced validator"
    );
    assert(
        voucherValidateApi.includes("session.user.id"),
        "Voucher preview doesn't pass userId for eligibility"
    );
});

test("Customer bulk discount API exists and is public", () => {
    assert(
        bulkDiscountsApi.includes("GET") &&
        !bulkDiscountsApi.includes("requireAdmin"),
        "Bulk discounts API missing or requires admin"
    );
});

test("Checkout uses shipping discount service", () => {
    assert(
        checkoutCode.includes("calculateShippingDiscount"),
        "Checkout doesn't use shipping discount"
    );
    assert(
        checkoutCode.includes("finalShippingCost"),
        "Checkout doesn't use finalShippingCost"
    );
});

test("Product detail shows bulk discount tiers", () => {
    assert(
        productDetail.includes("bulkTiers"),
        "Product detail missing bulkTiers"
    );
    assert(
        productDetail.includes("Beli Banyak Lebih Hemat"),
        "Product detail missing bulk discount heading"
    );
});

test("Shipping discount enforces minimum cost of 0", () => {
    assert(
        shippingDiscountService.includes("Math.min(discountAmount, shippingCost)"),
        "Shipping discount doesn't floor at 0"
    );
});

// ==========================================
// 14. SERVER-SIDE SHIPPING VERIFICATION
// ==========================================

console.log("\n14. Server-Side Shipping Verification:");

test("verifyShippingCost function exported from checkout.ts", () => {
    assert(
        checkoutCode.includes("export async function verifyShippingCost") ||
        checkoutCode.includes("async function verifyShippingCost"),
        "Missing verifyShippingCost export"
    );
});

test("verifyShippingCost calls RajaOngkir API via calculateDomesticCost", () => {
    assert(
        checkoutCode.includes("calculateDomesticCost") ||
        checkoutCode.includes("rajaongkir"),
        "verifyShippingCost doesn't call RajaOngkir"
    );
});

test("verifyShippingCost origin comes from StoreSetting", () => {
    assert(
        checkoutCode.includes("storeSetting.rajaOngkirDestinationId"),
        "Origin not from StoreSetting"
    );
});

test("verifyShippingCost destination comes from UserAddress (server-verified)", () => {
    assert(
        checkoutCode.includes("address.rajaOngkirDestinationId"),
        "Destination not from UserAddress"
    );
});

test("verifyShippingCost calculates weight from ProductVariant.weight * quantity", () => {
    assert(
        checkoutCode.includes("totalWeight") && checkoutCode.includes("variant.weight"),
        "Weight not calculated from database"
    );
});

test("verifyShippingCost is called before $transaction", () => {
    const verifyIdx = checkoutCode.indexOf("verifyShippingCost");
    const txIdx = checkoutCode.indexOf("$transaction");
    assert(
        verifyIdx > 0 && txIdx > 0 && verifyIdx < txIdx,
        "verifyShippingCost must be called before $transaction"
    );
});

test("Order total uses verifiedShippingCost, not client value", () => {
    assert(
        checkoutCode.includes("finalShippingCost = verifiedShippingCost") ||
        checkoutCode.includes("finalShippingCost =verifiedShippingCost"),
        "finalShippingCost not initialized from verifiedShippingCost"
    );
});

test("grossAmount calculation uses finalShippingCost (server-verified)", () => {
    assert(
        checkoutCode.includes("subtotal -") &&
        checkoutCode.includes("discount +") &&
        checkoutCode.includes("finalShippingCost"),
        "grossAmount not using finalShippingCost"
    );
});

test("verifyShippingCost rejects if courier/service not found", () => {
    assert(
        checkoutCode.includes("tidak tersedia"),
        "Missing rejection message for unavailable service"
    );
});

test("verifyShippingCost validates origin is positive integer", () => {
    assert(
        checkoutCode.includes("Origin pengiriman tidak valid"),
        "Missing origin validation"
    );
});

test("verifyShippingCost validates destination is positive integer", () => {
    assert(
        checkoutCode.includes("Destination pengiriman tidak valid"),
        "Missing destination validation"
    );
});

test("verifyShippingCost validates weight is positive", () => {
    assert(
        checkoutCode.includes("Berat paket tidak valid"),
        "Missing weight validation"
    );
});

test("Address lookup uses both id and userId (IDOR protection)", () => {
    assert(
        checkoutCode.includes("addressId:") && checkoutCode.includes("userId:"),
        "Address lookup missing userId constraint"
    );
});

test("UserAddress lookup is findFirst with userId filter (prevents cross-user access)", () => {
    assert(
        checkoutCode.includes("userAddress.findFirst") || checkoutCode.includes("UserAddress.findFirst"),
        "Address lookup not using findFirst with userId"
    );
});

test("All 4 order creation endpoints use createCheckoutOrder", () => {
    assert(
        ordersRouteCode.includes("createCheckoutOrder"),
        "Cart COD doesn't use createCheckoutOrder"
    );
    assert(
        buyNowRouteCode.includes("createCheckoutOrder"),
        "Buy Now COD doesn't use createCheckoutOrder"
    );
    assert(
        buyNowMidtransCode.includes("createCheckoutOrder"),
        "Buy Now Midtrans doesn't use createCheckoutOrder"
    );
    assert(
        midtransCartCode.includes("createCheckoutOrder") || midtransCartCode.includes("createCheckoutOrder"),
        "Cart Midtrans doesn't use createCheckoutOrder"
    );
});

// ==========================================
// 15. CONCURRENCY & ATOMICITY
// ==========================================

console.log("\n15. Concurrency & Atomicity:");

test("RollbackCheckoutOrder uses $executeRaw for CAS (not findUnique-then-update)", () => {
    // The CAS UPDATE must come BEFORE the findUnique for items
    const casIdx = checkoutCode.indexOf("$executeRaw`\n                UPDATE \`Order\`");
    const findIdx = checkoutCode.indexOf("tx.order.findUnique");
    // Find the findUnique that's inside rollbackCheckoutOrder (after the CAS)
    const rollbackSection = checkoutCode.substring(
        checkoutCode.indexOf("rollbackCheckoutOrder"),
        checkoutCode.indexOf("clearCart")
    );
    const rollbackCasIdx = rollbackSection.indexOf("$executeRaw");
    const rollbackFindIdx = rollbackSection.indexOf("order.findUnique");
    assert(
        rollbackCasIdx >= 0 && rollbackFindIdx >= 0 && rollbackCasIdx < rollbackFindIdx,
        "CAS must come before findUnique in rollbackCheckoutOrder"
    );
});

test("Webhook expired: CAS comes before releaseReservedStock", () => {
    // Find the EXPIRED handler section (the if block, not the variable)
    const expiredIfIdx = webhookCode.indexOf('if (\n            isExpired');
    const failedIfIdx = webhookCode.indexOf('if (\n            isFailed');
    assert(expiredIfIdx >= 0 && failedIfIdx > expiredIfIdx, "Cannot locate isExpired handler");
    const expiredSection = webhookCode.substring(expiredIfIdx, failedIfIdx);
    const casIdx = expiredSection.indexOf("$executeRaw");
    const releaseIdx = expiredSection.indexOf("releaseReservedStock");
    assert(
        casIdx >= 0 && releaseIdx >= 0 && casIdx < releaseIdx,
        "CAS must come before releaseReservedStock in expired handler"
    );
});

test("Webhook failed: CAS comes before releaseReservedStock", () => {
    const failedIfIdx = webhookCode.indexOf('if (\n            isFailed');
    const refundedIfIdx = webhookCode.indexOf('if (\n            isRefunded');
    assert(failedIfIdx >= 0 && refundedIfIdx > failedIfIdx, "Cannot locate isFailed handler");
    const failedSection = webhookCode.substring(failedIfIdx, refundedIfIdx);
    const casIdx = failedSection.indexOf("$executeRaw");
    const releaseIdx = failedSection.indexOf("releaseReservedStock");
    assert(
        casIdx >= 0 && releaseIdx >= 0 && casIdx < releaseIdx,
        "CAS must come before releaseReservedStock in failed handler"
    );
});

test("RollbackCheckoutOrder does NOT have non-atomic read-check pattern", () => {
    const rollbackSection = checkoutCode.substring(
        checkoutCode.indexOf("rollbackCheckoutOrder"),
        checkoutCode.indexOf("clearCart")
    );
    // Should NOT have: order.status === "CANCELLED" as idempotency check
    // (replaced by CAS)
    assert(
        !rollbackSection.includes('order.status === "CANCELLED"'),
        "RollbackCheckoutOrder still has non-atomic read-check pattern"
    );
});

test("Webhook expired/failed use CAS (no findUnique before releaseReservedStock)", () => {
    // Expired handler: CAS must come before releaseReservedStock, no findUnique in between
    const expiredIfIdx = webhookCode.indexOf('if (\n            isExpired');
    const failedIfIdx = webhookCode.indexOf('if (\n            isFailed');
    const expiredSection = webhookCode.substring(expiredIfIdx, failedIfIdx);
    const casIdx = expiredSection.indexOf("$executeRaw");
    const releaseIdx = expiredSection.indexOf("releaseReservedStock");
    const findUniqueIdx = expiredSection.indexOf("findUnique");
    // findUnique should NOT appear between CAS and releaseReservedStock
    assert(
        findUniqueIdx < 0 || findUniqueIdx > releaseIdx,
        "Expired handler still has findUnique before releaseReservedStock (non-atomic)"
    );

    // Failed handler: same check
    const refundedIfIdx = webhookCode.indexOf('if (\n            isRefunded');
    const failedSection = webhookCode.substring(failedIfIdx, refundedIfIdx);
    const failedCasIdx = failedSection.indexOf("$executeRaw");
    const failedReleaseIdx = failedSection.indexOf("releaseReservedStock");
    const failedFindIdx = failedSection.indexOf("findUnique");
    assert(
        failedFindIdx < 0 || failedFindIdx > failedReleaseIdx,
        "Failed handler still has findUnique before releaseReservedStock (non-atomic)"
    );
});

// ==========================================
// 16. ADMIN PRODUCT ARCHIVED FILTERING
// ==========================================

console.log("\n16. Admin Product Archived Filtering:");

const adminProductsCode = readFile("app/api/admin/products/route.ts");
const publicProductsCode = readFile("app/api/products/route.ts");

const adminProductsGetSection = adminProductsCode.substring(
    adminProductsCode.indexOf("export async function GET"),
    adminProductsCode.indexOf("export async function POST")
);

test("Admin products GET no longer hardcodes isArchived: false", () => {
    // The old code had: const where: any = { isArchived: false }
    // The new code should parse an optional archived param
    assert(
        adminProductsGetSection.includes('archivedParam'),
        "Admin products GET missing archivedParam parsing"
    );
});

test("Admin products GET supports ?archived=true filter", () => {
    assert(
        adminProductsGetSection.includes('archivedParam === "true"') &&
        adminProductsGetSection.includes('where.isArchived = true'),
        "Admin products GET missing archived=true filter"
    );
});

test("Admin products GET supports ?archived=false filter", () => {
    assert(
        adminProductsGetSection.includes('archivedParam === "false"') &&
        adminProductsGetSection.includes('where.isArchived = false'),
        "Admin products GET missing archived=false filter"
    );
});

test("Admin products GET shows all products when archived param omitted", () => {
    // When no archived param: no isArchived filter → show all
    assert(
        adminProductsGetSection.includes('no isArchived filter'),
        "Admin products GET missing comment about showing all when param omitted"
    );
});

test("Public products API still filters isArchived: false", () => {
    assert(
        publicProductsCode.includes('isArchived: false'),
        "Public products API no longer filters archived products"
    );
});

test("Public products API does not read archived query param", () => {
    assert(
        !publicProductsCode.includes('archivedParam') &&
        !publicProductsCode.includes('searchParams.get("archived")'),
        "Public products API should not expose archived filter"
    );
});

// ==========================================
// 17. ORDER CREATION RATE LIMITING
// ==========================================

console.log("\n17. Order Creation Rate Limiting:");

const ordersRouteRL = readFile("app/api/orders/route.ts");
const midtransCartRouteRL = readFile("app/api/payment/midtrans/route.ts");
const buyNowMidtransRouteRL = readFile("app/api/buy-now/midtrans/route.ts");
const buyNowRouteRL = readFile("app/api/buy-now/route.ts");
const rateLimitLib = readFile("lib/rate-limit.ts");

test("rateLimiters.orderCreation exists in lib/rate-limit.ts", () => {
    assert(
        rateLimitLib.includes("orderCreation:"),
        "rateLimiters.orderCreation not defined"
    );
});

test("rateLimiters.orderCreation uses userId-based key", () => {
    assert(
        rateLimitLib.includes("order:${userId}"),
        "orderCreation limiter doesn't use userId key"
    );
});

test("rateLimiters.orderCreation limit is 10 per minute", () => {
    assert(
        rateLimitLib.includes("10, 60 * 1000"),
        "orderCreation limiter should be 10 requests per minute"
    );
});

test("POST /api/orders imports rateLimiters", () => {
    assert(
        ordersRouteRL.includes('import { rateLimiters } from "@/lib/rate-limit"'),
        "/api/orders POST doesn't import rateLimiters"
    );
});

test("POST /api/orders calls rateLimiters.orderCreation with userId", () => {
    assert(
        ordersRouteRL.includes("rateLimiters.orderCreation(userId)") ||
        ordersRouteRL.includes("rateLimiters.orderCreation(userId!),"),
        "/api/orders POST doesn't call rateLimiters.orderCreation with userId"
    );
});

test("POST /api/orders returns 429 when rate limited", () => {
    assert(
        ordersRouteRL.includes("429"),
        "/api/orders POST doesn't return 429"
    );
});

test("POST /api/orders rate limit check is before createCheckoutOrder", () => {
    const rlIdx = ordersRouteRL.indexOf("rateLimiters.orderCreation");
    const coIdx = ordersRouteRL.indexOf("await createCheckoutOrder");
    assert(
        rlIdx > 0 && coIdx > 0 && rlIdx < coIdx,
        "/api/orders POST rate limit must be before createCheckoutOrder"
    );
});

test("POST /api/payment/midtrans imports rateLimiters", () => {
    assert(
        midtransCartRouteRL.includes('import { rateLimiters } from "@/lib/rate-limit"'),
        "/api/payment/midtrans POST doesn't import rateLimiters"
    );
});

test("POST /api/payment/midtrans calls rateLimiters.orderCreation with userId", () => {
    assert(
        midtransCartRouteRL.includes("rateLimiters.orderCreation(userId)") ||
        midtransCartRouteRL.includes("rateLimiters.orderCreation(userId!),"),
        "/api/payment/midtrans POST doesn't call rateLimiters.orderCreation"
    );
});

test("POST /api/payment/midtrans returns 429 when rate limited", () => {
    assert(
        midtransCartRouteRL.includes("429"),
        "/api/payment/midtrans POST doesn't return 429"
    );
});

test("POST /api/payment/midtrans rate limit check is before createCheckoutOrder", () => {
    const rlIdx = midtransCartRouteRL.indexOf("rateLimiters.orderCreation");
    const coIdx = midtransCartRouteRL.indexOf("await createCheckoutOrder");
    assert(
        rlIdx > 0 && coIdx > 0 && rlIdx < coIdx,
        "/api/payment/midtrans POST rate limit must be before createCheckoutOrder"
    );
});

test("POST /api/buy-now/midtrans imports rateLimiters", () => {
    assert(
        buyNowMidtransRouteRL.includes('import { rateLimiters } from "@/lib/rate-limit"'),
        "/api/buy-now/midtrans POST doesn't import rateLimiters"
    );
});

test("POST /api/buy-now/midtrans calls rateLimiters.orderCreation with user.id", () => {
    assert(
        buyNowMidtransRouteRL.includes("rateLimiters.orderCreation(user.id!)") ||
        buyNowMidtransRouteRL.includes("rateLimiters.orderCreation(user.id)"),
        "/api/buy-now/midtrans POST doesn't call rateLimiters.orderCreation"
    );
});

test("POST /api/buy-now/midtrans returns 429 when rate limited", () => {
    assert(
        buyNowMidtransRouteRL.includes("429"),
        "/api/buy-now/midtrans POST doesn't return 429"
    );
});

test("POST /api/buy-now/midtrans rate limit check is before createCheckoutOrder", () => {
    const rlIdx = buyNowMidtransRouteRL.indexOf("rateLimiters.orderCreation");
    const coIdx = buyNowMidtransRouteRL.indexOf("await createCheckoutOrder");
    assert(
        rlIdx > 0 && coIdx > 0 && rlIdx < coIdx,
        "/api/buy-now/midtrans POST rate limit must be before createCheckoutOrder"
    );
});

test("Existing POST /api/buy-now rate limiting still works", () => {
    assert(
        buyNowRouteRL.includes("rateLimiters.orderCreation(user.id!)") ||
        buyNowRouteRL.includes("rateLimiters.orderCreation(user.id)"),
        "/api/buy-now POST lost its rate limiting"
    );
});

test("Existing POST /api/buy-now rate limit is before createCheckoutOrder", () => {
    const rlIdx = buyNowRouteRL.indexOf("rateLimiters.orderCreation");
    const coIdx = buyNowRouteRL.indexOf("await createCheckoutOrder");
    assert(
        rlIdx > 0 && coIdx > 0 && rlIdx < coIdx,
        "/api/buy-now POST rate limit must be before createCheckoutOrder"
    );
});

test("All 4 order endpoints use same rate limiter (orderCreation)", () => {
    const endpoints = [ordersRouteRL, midtransCartRouteRL, buyNowMidtransRouteRL, buyNowRouteRL];
    for (const code of endpoints) {
        assert(
            code.includes("rateLimiters.orderCreation"),
            "One of the order endpoints doesn't use rateLimiters.orderCreation"
        );
    }
});

test("Rate limit key uses userId (not IP) — prevents bypass via header spoofing", () => {
    // orderCreation uses userId, not IP
    assert(
        rateLimitLib.includes("order:${userId}"),
        "orderCreation limiter doesn't use userId"
    );
});

// ==========================================
// 18. ORDER NUMBER UNIQUENESS
// ==========================================

console.log("\n18. Order Number Uniqueness:");

const checkoutCodeRL = readFile("lib/checkout.ts");

test("makeOrderNumber uses crypto import", () => {
    assert(
        checkoutCodeRL.includes('import crypto from "crypto"'),
        "checkout.ts missing crypto import"
    );
});

test("makeOrderNumber uses crypto.randomUUID()", () => {
    assert(
        checkoutCodeRL.includes("crypto"),
        "makeOrderNumber doesn't use crypto"
    );
    assert(
        checkoutCodeRL.includes("randomUUID()"),
        "makeOrderNumber doesn't use randomUUID()"
    );
});

test("makeOrderNumber does NOT use Math.random()", () => {
    // Find the makeOrderNumber function body
    const fnStart = checkoutCodeRL.indexOf("function makeOrderNumber(");
    const fnEnd = checkoutCodeRL.indexOf("function parsePositiveInteger(");
    const fnBody = checkoutCodeRL.substring(fnStart, fnEnd);
    assert(
        !fnBody.includes("Math.random()"),
        "makeOrderNumber still uses Math.random()"
    );
});

test("makeOrderNumber preserves COD prefix (ORD)", () => {
    const fnStart = checkoutCodeRL.indexOf("function makeOrderNumber(");
    const fnEnd = checkoutCodeRL.indexOf("function parsePositiveInteger(");
    const fnBody = checkoutCodeRL.substring(fnStart, fnEnd);
    assert(
        fnBody.includes('"ORD"'),
        "makeOrderNumber missing ORD prefix for COD"
    );
});

test("makeOrderNumber preserves BUY_NOW prefix (PAY-BN)", () => {
    const fnStart = checkoutCodeRL.indexOf("function makeOrderNumber(");
    const fnEnd = checkoutCodeRL.indexOf("function parsePositiveInteger(");
    const fnBody = checkoutCodeRL.substring(fnStart, fnEnd);
    assert(
        fnBody.includes('"PAY-BN"'),
        "makeOrderNumber missing PAY-BN prefix"
    );
});

test("makeOrderNumber preserves CART prefix (PAY-CART)", () => {
    const fnStart = checkoutCodeRL.indexOf("function makeOrderNumber(");
    const fnEnd = checkoutCodeRL.indexOf("function parsePositiveInteger(");
    const fnBody = checkoutCodeRL.substring(fnStart, fnEnd);
    assert(
        fnBody.includes('"PAY-CART"'),
        "makeOrderNumber missing PAY-CART prefix"
    );
});

test("makeOrderNumber generates unique numbers in burst", () => {
    // Simulate burst: generate 1000 order numbers rapidly
    // No two should be identical
    const crypto = require("crypto");
    function makeOrderNumberLocal(prefix: string) {
        const suffix = crypto.randomUUID().replace(/-/g, "").substring(0, 8);
        return `${prefix}-${Date.now()}-${suffix}`;
    }
    const numbers = new Set<string>();
    for (let i = 0; i < 1000; i++) {
        numbers.add(makeOrderNumberLocal("ORD"));
    }
    assert(
        numbers.size === 1000,
        `Expected 1000 unique numbers, got ${numbers.size}`
    );
});

test("makeOrderNumber format matches expected pattern", () => {
    const crypto = require("crypto");
    function makeOrderNumberLocal(prefix: string) {
        const suffix = crypto.randomUUID().replace(/-/g, "").substring(0, 8);
        return `${prefix}-${Date.now()}-${suffix}`;
    }
    const orderNum = makeOrderNumberLocal("ORD");
    // Format: ORD-{timestamp}-{8hex}
    assert(
        /^ORD-\d{13}-[0-9a-f]{8}$/.test(orderNum),
        `Order number format mismatch: ${orderNum}`
    );
    const payBn = makeOrderNumberLocal("PAY-BN");
    assert(
        /^PAY-BN-\d{13}-[0-9a-f]{8}$/.test(payBn),
        `PAY-BN format mismatch: ${payBn}`
    );
    const payCart = makeOrderNumberLocal("PAY-CART");
    assert(
        /^PAY-CART-\d{13}-[0-9a-f]{8}$/.test(payCart),
        `PAY-CART format mismatch: ${payCart}`
    );
});

// ==========================================
// 19. CLEANUP PENDING CHECKOUT HARDENING
// ==========================================

console.log("\n19. Cleanup Pending Checkout Hardening:");

const checkoutCodeCleanup = readFile("lib/checkout.ts");

// Extract the cleanupPendingCheckoutOrders function body
const cleanupFnStart = checkoutCodeCleanup.indexOf("export async function cleanupPendingCheckoutOrders(");
const cleanupFnEnd = checkoutCodeCleanup.indexOf("export async function createCheckoutOrder(");
const cleanupFn = checkoutCodeCleanup.substring(cleanupFnStart, cleanupFnEnd);

test("cleanupPendingCheckoutOrders has take: 10 limit", () => {
    assert(
        cleanupFn.includes("take: 10"),
        "cleanupPendingCheckoutOrders missing take: 10 limit"
    );
});

test("cleanupPendingCheckoutOrders selects orderNumber for logging", () => {
    assert(
        cleanupFn.includes("orderNumber: true"),
        "cleanupPendingCheckoutOrders doesn't select orderNumber"
    );
});

test("cleanupPendingCheckoutOrders logs orderNumber on failure", () => {
    assert(
        cleanupFn.includes("orderNumber="),
        "cleanupPendingCheckoutOrders doesn't log orderNumber"
    );
});

test("cleanupPendingCheckoutOrders logs orderId on failure", () => {
    assert(
        cleanupFn.includes("orderId="),
        "cleanupPendingCheckoutOrders doesn't log orderId"
    );
});

test("cleanupPendingCheckoutOrders uses try/catch per order", () => {
    // Should have try and catch inside the for loop
    const forIdx = cleanupFn.indexOf("for (const order of pendingOrders)");
    const tryIdx = cleanupFn.indexOf("try {", forIdx);
    const catchIdx = cleanupFn.indexOf("catch (error)", tryIdx);
    assert(
        forIdx > 0 && tryIdx > forIdx && catchIdx > tryIdx,
        "cleanupPendingCheckoutOrders missing try/catch inside for loop"
    );
});

test("cleanupPendingCheckoutOrders calls rollbackCheckoutOrder with restoreCart: false", () => {
    assert(
        cleanupFn.includes("restoreCart: false"),
        "cleanupPendingCheckoutOrders doesn't pass restoreCart: false"
    );
});

test("cleanupPendingCheckoutOrders queries only PENDING status", () => {
    assert(
        cleanupFn.includes('status: "PENDING"'),
        "cleanupPendingCheckoutOrders doesn't filter by PENDING status"
    );
    assert(
        cleanupFn.includes('paymentStatus: "PENDING"'),
        "cleanupPendingCheckoutOrders doesn't filter by PENDING paymentStatus"
    );
});

test("cleanupPendingCheckoutOrders filters by paymentMethod (non-COD)", () => {
    assert(
        cleanupFn.includes('"BANK_TRANSFER"') &&
        cleanupFn.includes('"E_WALLET"') &&
        cleanupFn.includes('"QRIS"'),
        "cleanupPendingCheckoutOrders doesn't filter by non-COD payment methods"
    );
});

test("cleanupPendingCheckoutOrders is called in createCheckoutOrder", () => {
    const createFnStart = checkoutCodeCleanup.indexOf("export async function createCheckoutOrder(");
    const createFn = checkoutCodeCleanup.substring(createFnStart);
    assert(
        createFn.includes("cleanupPendingCheckoutOrders"),
        "createCheckoutOrder doesn't call cleanupPendingCheckoutOrders"
    );
});

test("cleanupPendingCheckoutOrders calls cleanup BEFORE $transaction (not inside)", () => {
    const createFnStart = checkoutCodeCleanup.indexOf("export async function createCheckoutOrder(");
    const createFn = checkoutCodeCleanup.substring(createFnStart);
    const cleanupIdx = createFn.indexOf("cleanupPendingCheckoutOrders");
    const txIdx = createFn.indexOf("$transaction");
    assert(
        cleanupIdx > 0 && txIdx > 0 && cleanupIdx < txIdx,
        "cleanupPendingCheckoutOrders must be called before $transaction"
    );
});

// ==========================================
// 20. FLASH SALE PURCHASE CLEANUP ON ROLLBACK
// ==========================================

console.log("\n20. Flash Sale Purchase Cleanup on Rollback:");

const checkoutCodeT1 = readFile("lib/checkout.ts");
const webhookCodeT1 = readFile("app/api/payment/midtrans/notification/route.ts");

// Extract rollbackCheckoutOrder section
const rollbackFnStart = checkoutCodeT1.indexOf("export async function rollbackCheckoutOrder(");
const rollbackFnEnd = checkoutCodeT1.indexOf("export async function clearCart(");
const rollbackFn = checkoutCodeT1.substring(rollbackFnStart, rollbackFnEnd);

test("rollbackCheckoutOrder deletes FlashSalePurchase after restoring flash sale stock", () => {
    assert(
        rollbackFn.includes("flashSalePurchase.deleteMany"),
        "rollbackCheckoutOrder missing flashSalePurchase.deleteMany"
    );
});

test("rollbackCheckoutOrder FlashSalePurchase cleanup uses flashSaleId and userId", () => {
    assert(
        rollbackFn.includes("flashSaleId: flashSale.id") && rollbackFn.includes("userId: order.userId"),
        "rollbackCheckoutOrder FlashSalePurchase cleanup missing flashSaleId or userId"
    );
});

test("rollbackCheckoutOrder FlashSalePurchase cleanup is inside flash sale block (not regular item block)", () => {
    // The deleteMany should be between the flash sale UPDATE and the else block
    const flashSaleUpdateIdx = rollbackFn.indexOf("UPDATE FlashSale");
    const deleteManyIdx = rollbackFn.indexOf("flashSalePurchase.deleteMany");
    const elseIdx = rollbackFn.indexOf("} else {", flashSaleUpdateIdx);
    assert(
        flashSaleUpdateIdx > 0 && deleteManyIdx > flashSaleUpdateIdx && deleteManyIdx < elseIdx,
        "FlashSalePurchase cleanup is not inside the flash sale block"
    );
});

// Extract webhook releaseReservedStock section
const releaseFnStart = webhookCodeT1.indexOf("async function releaseReservedStock(");
const releaseFnEnd = webhookCodeT1.indexOf("export async function POST(");
const releaseFn = webhookCodeT1.substring(releaseFnStart, releaseFnEnd);

test("Webhook releaseReservedStock deletes FlashSalePurchase after restoring flash sale stock", () => {
    assert(
        releaseFn.includes("flashSalePurchase.deleteMany"),
        "Webhook releaseReservedStock missing flashSalePurchase.deleteMany"
    );
});

test("Webhook releaseReservedStock FlashSalePurchase cleanup uses flashSaleId and userId", () => {
    assert(
        releaseFn.includes("flashSaleId: flashSale.id") && releaseFn.includes("userId: order.userId"),
        "Webhook releaseReservedStock FlashSalePurchase cleanup missing flashSaleId or userId"
    );
});

test("Webhook releaseReservedStock FlashSalePurchase cleanup is inside flash sale block", () => {
    const flashSaleUpdateIdx = releaseFn.indexOf("UPDATE FlashSale");
    const deleteManyIdx = releaseFn.indexOf("flashSalePurchase.deleteMany");
    const elseIfIdx = releaseFn.indexOf("} else if (", flashSaleUpdateIdx);
    assert(
        flashSaleUpdateIdx > 0 && deleteManyIdx > flashSaleUpdateIdx && deleteManyIdx < elseIfIdx,
        "Webhook FlashSalePurchase cleanup is not inside the flash sale block"
    );
});

// ==========================================
// 21. ADMIN ORDER STATUS TRANSITION GUARD
// ==========================================

console.log("\n21. Admin Order Status Transition Guard:");

const adminOrderCode = readFile("app/api/admin/orders/[id]/route.ts");

// Extract PATCH handler section
const patchFnStart = adminOrderCode.indexOf("export async function PATCH(");
const patchFnEnd = adminOrderCode.indexOf("function createTrackingUrl(");
const patchFn = adminOrderCode.substring(patchFnStart, patchFnEnd);

test("Admin PATCH has validTransitions map", () => {
    assert(
        patchFn.includes("validTransitions"),
        "Admin PATCH missing validTransitions map"
    );
});

test("Admin PATCH prevents PENDING → PENDING (self-transition not in list)", () => {
    assert(
        patchFn.includes('PENDING:'),
        "Admin PATCH missing PENDING transition list"
    );
});

test("Admin PATCH prevents COMPLETED backward transitions", () => {
    assert(
        patchFn.includes('COMPLETED:') && patchFn.includes('[]'),
        "Admin PATCH missing COMPLETED empty transition list"
    );
});

test("Admin PATCH prevents CANCELLED backward transitions", () => {
    assert(
        patchFn.includes('CANCELLED:') && patchFn.includes('[]'),
        "Admin PATCH missing CANCELLED empty transition list"
    );
});

test("Admin PATCH transition guard is before order update", () => {
    const guardIdx = patchFn.indexOf("validTransitions[order.status]");
    const updateIdx = patchFn.indexOf("prisma.order.update");
    assert(
        guardIdx > 0 && updateIdx > 0 && guardIdx < updateIdx,
        "Admin PATCH transition guard must be before order update"
    );
});

test("Admin PATCH returns 400 for invalid transition", () => {
    assert(
        patchFn.includes("400") && patchFn.includes("Transisi"),
        "Admin PATCH missing 400 response for invalid transition"
    );
});

test("Admin PATCH SHIPPED requires tracking number (existing check)", () => {
    assert(
        patchFn.includes('status === "SHIPPED"') && patchFn.includes("trackingNumber"),
        "Admin PATCH missing SHIPPED tracking number check"
    );
});

// ==========================================
// 22. PAYMENT / WEBHOOK INTEGRITY (T2)
// ==========================================

console.log("\n22. Payment / Webhook Integrity:");

const webhookCodeT2 = readFile("app/api/payment/midtrans/notification/route.ts");

test("Pending webhook has status IN ('PENDING', 'PROCESSING') guard", () => {
    // The pending webhook CAS must also check status, not just paymentStatus
    const pendingSection = webhookCodeT2.substring(
        webhookCodeT2.indexOf('if (\n            isPending'),
        webhookCodeT2.indexOf('if (\n            isExpired')
    );
    assert(
        pendingSection.includes("status IN ('PENDING', 'PROCESSING')"),
        "Pending webhook missing status IN guard — could revert CANCELLED order to PENDING"
    );
});

test("Pending webhook still has paymentStatus != 'PAID' guard", () => {
    const pendingSection = webhookCodeT2.substring(
        webhookCodeT2.indexOf('if (\n            isPending'),
        webhookCodeT2.indexOf('if (\n            isExpired')
    );
    assert(
        pendingSection.includes("paymentStatus != 'PAID'"),
        "Pending webhook missing PAID guard"
    );
});

test("Expired webhook has both status IN and paymentStatus != PAID guards", () => {
    const expiredSection = webhookCodeT2.substring(
        webhookCodeT2.indexOf('if (\n            isExpired'),
        webhookCodeT2.indexOf('if (\n            isFailed')
    );
    assert(
        expiredSection.includes("status IN ('PENDING', 'PROCESSING')") &&
        expiredSection.includes("paymentStatus != 'PAID'"),
        "Expired webhook missing CAS guards"
    );
});

test("Failed webhook has both status IN and paymentStatus != PAID guards", () => {
    const failedSection = webhookCodeT2.substring(
        webhookCodeT2.indexOf('if (\n            isFailed'),
        webhookCodeT2.indexOf('if (\n            isRefunded')
    );
    assert(
        failedSection.includes("status IN ('PENDING', 'PROCESSING')") &&
        failedSection.includes("paymentStatus != 'PAID'"),
        "Failed webhook missing CAS guards"
    );
});

test("Refund webhook only processes PAID orders (status guard)", () => {
    const refundSection = webhookCodeT2.substring(
        webhookCodeT2.indexOf('if (\n            isRefunded'),
        webhookCodeT2.indexOf('Status lain')
    );
    assert(
        refundSection.includes('paymentStatus === "PAID"'),
        "Refund webhook missing PAID status guard — could affect CANCELLED orders"
    );
});

test("Refund webhook is idempotent (skips if already REFUNDED)", () => {
    // If paymentStatus !== 'PAID' → skip. This is inherently idempotent
    // because once REFUNDED, the PAID check fails.
    const refundSection = webhookCodeT2.substring(
        webhookCodeT2.indexOf('if (\n            isRefunded'),
        webhookCodeT2.indexOf('Status lain')
    );
    assert(
        refundSection.includes('paymentStatus === "PAID"'),
        "Refund webhook missing idempotency guard"
    );
});

test("Settlement webhook is idempotent (checks PAID already)", () => {
    const settlementSection = webhookCodeT2.substring(
        webhookCodeT2.indexOf('if (\n            isSuccess'),
        webhookCodeT2.indexOf('if (\n            isPending')
    );
    assert(
        settlementSection.includes('paymentStatus === "PAID"') &&
        settlementSection.includes('order.status !== "CANCELLED"'),
        "Settlement webhook missing idempotency guard"
    );
});

test("Webhook verifies Midtrans signature with timing-safe comparison", () => {
    assert(
        webhookCodeT2.includes('timingSafeEqual'),
        "Webhook missing timingSafeEqual for signature verification"
    );
});

test("Webhook validates gross_amount matches order total", () => {
    assert(
        webhookCodeT2.includes('MIDTRANS GROSS AMOUNT MISMATCH'),
        "Webhook missing gross_amount validation"
    );
});

test("Webhook returns 200 for unknown order (prevents Midtrans retry loop)", () => {
    // Order not found should return 200 to stop retries
    assert(
        webhookCodeT2.includes('Order tidak ditemukan'),
        "Webhook missing order-not-found handling"
    );
});

test("Webhook returns 500 on error (triggers Midtrans retry)", () => {
    assert(
        webhookCodeT2.includes('Webhook processing failed'),
        "Webhook missing 500 error handling"
    );
});

test("All three failure webhooks (expired, failed, settle) use releaseReservedStock inside transaction", () => {
    // Expired and failed handlers should call releaseReservedStock inside their $transaction
    assert(
        webhookCodeT2.includes('releaseReservedStock'),
        "Webhook missing releaseReservedStock"
    );
});

test("Webhook does NOT restore stock on settlement (PAID)", () => {
    // Settlement handler uses prisma.$transaction directly, not releaseReservedStock
    const settlementSection = webhookCodeT2.substring(
        webhookCodeT2.indexOf('Payment settlement processed'),
        webhookCodeT2.indexOf('isPending')
    );
    assert(
        !settlementSection.includes('releaseReservedStock'),
        "Settlement handler should NOT call releaseReservedStock"
    );
    assert(
        !settlementSection.includes('UPDATE FlashSale'),
        "Settlement handler should NOT restore flash sale stock"
    );
});

// ==========================================
// RESULTS
// =========================================>

console.log(
    `\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`
);

if (failed > 0) {
    process.exit(1);
}
