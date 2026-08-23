/**
 * ==========================================
 * PROFILE PHONE + SHIPPING DISCOUNT TESTS
 * ==========================================
 *
 * Tests for:
 * - Profile phone update API
 * - Profile phone display/edit UI
 * - Shipping discount end-to-end
 *
 * Run: npx tsx __tests__/marketing/profile-phone-shipping.test.ts
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

console.log("\n=== PROFILE PHONE + SHIPPING DISCOUNT TESTS ===\n");

// ==========================================
// 1. PROFILE API — PHONE UPDATE
// ==========================================
console.log("1. Profile API — Phone Update:");

const profileApiCode = readFile("app/api/profile/route.ts");

test("PATCH /api/profile exists", () => {
    assert(profileApiCode.includes("export async function PATCH"), "Missing PATCH handler");
});

test("PATCH requires authentication", () => {
    assert(
        profileApiCode.includes("session?.user?.id") && profileApiCode.includes("401"),
        "PATCH must require authentication"
    );
});

test("PATCH uses session userId (not client-sent)", () => {
    assert(
        profileApiCode.includes("session.user.id") && !profileApiCode.includes("body.userId"),
        "PATCH must use session userId, not client-sent userId"
    );
});

test("PATCH validates phone format", () => {
    assert(
        profileApiCode.includes("phoneRegex") || profileApiCode.includes("format"),
        "PATCH must validate phone format"
    );
});

test("PATCH checks phone uniqueness", () => {
    assert(
        profileApiCode.includes("findFirst") && profileApiCode.includes("phone"),
        "PATCH must check phone uniqueness"
    );
});

test("PATCH handles duplicate phone (409)", () => {
    assert(
        profileApiCode.includes("409") || profileApiCode.includes("sudah digunakan"),
        "PATCH must return 409 for duplicate phone"
    );
});

test("PATCH allows clearing phone", () => {
    assert(
        profileApiCode.includes("null") && profileApiCode.includes("phone"),
        "PATCH must allow clearing phone (set to null)"
    );
});

test("PATCH updates only phone field", () => {
    assert(
        profileApiCode.includes("updateData") && profileApiCode.includes("phone"),
        "PATCH must update phone in updateData"
    );
});

test("PATCH returns updated user data", () => {
    assert(
        profileApiCode.includes("select") && profileApiCode.includes("phone"),
        "PATCH must return updated user data with phone"
    );
});

// ==========================================
// 2. PROFILE PAGE — SERVER COMPONENT
// ==========================================
console.log("\n2. Profile Page — Server Component:");

const profilePageCode = readFile("app/profile/page.tsx");

test("Profile page is a server component (no 'use client')", () => {
    assert(
        !profilePageCode.includes('"use client"'),
        "Profile page must be a server component"
    );
});

test("Profile page fetches user from database", () => {
    assert(
        profilePageCode.includes("prisma.user.findUnique"),
        "Profile page must fetch user from database"
    );
});

test("Profile page includes phone in select", () => {
    assert(
        profilePageCode.includes("phone: true"),
        "Profile page must include phone in select"
    );
});

test("Profile page passes user to client component", () => {
    assert(
        profilePageCode.includes("ProfileContent") && profilePageCode.includes("user={user}"),
        "Profile page must pass user to ProfileContent"
    );
});

test("Profile page requires auth", () => {
    assert(
        profilePageCode.includes("auth()") && profilePageCode.includes("redirect"),
        "Profile page must require auth and redirect if not logged in"
    );
});

// ==========================================
// 3. PROFILE CONTENT — CLIENT COMPONENT
// ==========================================
console.log("\n3. Profile Content — Client Component:");

const profileContentCode = readFile("app/profile/ProfileContent.tsx");

test("ProfileContent is a client component", () => {
    assert(
        profileContentCode.includes('"use client"'),
        "ProfileContent must be a client component"
    );
});

test("ProfileContent displays phone number", () => {
    assert(
        profileContentCode.includes("phone") && profileContentCode.includes("Nomor Telepon"),
        "ProfileContent must display phone number"
    );
});

test("ProfileContent has edit phone button", () => {
    assert(
        profileContentCode.includes("editingPhone") && profileContentCode.includes("Ubah"),
        "ProfileContent must have edit phone button"
    );
});

test("ProfileContent has phone input field", () => {
    assert(
        profileContentCode.includes("type=\"tel\"") && profileContentCode.includes("phoneInput"),
        "ProfileContent must have phone input field"
    );
});

test("ProfileContent saves phone via PATCH /api/profile", () => {
    assert(
        profileContentCode.includes("/api/profile") && profileContentCode.includes('method: "PATCH"'),
        "ProfileContent must save phone via PATCH /api/profile"
    );
});

test("ProfileContent shows empty state for missing phone", () => {
    assert(
        profileContentCode.includes("Belum diisi"),
        "ProfileContent must show 'Belum diisi' for missing phone"
    );
});

test("ProfileContent has cancel button", () => {
    assert(
        profileContentCode.includes("cancelEditPhone") || profileContentCode.includes("FiX"),
        "ProfileContent must have cancel button"
    );
});

test("ProfileContent shows save/cancel buttons during edit", () => {
    assert(
        profileContentCode.includes("FiCheck") && profileContentCode.includes("FiX"),
        "ProfileContent must show save (check) and cancel (X) buttons during edit"
    );
});

// ==========================================
// 4. SHIPPING DISCOUNT — CHECKOUT
// ==========================================
console.log("\n4. Shipping Discount — Checkout:");

const checkoutPageCode = readFile("app/checkout/CheckoutPage.tsx");
const checkoutLibCode = readFile("lib/checkout.ts");

test("Checkout has shipping discount state", () => {
    assert(
        checkoutPageCode.includes("shippingDiscount") && checkoutPageCode.includes("shippingDiscountName"),
        "Checkout must have shipping discount state"
    );
});

test("Checkout fetches shipping discount preview", () => {
    assert(
        checkoutPageCode.includes("shipping/discount-preview"),
        "Checkout must fetch shipping discount preview"
    );
});

test("Checkout grandTotal uses finalShippingCost", () => {
    assert(
        checkoutPageCode.includes("finalShippingCost") && checkoutPageCode.includes("shippingCost - shippingDiscount"),
        "Checkout grandTotal must use finalShippingCost"
    );
});

test("Checkout displays shipping discount", () => {
    assert(
        checkoutPageCode.includes("Diskon Ongkir"),
        "Checkout must display shipping discount"
    );
});

test("Checkout server-side applies shipping discount", () => {
    assert(
        checkoutLibCode.includes("calculateShippingDiscount"),
        "Checkout server must apply shipping discount"
    );
});

test("Checkout uses finalShippingCost for order total", () => {
    assert(
        checkoutLibCode.includes("finalShippingCost"),
        "Checkout server must use finalShippingCost for order total"
    );
});

test("Checkout passes finalShippingCost to Midtrans", () => {
    const defIdx = checkoutLibCode.indexOf("function createMidtransItemDetails(");
    const callIdx = checkoutLibCode.indexOf("createMidtransItemDetails(", defIdx + 30);
    assert(callIdx > 0, "createMidtransItemDetails call not found");
    const callContext = checkoutLibCode.substring(callIdx, callIdx + 300);
    assert(
        callContext.includes("finalShippingCost"),
        "Midtrans item details must use finalShippingCost"
    );
});

// ==========================================
// 5. SHIPPING DISCOUNT — BUY NOW
// ==========================================
console.log("\n5. Shipping Discount — Buy Now:");

const buyNowPageCode = readFile("app/buy-now/BuyNowPage.tsx");

test("Buy Now has shipping discount state", () => {
    assert(
        buyNowPageCode.includes("shippingDiscount") && buyNowPageCode.includes("shippingDiscountName"),
        "Buy Now must have shipping discount state"
    );
});

test("Buy Now fetches shipping discount preview", () => {
    assert(
        buyNowPageCode.includes("shipping/discount-preview"),
        "Buy Now must fetch shipping discount preview"
    );
});

test("Buy Now grandTotal uses finalShippingCost", () => {
    assert(
        buyNowPageCode.includes("finalShippingCost") && buyNowPageCode.includes("shippingCost - shippingDiscount"),
        "Buy Now grandTotal must use finalShippingCost"
    );
});

test("Buy Now displays shipping discount", () => {
    assert(
        buyNowPageCode.includes("Diskon Ongkir"),
        "Buy Now must display shipping discount"
    );
});

// ==========================================
// 6. SHIPPING DISCOUNT — BACKEND SERVICE
// ==========================================
console.log("\n6. Shipping Discount — Backend Service:");

const shippingDiscountCode = readFile("lib/marketing/shipping-discount.ts");
const previewApiCode = readFile("app/api/shipping/discount-preview/route.ts");

test("calculateShippingDiscount prevents negative final cost", () => {
    assert(
        shippingDiscountCode.includes("Math.min(discountAmount, shippingCost)"),
        "Must prevent negative final cost"
    );
});

test("calculateShippingDiscount supports PERCENTAGE type", () => {
    assert(shippingDiscountCode.includes('"PERCENTAGE"'), "Must support PERCENTAGE");
});

test("calculateShippingDiscount supports FIXED type", () => {
    assert(
        shippingDiscountCode.includes("discount.type === \"PERCENTAGE\""),
        "Must handle FIXED via else branch"
    );
});

test("calculateShippingDiscount checks maxDiscount cap", () => {
    assert(shippingDiscountCode.includes("maxDiscount"), "Must check maxDiscount");
});

test("calculateShippingDiscount checks minPurchase threshold", () => {
    assert(shippingDiscountCode.includes("minPurchase"), "Must check minPurchase");
});

test("calculateShippingDiscount validates active period", () => {
    assert(
        shippingDiscountCode.includes("startAt") && shippingDiscountCode.includes("endAt"),
        "Must validate active period"
    );
});

test("calculateShippingDiscount rounds discount amount", () => {
    assert(
        shippingDiscountCode.includes("Math.round(discountAmount)"),
        "Must round discount amount"
    );
});

test("Shipping discount preview API exists", () => {
    assert(previewApiCode.includes("POST"), "Preview API must exist");
});

test("Shipping discount preview validates inputs", () => {
    assert(
        previewApiCode.includes("shippingCost") && previewApiCode.includes("subtotal"),
        "Preview API must validate inputs"
    );
});

test("Shipping discount preview returns hasDiscount flag", () => {
    assert(
        previewApiCode.includes("hasDiscount"),
        "Preview API must return hasDiscount flag"
    );
});

// ==========================================
// 7. CONSISTENCY — CHECKOUT = BUY NOW
// ==========================================
console.log("\n7. Consistency — Checkout = Buy Now:");

test("Both use same shipping discount preview endpoint", () => {
    assert(
        checkoutPageCode.includes("shipping/discount-preview") &&
        buyNowPageCode.includes("shipping/discount-preview"),
        "Both must use same preview endpoint"
    );
});

test("Both use finalShippingCost for grand total", () => {
    assert(
        checkoutPageCode.includes("finalShippingCost") &&
        buyNowPageCode.includes("finalShippingCost"),
        "Both must use finalShippingCost"
    );
});

test("Both display Diskon Ongkir", () => {
    assert(
        checkoutPageCode.includes("Diskon Ongkir") &&
        buyNowPageCode.includes("Diskon Ongkir"),
        "Both must display Diskon Ongkir"
    );
});

test("Both use same Checkout lib (createCheckoutOrder)", () => {
    const buyNowApiCode = readFile("app/api/buy-now/route.ts");
    assert(
        buyNowApiCode.includes("createCheckoutOrder"),
        "Buy Now must use same createCheckoutOrder"
    );
});

// ==========================================
// 8. SECURITY
// ==========================================
console.log("\n8. Security:");

test("Profile API uses session userId", () => {
    assert(
        profileApiCode.includes("session.user.id"),
        "Profile API must use session userId"
    );
});

test("Profile API does not accept client userId", () => {
    assert(
        !profileApiCode.includes("body.userId") && !profileApiCode.includes("req.userId"),
        "Profile API must not accept client-sent userId"
    );
});

test("Profile page requires auth", () => {
    assert(
        profilePageCode.includes("auth()") && profilePageCode.includes("redirect"),
        "Profile page must require auth"
    );
});

// ==========================================
// RESULTS
// ==========================================
console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
    process.exit(1);
}
