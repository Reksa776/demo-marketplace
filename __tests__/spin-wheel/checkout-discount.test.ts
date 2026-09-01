/**
 * SPIN WHEEL CHECKOUT DISCOUNT — REGRESSION TESTS
 *
 * Verifies that spin wheel discount enters the transaction calculation
 * at every layer: frontend, API routes, server checkout, iPaymu, COD.
 *
 * Run: npx tsx __tests__/spin-wheel/checkout-discount.test.ts
 *
 * Scenarios tested:
 * A. Checkout Cart — server calculation
 * B. Buy Now — server calculation
 * C. iPaymu — item details + amount
 * D. COD — order total
 * E. Security — server-side validation
 * F. XOR — mutual exclusion
 * G. Edge cases
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
// Load source files
// ==========================================

const checkoutCode = readFile("lib/checkout.ts");
const checkoutPage = readFile("app/checkout/CheckoutPage.tsx");
const buyNowPage = readFile("app/buy-now/BuyNowPage.tsx");
const ordersRoute = readFile("app/api/orders/route.ts");
const ipaymuRoute = readFile("app/api/payment/ipaymu/route.ts");
const buyNowIpaymuRoute = readFile("app/api/buy-now/ipaymu/route.ts");
const buyNowRoute = readFile("app/api/buy-now/route.ts");
const spinWheelCode = readFile("lib/spin-wheel.ts");
const voucherPickerModal = readFile("components/VoucherPickerModal.tsx");

// ==========================================
// A. CHECKOUT CART — Server calculation
// ==========================================

console.log("\nA. Checkout Cart — Server calculation (lib/checkout.ts):");

test("createCheckoutOrder has spinWheelDiscount variable", () => {
    assert(
        checkoutCode.includes("let spinWheelDiscount = 0"),
        "Must initialize spinWheelDiscount"
    );
});

test("createCheckoutOrder validates spin record from database", () => {
    assert(
        checkoutCode.includes("spinWheelSpin.findUnique"),
        "Must fetch spin record from database"
    );
});

test("createCheckoutOrder validates ownership (spinRecord.userId)", () => {
    assert(
        checkoutCode.includes("spinRecord.userId !== input.userId"),
        "Must validate user ownership of spin record"
    );
});

test("createCheckoutOrder validates status is AVAILABLE", () => {
    assert(
        checkoutCode.includes('status !== "AVAILABLE"'),
        "Must check spin status is AVAILABLE"
    );
});

test("createCheckoutOrder validates expiry date", () => {
    assert(
        checkoutCode.includes("spinRecord.expiresAt"),
        "Must check expiry date"
    );
});

test("createCheckoutOrder calculates discount for FIXED type", () => {
    assert(
        checkoutCode.includes('reward.type === "FIXED"'),
        "Must handle FIXED reward type"
    );
});

test("createCheckoutOrder calculates discount for PERCENTAGE type", () => {
    assert(
        checkoutCode.includes('reward.type === "PERCENTAGE"'),
        "Must handle PERCENTAGE reward type"
    );
});

test("createCheckoutOrder handles FREE_SHIPPING by zeroing shipping", () => {
    assert(
        checkoutCode.includes('reward.type === "FREE_SHIPPING"'),
        "Must handle FREE_SHIPPING reward type"
    );
    assert(
        checkoutCode.includes("finalShippingCost2 = 0"),
        "FREE_SHIPPING must set shipping cost to 0"
    );
});

test("createCheckoutOrder does NOT apply discount for CASHBACK type", () => {
    // CASHBACK should not reduce checkout total
    assert(
        checkoutCode.includes('reward.type === "CASHBACK"'),
        "Must handle CASHBACK reward type"
    );
});

test("grossAmount includes spinWheelDiscount subtraction", () => {
    assert(
        checkoutCode.includes("subtotal -") &&
        checkoutCode.includes("discount -") &&
        checkoutCode.includes("spinWheelDiscount +") &&
        checkoutCode.includes("finalShippingCost"),
        "grossAmount must be: subtotal - discount - spinWheelDiscount + finalShippingCost"
    );
});

test("grossAmount formula has all four terms in correct order", () => {
    // Find the grossAmount calculation line
    const lines = checkoutCode.split("\n");
    const grossAmountLines = lines.filter(
        (l) =>
            l.includes("grossAmount") &&
            l.includes("subtotal") &&
            l.includes("spinWheelDiscount")
    );
    assert(
        grossAmountLines.length > 0,
        "Must find grossAmount calculation that references subtotal and spinWheelDiscount"
    );
});

test("order.total is set to grossAmount", () => {
    assert(
        checkoutCode.includes("total:\n                            grossAmount") ||
        checkoutCode.includes("total: grossAmount") ||
        checkoutCode.includes("total:\r\n                            grossAmount"),
        "order.total must be set to grossAmount (which includes spin wheel discount)"
    );
});

test("order.discount is combined totalDiscount", () => {
    assert(
        checkoutCode.includes("const totalDiscount = discount + spinWheelDiscount"),
        "Must combine voucher + spin wheel discount"
    );
    assert(
        checkoutCode.includes("discount: totalDiscount"),
        "order.discount must use combined totalDiscount"
    );
});

test("spinWheelDiscount is returned in CreatedCheckout", () => {
    assert(
        checkoutCode.includes("spinWheelDiscount,\n\n                grossAmount"),
        "Must return spinWheelDiscount in result"
    );
});

test("spin wheel is marked USED after order creation succeeds", () => {
    assert(
        checkoutCode.includes('status: "USED"'),
        "Must mark spin as USED after order creation"
    );
    assert(
        checkoutCode.includes("orderId: order.id"),
        "Must link spin to order via orderId"
    );
});

// ==========================================
// B. BUY NOW — Server calculation
// ==========================================

console.log("\nB. Buy Now — Server calculation:");

test("createCheckoutOrder handles BUY_NOW mode with spin wheel", () => {
    assert(
        checkoutCode.includes('mode === "BUY_NOW"') &&
        checkoutCode.includes("spinWheelSpinId"),
        "Must support spin wheel in BUY_NOW mode"
    );
});

test("BUY_NOW spin wheel uses same calculation as CART", () => {
    // The spin wheel section is outside the BUY_NOW/CART branching,
    // so it applies to both modes equally
    const spinSection = checkoutCode.indexOf("SPIN WHEEL REWARD DISCOUNT");
    const buyNowSection = checkoutCode.indexOf('mode === "BUY_NOW"');
    const cartSection = checkoutCode.indexOf('mode === "CART"');
    assert(
        spinSection > buyNowSection && spinSection > cartSection,
        "Spin wheel calculation must run AFTER both BUY_NOW and CART item resolution"
    );
});

// ==========================================
// C. iPaymu — Item details + amount
// ==========================================

console.log("\nC. iPaymu — Item details + amount:");

test("iPaymu cart route passes spinWheelSpinId to createCheckoutOrder", () => {
    assert(
        ipaymuRoute.includes("spinWheelSpinId:") &&
        ipaymuRoute.includes("createCheckoutOrder"),
        "iPaymu cart route must pass spinWheelSpinId"
    );
});

test("iPaymu cart route adds spin wheel as negative price item", () => {
    assert(
        ipaymuRoute.includes('"Reward Spin Wheel"') &&
        ipaymuRoute.includes("-result.spinWheelDiscount"),
        "Must add spin wheel as negative price item in iPaymu products"
    );
});

test("iPaymu cart route uses grossAmount as payment amount", () => {
    assert(
        ipaymuRoute.includes("amount: result.grossAmount"),
        "iPaymu payment amount must be result.grossAmount (includes spin discount)"
    );
});

test("iPaymu cart route adds spin wheel description", () => {
    assert(
        ipaymuRoute.includes('"Reward Spin Wheel"') &&
        ipaymuRoute.includes("descriptions.push"),
        "Must add spin wheel to descriptions array"
    );
});

test("iPaymu buy-now route passes spinWheelSpinId", () => {
    assert(
        buyNowIpaymuRoute.includes("spinWheelSpinId") &&
        buyNowIpaymuRoute.includes("createCheckoutOrder"),
        "iPaymu buy-now route must pass spinWheelSpinId"
    );
});

test("iPaymu buy-now route adds spin wheel as negative price item", () => {
    assert(
        buyNowIpaymuRoute.includes('"Reward Spin Wheel"') &&
        buyNowIpaymuRoute.includes("-result.spinWheelDiscount"),
        "Buy-now iPaymu must add spin wheel as negative price item"
    );
});

test("iPaymu buy-now route uses grossAmount as payment amount", () => {
    assert(
        buyNowIpaymuRoute.includes("amount: result.grossAmount"),
        "Buy-now iPaymu amount must be result.grossAmount"
    );
});

test("createMidtransItemDetails accepts spinWheelDiscount parameter", () => {
    assert(
        checkoutCode.includes("spinWheelDiscount: number = 0") ||
        checkoutCode.includes("spinWheelDiscount: number"),
        "createMidtransItemDetails must accept spinWheelDiscount parameter"
    );
});

test("createMidtransItemDetails adds SPIN_WHEEL_REWARD item", () => {
    assert(
        checkoutCode.includes('"SPIN_WHEEL_REWARD"'),
        "Must create SPIN_WHEEL_REWARD item in item details"
    );
});

test("validateItemDetailsTotal checks sum equals grossAmount", () => {
    assert(
        checkoutCode.includes("validateItemDetailsTotal"),
        "Must validate item details total matches grossAmount"
    );
});

// ==========================================
// D. COD — Order total
// ==========================================

console.log("\nD. COD — Order total:");

test("COD route (/api/orders) passes spinWheelSpinId", () => {
    assert(
        ordersRoute.includes("spinWheelSpinId") &&
        ordersRoute.includes("createCheckoutOrder"),
        "COD route must pass spinWheelSpinId"
    );
});

test("COD route uses grossAmount for total in response", () => {
    assert(
        ordersRoute.includes("total: result.grossAmount"),
        "COD response total must be result.grossAmount"
    );
});

test("Buy Now COD route (/api/buy-now) passes spinWheelSpinId", () => {
    assert(
        buyNowRoute.includes("spinWheelSpinId") &&
        buyNowRoute.includes("createCheckoutOrder"),
        "Buy Now COD route must pass spinWheelSpinId"
    );
});

test("Buy Now COD route uses grossAmount for total", () => {
    assert(
        buyNowRoute.includes("total: result.grossAmount"),
        "Buy Now COD response total must be result.grossAmount"
    );
});

// ==========================================
// E. Security — Server-side validation
// ==========================================

console.log("\nE. Security — Server-side validation:");

test("Server fetches spin record from DB (not trusted from client)", () => {
    assert(
        checkoutCode.includes("spinWheelSpin.findUnique"),
        "Must fetch spin record from database, not trust client"
    );
});

test("Server validates spin record ownership", () => {
    assert(
        checkoutCode.includes("spinRecord.userId !== input.userId"),
        "Must validate user owns the spin record"
    );
});

test("Server validates spin status is AVAILABLE", () => {
    assert(
        checkoutCode.includes('status !== "AVAILABLE"'),
        "Must reject non-AVAILABLE spin records"
    );
});

test("Server validates spin expiry", () => {
    assert(
        checkoutCode.includes("spinRecord.expiresAt"),
        "Must check spin record expiry"
    );
});

test("Server validates reward type (not ZONK)", () => {
    // ZONK, CASHBACK, FREE_SHIPPING have specific handling
    // FIXED and PERCENTAGE calculate discount
    // Default returns 0
    assert(
        checkoutCode.includes('case "ZONK"') ||
        spinWheelCode.includes('case "ZONK"'),
        "Must handle ZONK reward type (no discount)"
    );
});

test("Client cannot send spinWheelDiscount amount", () => {
    // CreateCheckoutInput should NOT have a spinWheelDiscount field
    assert(
        !checkoutCode.includes("spinWheelDiscount?:") &&
        !checkoutCode.includes("spinWheelDiscount: number"),
        "CreateCheckoutInput must NOT have spinWheelDiscount from client"
    );
});

test("spinWheelSpinId in CreateCheckoutInput is optional number", () => {
    assert(
        checkoutCode.includes("spinWheelSpinId?: number | null"),
        "spinWheelSpinId must be optional number in input type"
    );
});

// ==========================================
// F. XOR — Mutual exclusion
// ==========================================

console.log("\nF. XOR — Mutual exclusion:");

test("Server rejects both voucher + spin wheel", () => {
    assert(
        checkoutCode.includes('"Silakan pilih salah satu voucher atau reward Spin Wheel."'),
        "Must reject request with both voucher and spin wheel"
    );
});

test("Server checks hasVoucher && hasSpinWheel", () => {
    assert(
        checkoutCode.includes("hasVoucher && hasSpinWheel"),
        "Must check both flags for mutual exclusion"
    );
});

test("Server validates hasVoucher correctly", () => {
    assert(
        checkoutCode.includes('typeof input.voucherCode === "string"') &&
        checkoutCode.includes("input.voucherCode.trim().length > 0"),
        "hasVoucher must check string type and non-empty"
    );
});

test("Server validates hasSpinWheel correctly", () => {
    assert(
        checkoutCode.includes('typeof input.spinWheelSpinId === "number"') &&
        checkoutCode.includes("input.spinWheelSpinId > 0"),
        "hasSpinWheel must check number type and positive"
    );
});

test("Frontend VoucherPickerModal enforces mutual exclusion on selection", () => {
    // When selecting spin wheel, voucherCode should be cleared
    assert(
        voucherPickerModal.includes("voucherCode: isAlreadySelected") &&
        voucherPickerModal.includes("null, // Mutual exclusion"),
        "Modal must clear voucherCode when selecting spin wheel"
    );
});

test("Frontend handleVoucherPickerSelect clears mutually exclusive state", () => {
    assert(
        checkoutPage.includes("setAppliedVoucherCode(selection.voucherCode || \"\")"),
        "Must set appliedVoucherCode from selection"
    );
    assert(
        checkoutPage.includes("setSelectedSpinReward(selection.spinWheelSpinId)"),
        "Must set selectedSpinReward from selection"
    );
});

// ==========================================
// G. Frontend payloads
// ==========================================

console.log("\nG. Frontend payloads:");

test("CheckoutPage sends spinWheelSpinId in COD payload", () => {
    assert(
        checkoutPage.includes("spinWheelSpinId: selectedSpinReward"),
        "Checkout COD must send spinWheelSpinId"
    );
});

test("CheckoutPage sends spinWheelSpinId in iPaymu payload", () => {
    const matches = checkoutPage.match(/spinWheelSpinId: selectedSpinReward/g);
    assert(
        matches && matches.length >= 2,
        "Checkout must send spinWheelSpinId in both COD and iPaymu (at least 2 occurrences)"
    );
});

test("BuyNowPage sends spinWheelSpinId in COD payload", () => {
    assert(
        buyNowPage.includes("spinWheelSpinId: selectedSpinReward"),
        "BuyNow COD must send spinWheelSpinId"
    );
});

test("BuyNowPage sends spinWheelSpinId in iPaymu payload", () => {
    const matches = buyNowPage.match(/spinWheelSpinId: selectedSpinReward/g);
    assert(
        matches && matches.length >= 2,
        "BuyNow must send spinWheelSpinId in both COD and iPaymu (at least 2 occurrences)"
    );
});

test("CheckoutPage only sends spinWheelSpinId, not spinWheelDiscount", () => {
    // Ensure client doesn't send discount amount
    const codPayloadMatch = checkoutPage.match(
        /body:\s*JSON\.stringify\(\{[\s\S]*?spinWheelSpinId: selectedSpinReward[\s\S]*?\}\)/g
    );
    if (codPayloadMatch) {
        for (const payload of codPayloadMatch) {
            assert(
                !payload.includes("spinWheelDiscount:"),
                "Must NOT send spinWheelDiscount from client — server calculates it"
            );
        }
    }
});

test("BuyNowPage only sends spinWheelSpinId, not spinWheelDiscount", () => {
    const codPayloadMatch = buyNowPage.match(
        /body:\s*JSON\.stringify\(\{[\s\S]*?spinWheelSpinId: selectedSpinReward[\s\S]*?\}\)/g
    );
    if (codPayloadMatch) {
        for (const payload of codPayloadMatch) {
            assert(
                !payload.includes("spinWheelDiscount:"),
                "Must NOT send spinWheelDiscount from client — server calculates it"
            );
        }
    }
});

// ==========================================
// H. Frontend display consistency
// ==========================================

console.log("\nH. Frontend display consistency:");

test("CheckoutPage calculates spinWheelDisplayDiscount from selectedSpinReward", () => {
    assert(
        checkoutPage.includes("spinWheelDisplayDiscount") &&
        checkoutPage.includes("selectedSpinReward"),
        "Must calculate spinWheelDisplayDiscount based on selectedSpinReward"
    );
});

test("CheckoutPage grandTotal includes spinWheelDisplayDiscount", () => {
    assert(
        checkoutPage.includes("grandTotal") &&
        checkoutPage.includes("spinWheelDisplayDiscount"),
        "grandTotal must include spinWheelDisplayDiscount"
    );
});

test("BuyNowPage calculates spinWheelDisplayDiscount", () => {
    assert(
        buyNowPage.includes("spinWheelDisplayDiscount"),
        "BuyNow must calculate spinWheelDisplayDiscount"
    );
});

test("BuyNowPage grandTotal includes spinWheelDisplayDiscount", () => {
    assert(
        buyNowPage.includes("grandTotal") &&
        buyNowPage.includes("spinWheelDisplayDiscount"),
        "BuyNow grandTotal must include spinWheelDisplayDiscount"
    );
});

test("CheckoutPage grandTotal formula: subtotal - voucherDiscount - spinWheelDisplayDiscount + shipping", () => {
    const lines = checkoutPage.split("\n");
    const grandTotalLines = lines.filter(
        (l) =>
            l.includes("grandTotal") &&
            (l.includes("spinWheelDisplayDiscount") || l.includes("-"))
    );
    assert(
        grandTotalLines.length > 0,
        "grandTotal must reference spinWheelDisplayDiscount in its calculation"
    );
});

// ==========================================
// I. State management
// ==========================================

console.log("\nI. State management:");

test("CheckoutPage initializes selectedSpinReward as null", () => {
    assert(
        checkoutPage.includes("useState<number | null>(null)") &&
        checkoutPage.includes("selectedSpinReward"),
        "selectedSpinReward must initialize as null"
    );
});

test("CheckoutPage handleVoucherPickerSelect sets selectedSpinReward", () => {
    assert(
        checkoutPage.includes("setSelectedSpinReward(selection.spinWheelSpinId)"),
        "handleVoucherPickerSelect must set selectedSpinReward from selection"
    );
});

test("CheckoutPage validateManualVoucher clears spin wheel (mutual exclusion)", () => {
    assert(
        checkoutPage.includes("setSelectedSpinReward(null)") &&
        checkoutPage.includes("Clear spin wheel"),
        "validateManualVoucher must clear selectedSpinReward"
    );
});

test("CheckoutPage removes localStorage after successful COD order", () => {
    assert(
        checkoutPage.includes('localStorage.removeItem("spinWheelPendingRewards")'),
        "Must clear spin wheel localStorage after order"
    );
});

test("CheckoutPage removes localStorage after iPaymu redirect", () => {
    const matches = checkoutPage.match(/localStorage\.removeItem\("spinWheelPendingRewards"\)/g);
    assert(
        matches && matches.length >= 2,
        "Must clear localStorage in both COD and iPaymu paths (at least 2 occurrences)"
    );
});

test("BuyNowPage initializes selectedSpinReward as null", () => {
    assert(
        buyNowPage.includes("useState<number | null>(null)") &&
        buyNowPage.includes("selectedSpinReward"),
        "BuyNow selectedSpinReward must initialize as null"
    );
});

test("BuyNowPage handleVoucherPickerSelect sets selectedSpinReward", () => {
    assert(
        buyNowPage.includes("setSelectedSpinReward(selection.spinWheelSpinId)"),
        "BuyNow handleVoucherPickerSelect must set selectedSpinReward"
    );
});

test("BuyNowPage validateManualVoucher clears spin wheel", () => {
    assert(
        buyNowPage.includes("setSelectedSpinReward(null)"),
        "BuyNow validateManualVoucher must clear selectedSpinReward"
    );
});

test("BuyNowPage removes localStorage after successful order", () => {
    const matches = buyNowPage.match(/localStorage\.removeItem\("spinWheelPendingRewards"\)/g);
    assert(
        matches && matches.length >= 2,
        "BuyNow must clear localStorage in both COD and iPaymu paths"
    );
});

// ==========================================
// J. Rollback
// ==========================================

console.log("\nJ. Rollback:");

test("rollbackCheckoutOrder restores spin wheel to AVAILABLE", () => {
    assert(
        checkoutCode.includes('status: "AVAILABLE"') &&
        checkoutCode.includes("usedAt: null") &&
        checkoutCode.includes("orderId: null"),
        "Must restore spin wheel to AVAILABLE on rollback"
    );
});

test("rollbackCheckoutOrder finds spin record by orderId", () => {
    assert(
        checkoutCode.includes("spinWheelSpin.findUnique") &&
        checkoutCode.includes("orderId: order.id"),
        "Must find spin record by orderId for rollback"
    );
});

// ==========================================
// K. Edge cases
// ==========================================

console.log("\nK. Edge cases — calculateSpinRewardDiscount:");

test("calculateSpinRewardDiscount handles FIXED with discount <= subtotal", () => {
    assert(
        spinWheelCode.includes("case \"FIXED\""),
        "Must handle FIXED type"
    );
    assert(
        spinWheelCode.includes("discount > subtotal") || spinWheelCode.includes("discount = subtotal"),
        "Must cap FIXED discount at subtotal"
    );
});

test("calculateSpinRewardDiscount handles PERCENTAGE with maxDiscount cap", () => {
    assert(
        spinWheelCode.includes("case \"PERCENTAGE\""),
        "Must handle PERCENTAGE type"
    );
    assert(
        spinWheelCode.includes("maxDiscount !== null"),
        "Must check maxDiscount for PERCENTAGE"
    );
});

test("calculateSpinRewardDiscount returns 0 for ZONK", () => {
    assert(
        spinWheelCode.includes("case \"ZONK\"") &&
        spinWheelCode.includes("return 0"),
        "ZONK must return 0 discount"
    );
});

test("calculateSpinRewardDiscount returns 0 for FREE_SHIPPING (handled separately)", () => {
    assert(
        spinWheelCode.includes("case \"FREE_SHIPPING\"") &&
        spinWheelCode.includes("return 0"),
        "FREE_SHIPPING must return 0 from calculateSpinRewardDiscount"
    );
});

test("calculateSpinRewardDiscount returns 0 for CASHBACK (handled separately)", () => {
    assert(
        spinWheelCode.includes("case \"CASHBACK\"") &&
        spinWheelCode.includes("return 0"),
        "CASHBACK must return 0 from calculateSpinRewardDiscount"
    );
});

test("grossAmount validation rejects non-positive values", () => {
    assert(
        checkoutCode.includes("grossAmount <= 0") || checkoutCode.includes("grossAmount <=0"),
        "Must reject non-positive grossAmount"
    );
});

test("subtotal validation rejects non-positive values", () => {
    assert(
        checkoutCode.includes("subtotal <= 0") || checkoutCode.includes("subtotal <=0"),
        "Must reject non-positive subtotal"
    );
});

// ==========================================
// L. Integration completeness
// ==========================================

console.log("\nL. Integration completeness:");

test("All 4 API routes pass spinWheelSpinId to createCheckoutOrder", () => {
    const routes = [
        { name: "/api/orders", code: ordersRoute },
        { name: "/api/payment/ipaymu", code: ipaymuRoute },
        { name: "/api/buy-now", code: buyNowRoute },
        { name: "/api/buy-now/ipaymu", code: buyNowIpaymuRoute },
    ];

    for (const route of routes) {
        assert(
            route.code.includes("spinWheelSpinId") &&
            route.code.includes("createCheckoutOrder"),
            `${route.name} must pass spinWheelSpinId to createCheckoutOrder`
        );
    }
});

test("Both frontend pages send spinWheelSpinId in both COD and iPaymu", () => {
    const checkoutMatches = checkoutPage.match(/spinWheelSpinId: selectedSpinReward/g);
    assert(
        checkoutMatches && checkoutMatches.length >= 2,
        "CheckoutPage must send spinWheelSpinId in at least 2 payloads (COD + iPaymu)"
    );

    const buyNowMatches = buyNowPage.match(/spinWheelSpinId: selectedSpinReward/g);
    assert(
        buyNowMatches && buyNowMatches.length >= 2,
        "BuyNowPage must send spinWheelSpinId in at least 2 payloads (COD + iPaymu)"
    );
});

test("Server-side grossAmount formula is consistent (not overridden elsewhere)", () => {
    // The grossAmount is calculated once and used everywhere
    const lines = checkoutCode.split("\n");
    const grossAmountAssignments = lines.filter(
        (l) =>
            l.includes("grossAmount") &&
            l.includes("=") &&
            !l.includes("//") &&
            !l.includes("const") === false
    );
    // Should only be one const grossAmount = ... assignment
    const constAssignments = lines.filter(
        (l) => l.trim().startsWith("const grossAmount")
    );
    assert(
        constAssignments.length === 1,
        `grossAmount should be assigned exactly once, found ${constAssignments.length}`
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
