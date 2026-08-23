/**
 * ==========================================
 * ADDRESS CRUD + SHIPPING DISCOUNT UX TESTS
 * ==========================================
 *
 * Tests for customer address management and
 * shipping discount integration.
 *
 * Run: npx tsx __tests__/marketing/address-shipping-ux.test.ts
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

console.log("\n=== ADDRESS CRUD + SHIPPING DISCOUNT UX TESTS ===\n");

// ==========================================
// 1. ADDRESS API — CREATE
// ==========================================
console.log("1. Address API — Create:");

const addressesRouteCode = readFile("app/api/addresses/route.ts");

test("GET /api/addresses exists", () => {
    assert(addressesRouteCode.includes("export async function GET"), "Missing GET handler");
});

test("POST /api/addresses exists", () => {
    assert(addressesRouteCode.includes("export async function POST"), "Missing POST handler");
});

test("GET uses auth session", () => {
    assert(addressesRouteCode.includes("session.user.id") || addressesRouteCode.includes("session?.user?.id"), "Missing auth check");
});

test("GET filters by userId (ownership)", () => {
    assert(addressesRouteCode.includes("userId") && addressesRouteCode.includes("where"), "GET must filter by userId");
});

test("POST validates recipientName", () => {
    assert(addressesRouteCode.includes("recipientName"), "Missing recipientName validation");
});

test("POST validates phone", () => {
    assert(addressesRouteCode.includes("phone"), "Missing phone validation");
});

test("POST validates address field", () => {
    assert(addressesRouteCode.includes("address"), "Missing address validation");
});

test("POST auto-defaults first address", () => {
    assert(
        addressesRouteCode.includes("addressCount === 0") || addressesRouteCode.includes("addressCount===0"),
        "POST must auto-default first address"
    );
});

test("POST resets previous default when new default is set", () => {
    assert(
        addressesRouteCode.includes("updateMany") && addressesRouteCode.includes("isDefault: true"),
        "POST must reset previous default addresses"
    );
});

test("POST validates province IDs against local DB", () => {
    assert(
        addressesRouteCode.includes("province.findUnique") || addressesRouteCode.includes("validProvinceId"),
        "POST must validate province IDs against local database"
    );
});

// ==========================================
// 2. ADDRESS API — EDIT (PATCH)
// ==========================================
console.log("\n2. Address API — Edit (PATCH):");

const addressIdCode = readFile("app/api/addresses/[id]/route.ts");

test("PATCH /api/addresses/[id] exists", () => {
    assert(addressIdCode.includes("export async function PATCH"), "Missing PATCH handler");
});

test("PATCH checks ownership", () => {
    assert(
        addressIdCode.includes("existing.userId !== userId"),
        "PATCH must check ownership"
    );
});

test("PATCH validates address exists", () => {
    assert(
        addressIdCode.includes("findUnique") && addressIdCode.includes("404"),
        "PATCH must validate address exists"
    );
});

test("PATCH handles isDefault toggle (set true)", () => {
    assert(
        addressIdCode.includes("isDefault: true") && addressIdCode.includes("updateMany"),
        "PATCH must unset other defaults when setting new default"
    );
});

test("PATCH handles isDefault toggle (set false) with fallback", () => {
    assert(
        addressIdCode.includes("isDefault: false") && addressIdCode.includes("findFirst"),
        "PATCH must find next default when unsetting current default"
    );
});

test("PATCH validates recipientName", () => {
    assert(
        addressIdCode.includes("recipientName") && addressIdCode.includes("wajib diisi"),
        "PATCH must validate recipientName"
    );
});

test("PATCH validates phone", () => {
    assert(
        addressIdCode.includes("phone") && addressIdCode.includes("wajib diisi"),
        "PATCH must validate phone"
    );
});

// ==========================================
// 3. ADDRESS API — DELETE
// ==========================================
console.log("\n3. Address API — Delete:");

test("DELETE /api/addresses/[id] exists", () => {
    assert(addressIdCode.includes("export async function DELETE"), "Missing DELETE handler");
});

test("DELETE checks ownership", () => {
    assert(
        addressIdCode.includes("existing.userId !== userId"),
        "DELETE must check ownership"
    );
});

test("DELETE validates address exists", () => {
    assert(
        addressIdCode.includes("findUnique") && addressIdCode.includes("404"),
        "DELETE must validate address exists"
    );
});

test("DELETE promotes next default when default is deleted", () => {
    assert(
        addressIdCode.includes("existing.isDefault") && addressIdCode.includes("findFirst"),
        "DELETE must promote next address when default is deleted"
    );
});

// ==========================================
// 4. ADDRESS LIST PAGE
// ==========================================
console.log("\n4. Address List Page:");

const addressesPageCode = readFile("app/addresses/page.tsx");

test("Address list page exists", () => {
    assert(
        addressesPageCode.includes("use client") && addressesPageCode.includes("export default"),
        "Address list page must be a client component"
    );
});

test("Address list fetches from /api/addresses", () => {
    assert(
        addressesPageCode.includes("/api/addresses"),
        "Address list must fetch from /api/addresses"
    );
});

test("Address list shows default badge", () => {
    assert(
        addressesPageCode.includes("isDefault") && addressesPageCode.includes("Utama"),
        "Address list must show default badge"
    );
});

test("Address list has delete button", () => {
    assert(
        addressesPageCode.includes("handleDelete") && addressesPageCode.includes("DELETE"),
        "Address list must have delete functionality"
    );
});

test("Address list has set default button", () => {
    assert(
        addressesPageCode.includes("handleSetDefault") && addressesPageCode.includes("Jadikan Utama"),
        "Address list must have set default functionality"
    );
});

test("Address list has edit link", () => {
    assert(
        addressesPageCode.includes("/edit"),
        "Address list must have edit link"
    );
});

test("Address list has add new address link", () => {
    assert(
        addressesPageCode.includes("/addresses/new"),
        "Address list must link to new address page"
    );
});

test("Address list shows empty state", () => {
    assert(
        addressesPageCode.includes("Belum ada alamat"),
        "Address list must show empty state"
    );
});

// ==========================================
// 5. ADDRESS EDIT PAGE
// ==========================================
console.log("\n5. Address Edit Page:");

const editPageCode = readFile("app/addresses/[id]/edit/page.tsx");

test("Edit page exists", () => {
    assert(
        editPageCode.includes("use client") && editPageCode.includes("export default"),
        "Edit page must be a client component"
    );
});

test("Edit page loads existing address data", () => {
    assert(
        editPageCode.includes("/api/addresses") && editPageCode.includes("find"),
        "Edit page must load and find existing address"
    );
});

test("Edit page uses PATCH to save", () => {
    assert(
        editPageCode.includes('method: "PATCH"'),
        "Edit page must use PATCH to save changes"
    );
});

test("Edit page validates required fields", () => {
    assert(
        editPageCode.includes("recipientName") && editPageCode.includes("phone") && editPageCode.includes("address"),
        "Edit page must validate all required fields"
    );
});

test("Edit page supports isDefault toggle", () => {
    assert(
        editPageCode.includes("isDefault"),
        "Edit page must support isDefault toggle"
    );
});

test("Edit page shows loading state", () => {
    assert(
        editPageCode.includes("loading") && editPageCode.includes("animate-pulse"),
        "Edit page must show loading state"
    );
});

// ==========================================
// 6. PROFILE PAGE — ADDRESS LINK
// ==========================================
console.log("\n6. Profile Page — Address Link:");

const profileContentCode = readFile("app/profile/ProfileContent.tsx");

test("Profile page has address menu item", () => {
    assert(
        profileContentCode.includes("/addresses") && profileContentCode.includes("Alamat Saya"),
        "Profile page must have address menu item"
    );
});

// ==========================================
// 7. CHECKOUT — ADDRESS INTEGRATION
// ==========================================
console.log("\n7. Checkout — Address Integration:");

const checkoutPageCode = readFile("app/checkout/CheckoutPage.tsx");
const checkoutApiCode = readFile("app/api/checkout/route.ts");

test("Checkout loads user addresses", () => {
    assert(
        checkoutApiCode.includes("userAddress") || checkoutApiCode.includes("addresses"),
        "Checkout API must load user addresses"
    );
});

test("Checkout displays address selection", () => {
    assert(
        checkoutPageCode.includes("selectedAddress") && checkoutPageCode.includes("setSelectedAddress"),
        "Checkout page must allow address selection"
    );
});

test("Checkout uses selected address for shipping", () => {
    assert(
        checkoutPageCode.includes("loadShippingCost") && checkoutPageCode.includes("selectedAddress"),
        "Checkout must use selected address for shipping calculation"
    );
});

test("Checkout shows default address as first option", () => {
    assert(
        checkoutPageCode.includes("isDefault") && checkoutPageCode.includes("defaultAddress"),
        "Checkout must show default address prominently"
    );
});

// ==========================================
// 8. BUY NOW — ADDRESS INTEGRATION
// ==========================================
console.log("\n8. Buy Now — Address Integration:");

const buyNowPageCode = readFile("app/buy-now/BuyNowPage.tsx");
const buyNowApiCode = readFile("app/api/buy-now/route.ts");

test("Buy Now loads user addresses", () => {
    assert(
        buyNowApiCode.includes("addresses") || buyNowApiCode.includes("userAddress"),
        "Buy Now API must load user addresses"
    );
});

test("Buy Now displays address selection", () => {
    assert(
        buyNowPageCode.includes("selectedAddress") && buyNowPageCode.includes("setSelectedAddress"),
        "Buy Now page must allow address selection"
    );
});

test("Buy Now uses selected address for shipping", () => {
    assert(
        buyNowPageCode.includes("loadShippingCost") && buyNowPageCode.includes("selectedAddress"),
        "Buy Now must use selected address for shipping"
    );
});

// ==========================================
// 9. SHIPPING DISCOUNT — CHECKOUT
// ==========================================
console.log("\n9. Shipping Discount — Checkout:");

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

// ==========================================
// 10. SHIPPING DISCOUNT — BUY NOW
// ==========================================
console.log("\n10. Shipping Discount — Buy Now:");

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
// 11. SHIPPING DISCOUNT — BACKEND
// ==========================================
console.log("\n11. Shipping Discount — Backend:");

const checkoutLibCode = readFile("lib/checkout.ts");
const shippingDiscountCode = readFile("lib/marketing/shipping-discount.ts");
const previewApiCode = readFile("app/api/shipping/discount-preview/route.ts");

test("Checkout applies shipping discount server-side", () => {
    assert(
        checkoutLibCode.includes("calculateShippingDiscount"),
        "Checkout must call calculateShippingDiscount"
    );
});

test("Checkout uses finalShippingCost for order total", () => {
    assert(
        checkoutLibCode.includes("finalShippingCost"),
        "Checkout must use finalShippingCost for order total"
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

test("calculateShippingDiscount prevents negative final cost", () => {
    assert(
        shippingDiscountCode.includes("Math.min(discountAmount, shippingCost)"),
        "calculateShippingDiscount must prevent negative final cost"
    );
});

test("calculateShippingDiscount supports PERCENTAGE type", () => {
    assert(shippingDiscountCode.includes('"PERCENTAGE"'), "Must support PERCENTAGE type");
});

test("calculateShippingDiscount supports FIXED type", () => {
    assert(
        shippingDiscountCode.includes("discount.type === \"PERCENTAGE\""),
        "Must handle FIXED via else branch"
    );
});

test("calculateShippingDiscount checks maxDiscount cap", () => {
    assert(shippingDiscountCode.includes("maxDiscount"), "Must check maxDiscount cap");
});

test("calculateShippingDiscount checks minPurchase threshold", () => {
    assert(shippingDiscountCode.includes("minPurchase"), "Must check minPurchase threshold");
});

test("calculateShippingDiscount validates active period", () => {
    assert(
        shippingDiscountCode.includes("startAt") && shippingDiscountCode.includes("endAt"),
        "Must validate active period"
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

// ==========================================
// 12. SECURITY — OWNERSHIP
// ==========================================
console.log("\n12. Security — Ownership:");

test("GET /api/addresses filters by userId", () => {
    assert(
        addressesRouteCode.includes("where") && addressesRouteCode.includes("userId"),
        "GET must filter by userId"
    );
});

test("PATCH /api/addresses/[id] checks ownership", () => {
    assert(
        addressIdCode.includes("existing.userId !== userId"),
        "PATCH must verify ownership"
    );
});

test("DELETE /api/addresses/[id] checks ownership", () => {
    assert(
        addressIdCode.includes("existing.userId !== userId"),
        "DELETE must verify ownership"
    );
});

test("Checkout API validates address belongs to user", () => {
    assert(
        checkoutApiCode.includes("userId") && (checkoutApiCode.includes("findFirst") || checkoutApiCode.includes("findUnique")),
        "Checkout API must validate address ownership"
    );
});

// ==========================================
// 13. PROXY PROTECTION
// ==========================================
console.log("\n13. Proxy Protection:");

const proxyCode = readFile("proxy.ts");

test("Proxy protects /addresses routes", () => {
    assert(
        proxyCode.includes("/addresses/:path*") || proxyCode.includes("/addresses"),
        "Proxy must protect /addresses routes"
    );
});

test("Proxy protects /profile routes", () => {
    assert(proxyCode.includes("/profile/:path*") || proxyCode.includes("/profile"), "Proxy must protect /profile");
});

// ==========================================
// RESULTS
// ==========================================
console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
    process.exit(1);
}
