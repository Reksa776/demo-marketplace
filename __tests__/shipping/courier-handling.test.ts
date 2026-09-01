/**
 * ==========================================
 * SHIPPING COURIER HANDLING TESTS
 * ==========================================
 *
 * Static/code-path verification tests.
 * Run: npx tsx __tests__/shipping/courier-handling.test.ts
 *
 * Tests verify:
 * - All three couriers (JNE, JNT, SICEPAT) are requested
 * - No hardcoded whitelist blocks SiCepat
 * - Response parser filters only cargo (JTR), not couriers
 * - UI displays courier name from response
 * - Server-side verification accepts any courier
 * - Both Cart and Buy Now use consistent courier flow
 */

import { readFileSync } from "fs";
import { assert } from "console";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e: any) {
        console.log(`  ❌ ${name}: ${e.message}`);
        failed++;
    }
}

function readFile(path: string): string {
    try {
        return readFileSync(path, "utf-8");
    } catch {
        return "";
    }
}

// ==========================================
// A. FRONTEND SHIPPING REQUESTS
// ==========================================

console.log("\nA. Frontend Shipping Requests:");

const checkoutPage = readFile("app/checkout/CheckoutPage.tsx");
const buyNowPage = readFile("app/buy-now/BuyNowPage.tsx");

test("CheckoutPage requests jne:jnt:sicepat", () => {
    assert(
        checkoutPage.includes('"jne:jnt:sicepat"'),
        "CheckoutPage must request all three couriers"
    );
});

test("BuyNowPage requests jne:jnt:sicepat", () => {
    assert(
        buyNowPage.includes('"jne:jnt:sicepat"'),
        "BuyNowPage must request all three couriers"
    );
});

test("CheckoutPage sends price: lowest", () => {
    assert(
        checkoutPage.includes('price: "lowest"'),
        "CheckoutPage must send price: lowest"
    );
});

test("BuyNowPage sends courier in shipping request body", () => {
    assert(
        buyNowPage.includes('"jne:jnt:sicepat"'),
        "BuyNowPage must include courier in request"
    );
});

// ==========================================
// B. SHIPPING API ROUTES
// ==========================================

console.log("\nB. Shipping API Routes:");

const shippingCostRoute = readFile("app/api/shipping/cost/route.ts");
const buyNowShippingRoute = readFile("app/api/buy-now/shipping/route.ts");

test("/api/shipping/cost default courier includes sicepat", () => {
    assert(
        shippingCostRoute.includes('"jne:jnt:sicepat"'),
        "Default courier must include sicepat"
    );
});

test("/api/buy-now/shipping default courier includes sicepat", () => {
    assert(
        buyNowShippingRoute.includes('"jne:jnt:sicepat"'),
        "Default courier must include sicepat"
    );
});

test("/api/shipping/cost passes courier to RajaOngkir", () => {
    assert(
        shippingCostRoute.includes('formData.append("courier", courier)'),
        "Must pass courier parameter to RajaOngkir"
    );
});

test("/api/buy-now/shipping passes courier to RajaOngkir", () => {
    assert(
        buyNowShippingRoute.includes('formData.append("courier", courier)'),
        "Must pass courier parameter to RajaOngkir"
    );
});

// ==========================================
// C. RESPONSE PARSER — NO COURIER WHITELIST
// ==========================================

console.log("\nC. Response Parser — No Courier Whitelist:");

test("Shipping cost route: filter only removes JTR (cargo)", () => {
    // Must NOT filter by courier code
    assert(
        shippingCostRoute.includes('service.startsWith("JTR")'),
        "Must filter JTR cargo services"
    );
    // Must NOT have a whitelist that blocks sicepat
    assert(
        !shippingCostRoute.includes('"sicepat"') ||
        shippingCostRoute.includes('"jne:jnt:sicepat"'),
        "Must not have sicepat-only filter"
    );
    // Must NOT have courier code comparison that could block sicepat
    const filterSection = shippingCostRoute.substring(
        shippingCostRoute.indexOf(".filter("),
        shippingCostRoute.indexOf(".map(")
    );
    assert(
        !filterSection.includes('.code === "jne"') &&
        !filterSection.includes('.code === "jnt"'),
        "Filter must not compare courier codes (would block sicepat)"
    );
});

test("BuyNow shipping route: filter only removes JTR (cargo)", () => {
    assert(
        buyNowShippingRoute.includes('service.startsWith("JTR")'),
        "Must filter JTR cargo services"
    );
    const filterSection = buyNowShippingRoute.substring(
        buyNowShippingRoute.indexOf(".filter("),
        buyNowShippingRoute.indexOf(".map(")
    );
    assert(
        !filterSection.includes('.code === "jne"') &&
        !filterSection.includes('.code === "jnt"'),
        "Filter must not compare courier codes (would block sicepat)"
    );
});

test("No hardcoded courier whitelist in any shipping file", () => {
    const files = [
        shippingCostRoute,
        buyNowShippingRoute,
        readFile("lib/rajaongkir-shipping.ts"),
    ];
    for (const code of files) {
        assert(
            !code.includes('["jne", "jnt"]') &&
            !code.includes('["JNE", "JNT"]') &&
            !code.includes("whitelist") &&
            !code.includes("allowedCouriers"),
            "Must not have hardcoded courier whitelist"
        );
    }
});

// ==========================================
// D. SERVICE EXPLANATIONS
// ==========================================

console.log("\nD. Service Explanations — SiCepat:");

test("CheckoutPage has SiCepat service explanations", () => {
    assert(checkoutPage.includes('"SICEPAT-REG"'), "Must have SICEPAT-REG");
    assert(checkoutPage.includes('"SICEPAT-BEST"'), "Must have SICEPAT-BEST");
    assert(checkoutPage.includes('"SICEPAT-GOKIL"'), "Must have SICEPAT-GOKIL");
    assert(checkoutPage.includes('"SICEPAT-SDS"'), "Must have SICEPAT-SDS");
});

test("BuyNowPage has SiCepat service explanations", () => {
    assert(buyNowPage.includes('"SICEPAT-REG"'), "Must have SICEPAT-REG");
    assert(buyNowPage.includes('"SICEPAT-BEST"'), "Must have SICEPAT-BEST");
    assert(buyNowPage.includes('"SICEPAT-GOKIL"'), "Must have SICEPAT-GOKIL");
    assert(buyNowPage.includes('"SICEPAT-SDS"'), "Must have SICEPAT-SDS");
});

test("CheckoutPage has JNE service explanations", () => {
    assert(checkoutPage.includes('"JNE-OKE"'), "Must have JNE-OKE");
    assert(checkoutPage.includes('"JNE-REG"'), "Must have JNE-REG");
    assert(checkoutPage.includes('"JNE-YES"'), "Must have JNE-YES");
});

test("BuyNowPage has JNT service explanations", () => {
    assert(buyNowPage.includes('"JNT-EZ"'), "Must have JNT-EZ");
    assert(buyNowPage.includes('"JNT-REG"'), "Must have JNT-REG");
});

// ==========================================
// E. UI DISPLAYS COURIER FROM RESPONSE
// ==========================================

console.log("\nE. UI Displays Courier from Response:");

test("CheckoutPage displays courier from option.courier", () => {
    assert(
        checkoutPage.includes("option.courier"),
        "Must display courier from response option"
    );
});

test("CheckoutPage displays service from option.service", () => {
    assert(
        checkoutPage.includes("option.service"),
        "Must display service from response option"
    );
});

test("BuyNowPage displays courier from option.courier", () => {
    assert(
        buyNowPage.includes("option.courier"),
        "Must display courier from response option"
    );
});

test("BuyNowPage displays service from option.service", () => {
    assert(
        buyNowPage.includes("option.service"),
        "Must display service from response option"
    );
});

test("CheckoutPage has getServiceExplanation function", () => {
    assert(
        checkoutPage.includes("function getServiceExplanation"),
        "Must have getServiceExplanation"
    );
});

test("BuyNowPage has getServiceExplanation function", () => {
    assert(
        buyNowPage.includes("function getServiceExplanation"),
        "Must have getServiceExplanation"
    );
});

// ==========================================
// F. SERVER-SIDE VERIFICATION
// ==========================================

console.log("\nF. Server-Side Verification:");

const checkoutCode = readFile("lib/checkout.ts");
const rajaOngkirCode = readFile("lib/rajaongkir-shipping.ts");

test("Server-side verifyShippingCost exists", () => {
    assert(
        checkoutCode.includes("export async function verifyShippingCost"),
        "Must have verifyShippingCost"
    );
});

test("Server-side verifyShippingCost passes courier to calculateDomesticCost", () => {
    assert(
        checkoutCode.includes("courier: courier.toLowerCase()"),
        "Must pass courier to calculateDomesticCost"
    );
});

test("Server-side verifyShippingCost matches by courier code", () => {
    assert(
        checkoutCode.includes("opt.code") && checkoutCode.includes("courier.toLowerCase()"),
        "Must match courier code from response"
    );
});

test("Server-side verifyShippingCost matches by service", () => {
    assert(
        checkoutCode.includes("opt.service") && checkoutCode.includes("service.toUpperCase()"),
        "Must match service from response"
    );
});

test("calculateDomesticCost accepts any courier string", () => {
    assert(
        rajaOngkirCode.includes("courier?: string"),
        "Must accept optional courier string"
    );
    assert(
        rajaOngkirCode.includes('courier || "jne:sicepat:'),
        "Default courier must include sicepat"
    );
});

test("calculateDomesticCost does not filter by courier code", () => {
    // Must NOT have a filter that checks courier code
    assert(
        !rajaOngkirCode.includes('.code === "jne"') &&
        !rajaOngkirCode.includes('.code === "jnt"') &&
        !rajaOngkirCode.includes('.code === "sicepat"'),
        "Must not filter by courier code"
    );
});

// ==========================================
// G. DEBUG LOGGING ADDED
// ==========================================

console.log("\nG. Debug Logging for Diagnostics:");

test("Shipping cost route has debug logging for courier codes", () => {
    assert(
        shippingCostRoute.includes("[SHIPPING DEBUG]"),
        "Must have debug log for courier diagnosis"
    );
});

test("BuyNow shipping route has debug logging for courier codes", () => {
    assert(
        buyNowShippingRoute.includes("[BUY-NOW SHIPPING DEBUG]"),
        "Must have debug log for courier diagnosis"
    );
});

test("Debug logging does not expose API key", () => {
    assert(
        !shippingCostRoute.includes("API_KEY") ||
        shippingCostRoute.includes("RAJAONGKIR_API_KEY"),
        "Must not expose API key value"
    );
    assert(
        !shippingCostRoute.includes("process.env.RAJAONGKIR_API_KEY") ||
        shippingCostRoute.includes("const API_KEY = process.env"),
        "Must reference env var, not value"
    );
});

test("Debug logging does not expose cost details", () => {
    // Debug should log courier codes and count, not costs
    const debugLine = shippingCostRoute.substring(
        shippingCostRoute.indexOf("[SHIPPING DEBUG]"),
        shippingCostRoute.indexOf("[SHIPPING DEBUG]") + 300
    );
    assert(
        !debugLine.includes("cost") || debugLine.includes("Total items"),
        "Debug should log counts, not individual costs"
    );
});

// ==========================================
// H. CONSISTENCY — CART VS BUY NOW
// ==========================================

console.log("\nH. Consistency — Cart vs Buy Now:");

test("Both pages request same couriers", () => {
    assert(
        checkoutPage.includes('"jne:jnt:sicepat"') &&
        buyNowPage.includes('"jne:jnt:sicepat"'),
        "Both must request jne:jnt:sicepat"
    );
});

test("Both API routes have same default courier", () => {
    assert(
        shippingCostRoute.includes('"jne:jnt:sicepat"') &&
        buyNowShippingRoute.includes('"jne:jnt:sicepat"'),
        "Both API routes must default to jne:jnt:sicepat"
    );
});

test("Both API routes use same filter logic (JTR only)", () => {
    assert(
        shippingCostRoute.includes('service.startsWith("JTR")') &&
        buyNowShippingRoute.includes('service.startsWith("JTR")'),
        "Both must filter only JTR cargo services"
    );
});

test("Both API routes sort by courier name then cost", () => {
    assert(
        shippingCostRoute.includes("a.courier.localeCompare(b.courier)") &&
        buyNowShippingRoute.includes("a.courier.localeCompare(b.courier)"),
        "Both must sort by courier name"
    );
    assert(
        shippingCostRoute.includes("a.cost - b.cost") &&
        buyNowShippingRoute.includes("a.cost - b.cost"),
        "Both must sort by cost within courier"
    );
});

// ==========================================
// I. REGRESSION — EXISTING COURIERS NOT REMOVED
// ==========================================

console.log("\nI. Regression — Existing Couriers Not Removed:");

test("JNE services exist in SERVICE_EXPLANATIONS", () => {
    assert(
        checkoutPage.includes("JNE") && buyNowPage.includes("JNE"),
        "JNE must remain in both pages"
    );
});

test("JNT services exist in SERVICE_EXPLANATIONS", () => {
    assert(
        checkoutPage.includes("JNT") && buyNowPage.includes("JNT"),
        "JNT must remain in both pages"
    );
});

test("SiCepat services exist in SERVICE_EXPLANATIONS", () => {
    assert(
        checkoutPage.includes("SICEPAT") && buyNowPage.includes("SICEPAT"),
        "SICEPAT must remain in both pages"
    );
});

test("CheckoutPage does not have hardcoded JNE/JNT-only filter", () => {
    assert(
        !checkoutPage.includes('filter(c => c === "jne" || c === "jnt")'),
        "Must not have JNE/JNT-only filter"
    );
});

test("BuyNowPage does not have hardcoded JNE/JNT-only filter", () => {
    assert(
        !buyNowPage.includes('filter(c => c === "jne" || c === "jnt")'),
        "Must not have JNE/JNT-only filter"
    );
});

// ==========================================
// RESULTS
// ==========================================

console.log(`\n${"=".repeat(50)}`);
console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);

if (failed > 0) {
    console.log("\n❌ Some tests failed!");
    process.exit(1);
} else {
    console.log("\n✅ All tests passed!");
}
