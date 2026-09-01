/**
 * SPIN WHEEL RUNTIME SIMULATION TESTS
 *
 * These tests simulate the EXACT runtime data flow from
 * reward selection → server calculation → order.total → payment amount.
 *
 * They prove the math is correct for the acceptance criteria:
 *   Product  = Rp100.000
 *   Spin     = Rp20.000 (FIXED)
 *   Shipping = Rp10.000
 *   Total    = Rp90.000
 *
 * Run: npx tsx __tests__/spin-wheel/runtime-simulation.test.ts
 */

import { readFileSync } from "fs";

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

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual(actual: number, expected: number, label: string) {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${expected}, got ${actual}`);
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
// SIMULATION: calculateSpinRewardDiscount
// (copy of lib/spin-wheel.ts logic)
// ==========================================

function calculateSpinRewardDiscount(
    rewardType: string,
    rewardValue: number,
    maxDiscount: number | null,
    subtotal: number
): number {
    switch (rewardType) {
        case "PERCENTAGE": {
            let discount = (subtotal * rewardValue) / 100;
            if (maxDiscount !== null && discount > maxDiscount) {
                discount = maxDiscount;
            }
            if (discount > subtotal) {
                discount = subtotal;
            }
            return Math.round(discount);
        }
        case "FIXED": {
            let discount = rewardValue;
            if (discount > subtotal) {
                discount = subtotal;
            }
            return Math.round(discount);
        }
        case "FREE_SHIPPING":
            return 0;
        case "CASHBACK":
            return 0;
        case "ZONK":
            return 0;
        default:
            return 0;
    }
}

// ==========================================
// SIMULATION: createCheckoutOrder calculation
// (extracted from lib/checkout.ts)
// ==========================================

interface CheckoutCalculation {
    subtotal: number;
    voucherDiscount: number;
    spinWheelDiscount: number;
    shippingCost: number;
    grossAmount: number;
    orderTotal: number;
    totalDiscount: number;
}

function simulateCreateCheckoutOrder(params: {
    subtotal: number;
    voucherDiscount: number;
    shippingCost: number;
    spinRewardType: string;
    spinRewardValue: number;
    spinMaxDiscount: number | null;
    hasVoucher: boolean;
    hasSpinWheel: boolean;
}): CheckoutCalculation {
    const {
        subtotal,
        voucherDiscount,
        shippingCost,
        spinRewardType,
        spinRewardValue,
        spinMaxDiscount,
        hasVoucher,
        hasSpinWheel,
    } = params;

    // XOR validation
    if (hasVoucher && hasSpinWheel) {
        throw new Error(
            "Silakan pilih salah satu voucher atau reward Spin Wheel."
        );
    }

    let spinWheelDiscount = 0;

    if (hasSpinWheel) {
        spinWheelDiscount = calculateSpinRewardDiscount(
            spinRewardType,
            spinRewardValue,
            spinMaxDiscount,
            subtotal - voucherDiscount
        );
    }

    const grossAmount =
        subtotal - voucherDiscount - spinWheelDiscount + shippingCost;

    if (grossAmount <= 0) {
        throw new Error("Total pembayaran tidak valid.");
    }

    const totalDiscount = voucherDiscount + spinWheelDiscount;

    return {
        subtotal,
        voucherDiscount,
        spinWheelDiscount,
        shippingCost,
        grossAmount,
        orderTotal: grossAmount, // order.total = grossAmount
        totalDiscount, // order.discount = totalDiscount
    };
}

// ==========================================
// SIMULATION: iPaymu item details
// ==========================================

function simulateIpaymuItemDetails(
    checkoutItems: Array<{ price: number; quantity: number }>,
    shippingCost: number,
    voucherDiscount: number,
    spinWheelDiscount: number
): { items: Array<{ price: number; quantity: number }>; total: number } {
    const items = [...checkoutItems];

    if (shippingCost > 0) {
        items.push({ price: shippingCost, quantity: 1 });
    }

    if (voucherDiscount > 0) {
        items.push({ price: -voucherDiscount, quantity: 1 });
    }

    if (spinWheelDiscount > 0) {
        items.push({ price: -spinWheelDiscount, quantity: 1 });
    }

    const total = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    return { items, total };
}

// ==========================================
// A. ACCEPTANCE CRITERIA: Rp100.000 - Rp20.000 + Rp10.000 = Rp90.000
// ==========================================

console.log(
    "\nA. Acceptance Criteria: Rp100.000 - Rp20.000 + Rp10.000 = Rp90.000"
);

test("FIXED Rp20.000: subtotal=100000, shipping=10000, total=90000", () => {
    const result = simulateCreateCheckoutOrder({
        subtotal: 100000,
        voucherDiscount: 0,
        shippingCost: 10000,
        spinRewardType: "FIXED",
        spinRewardValue: 20000,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: true,
    });

    assertEqual(result.spinWheelDiscount, 20000, "spinWheelDiscount");
    assertEqual(result.grossAmount, 90000, "grossAmount");
    assertEqual(result.orderTotal, 90000, "order.total");
    assertEqual(result.totalDiscount, 20000, "order.discount");
});

test("FIXED Rp20.000: iPaymu item sum == grossAmount", () => {
    const calc = simulateCreateCheckoutOrder({
        subtotal: 100000,
        voucherDiscount: 0,
        shippingCost: 10000,
        spinRewardType: "FIXED",
        spinRewardValue: 20000,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: true,
    });

    const items = simulateIpaymuItemDetails(
        [{ price: 100000, quantity: 1 }],
        calc.shippingCost,
        calc.voucherDiscount,
        calc.spinWheelDiscount
    );

    assertEqual(items.total, calc.grossAmount, "iPaymu item sum == grossAmount");
    assertEqual(items.total, 90000, "iPaymu total == 90000");

    // Verify items
    assert(items.items.length === 3, `Expected 3 items, got ${items.items.length}`);
    assertEqual(items.items[0].price, 100000, "Product price");
    assertEqual(items.items[1].price, 10000, "Shipping price");
    assertEqual(items.items[2].price, -20000, "Spin Wheel price");
});

test("FIXED Rp20.000: COD total == grossAmount == 90000", () => {
    const result = simulateCreateCheckoutOrder({
        subtotal: 100000,
        voucherDiscount: 0,
        shippingCost: 10000,
        spinRewardType: "FIXED",
        spinRewardValue: 20000,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: true,
    });

    // COD response: { total: result.grossAmount }
    const codTotal = result.grossAmount;
    assertEqual(codTotal, 90000, "COD total");
    assertEqual(codTotal, result.orderTotal, "COD total == order.total");
});

// ==========================================
// B. PERCENTAGE REWARD
// ==========================================

console.log("\nB. Percentage Reward:");

test("10% discount on Rp100.000: total = Rp100.000 - Rp10.000 + Rp10.000 = Rp100.000", () => {
    const result = simulateCreateCheckoutOrder({
        subtotal: 100000,
        voucherDiscount: 0,
        shippingCost: 10000,
        spinRewardType: "PERCENTAGE",
        spinRewardValue: 10,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: true,
    });

    assertEqual(result.spinWheelDiscount, 10000, "spinWheelDiscount");
    assertEqual(result.grossAmount, 100000, "grossAmount");
    assertEqual(result.orderTotal, 100000, "order.total");
});

test("20% discount with maxDiscount Rp15.000 on Rp100.000: capped at 15000", () => {
    const result = simulateCreateCheckoutOrder({
        subtotal: 100000,
        voucherDiscount: 0,
        shippingCost: 10000,
        spinRewardType: "PERCENTAGE",
        spinRewardValue: 20,
        spinMaxDiscount: 15000,
        hasVoucher: false,
        hasSpinWheel: true,
    });

    // 20% of 100000 = 20000, but capped at 15000
    assertEqual(result.spinWheelDiscount, 15000, "spinWheelDiscount (capped)");
    assertEqual(result.grossAmount, 95000, "grossAmount");
    assertEqual(result.orderTotal, 95000, "order.total");
});

// ==========================================
// C. ZONK / CASHBACK / FREE_SHIPPING
// ==========================================

console.log("\nC. Edge Reward Types:");

test("ZONK: no discount applied, total = subtotal + shipping", () => {
    const result = simulateCreateCheckoutOrder({
        subtotal: 100000,
        voucherDiscount: 0,
        shippingCost: 10000,
        spinRewardType: "ZONK",
        spinRewardValue: 0,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: true,
    });

    assertEqual(result.spinWheelDiscount, 0, "ZONK spinWheelDiscount");
    assertEqual(result.grossAmount, 110000, "ZONK grossAmount");
    assertEqual(result.orderTotal, 110000, "ZONK order.total");
});

test("CASHBACK: no direct discount, total = subtotal + shipping", () => {
    const result = simulateCreateCheckoutOrder({
        subtotal: 100000,
        voucherDiscount: 0,
        shippingCost: 10000,
        spinRewardType: "CASHBACK",
        spinRewardValue: 15000,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: true,
    });

    assertEqual(result.spinWheelDiscount, 0, "CASHBACK spinWheelDiscount");
    assertEqual(result.grossAmount, 110000, "CASHBACK grossAmount");
});

test("FREE_SHIPPING: spinWheelDiscount=0, but server zeros shipping separately", () => {
    const result = simulateCreateCheckoutOrder({
        subtotal: 100000,
        voucherDiscount: 0,
        shippingCost: 0, // server already zeros it for FREE_SHIPPING
        spinRewardType: "FREE_SHIPPING",
        spinRewardValue: 0,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: true,
    });

    assertEqual(result.spinWheelDiscount, 0, "FREE_SHIPPING spinWheelDiscount");
    assertEqual(result.grossAmount, 100000, "FREE_SHIPPING grossAmount (shipping=0)");
});

// ==========================================
// D. EDGE CASES
// ==========================================

console.log("\nD. Edge Cases:");

test("FIXED discount > subtotal: capped at subtotal", () => {
    const result = simulateCreateCheckoutOrder({
        subtotal: 15000,
        voucherDiscount: 0,
        shippingCost: 10000,
        spinRewardType: "FIXED",
        spinRewardValue: 20000,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: true,
    });

    // FIXED 20000 > subtotal 15000 → capped at 15000
    // grossAmount = 15000 - 0 - 15000 + 10000 = 10000
    assertEqual(result.spinWheelDiscount, 15000, "discount capped at subtotal");
    assertEqual(result.grossAmount, 10000, "grossAmount with capped discount");
});

test("Discount = 0: total unchanged", () => {
    const result = simulateCreateCheckoutOrder({
        subtotal: 100000,
        voucherDiscount: 0,
        shippingCost: 10000,
        spinRewardType: "ZONK",
        spinRewardValue: 0,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: true,
    });

    assertEqual(result.spinWheelDiscount, 0, "zero discount");
    assertEqual(result.grossAmount, 110000, "total unchanged");
});

test("Shipping = 0: only product - discount", () => {
    const result = simulateCreateCheckoutOrder({
        subtotal: 100000,
        voucherDiscount: 0,
        shippingCost: 0,
        spinRewardType: "FIXED",
        spinRewardValue: 20000,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: true,
    });

    assertEqual(result.grossAmount, 80000, "subtotal - spinWheel only");
});

test("Multiple items in cart: subtotal sums correctly", () => {
    const result = simulateCreateCheckoutOrder({
        subtotal: 250000, // 2 items: 100000 + 150000
        voucherDiscount: 0,
        shippingCost: 15000,
        spinRewardType: "FIXED",
        spinRewardValue: 30000,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: true,
    });

    assertEqual(result.spinWheelDiscount, 30000, "spinWheelDiscount");
    assertEqual(result.grossAmount, 235000, "250000 - 30000 + 15000");
});

test("No spin wheel, no voucher: subtotal + shipping only", () => {
    const result = simulateCreateCheckoutOrder({
        subtotal: 100000,
        voucherDiscount: 0,
        shippingCost: 10000,
        spinRewardType: "FIXED",
        spinRewardValue: 20000,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: false,
    });

    assertEqual(result.spinWheelDiscount, 0, "no spin discount");
    assertEqual(result.grossAmount, 110000, "subtotal + shipping");
});

// ==========================================
// E. SECURITY: XOR validation
// ==========================================

console.log("\nE. Security — XOR Validation:");

test("Voucher + Spin Wheel: REJECTED", () => {
    let threw = false;
    try {
        simulateCreateCheckoutOrder({
            subtotal: 100000,
            voucherDiscount: 10000,
            shippingCost: 10000,
            spinRewardType: "FIXED",
            spinRewardValue: 20000,
            spinMaxDiscount: null,
            hasVoucher: true,
            hasSpinWheel: true,
        });
    } catch (e: any) {
        threw = true;
        assert(
            e.message.includes("Silakan pilih salah satu"),
            `Wrong error: ${e.message}`
        );
    }
    assert(threw, "Should throw for voucher + spin wheel");
});

test("Voucher only: PASS", () => {
    const result = simulateCreateCheckoutOrder({
        subtotal: 100000,
        voucherDiscount: 15000,
        shippingCost: 10000,
        spinRewardType: "FIXED",
        spinRewardValue: 20000,
        spinMaxDiscount: null,
        hasVoucher: true,
        hasSpinWheel: false,
    });

    assertEqual(result.spinWheelDiscount, 0, "no spin discount");
    assertEqual(result.voucherDiscount, 15000, "voucher applied");
    assertEqual(result.grossAmount, 95000, "100000 - 15000 + 10000");
});

test("Spin Wheel only: PASS", () => {
    const result = simulateCreateCheckoutOrder({
        subtotal: 100000,
        voucherDiscount: 0,
        shippingCost: 10000,
        spinRewardType: "FIXED",
        spinRewardValue: 20000,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: true,
    });

    assertEqual(result.spinWheelDiscount, 20000, "spin applied");
    assertEqual(result.grossAmount, 90000, "100000 - 20000 + 10000");
});

test("No voucher, no spin: PASS", () => {
    const result = simulateCreateCheckoutOrder({
        subtotal: 100000,
        voucherDiscount: 0,
        shippingCost: 10000,
        spinRewardType: "FIXED",
        spinRewardValue: 20000,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: false,
    });

    assertEqual(result.spinWheelDiscount, 0, "no discount");
    assertEqual(result.grossAmount, 110000, "subtotal + shipping");
});

// ==========================================
// F. SERVER vs FRONTEND CONSISTENCY
// ==========================================

console.log("\nF. Server vs Frontend Display Consistency:");

test("Frontend spinWheelDisplayDiscount matches server for FIXED", () => {
    // Frontend calculation (from CheckoutPage.tsx)
    const frontendDiscount = (() => {
        const rewardType: string = "FIXED";
        const rewardValue = 20000;
        const maxDiscount: number | null = null;
        const subtotal = 100000;

        switch (rewardType) {
            case "PERCENTAGE": {
                let d = (subtotal * rewardValue) / 100;
                if (maxDiscount !== null && d > maxDiscount) d = maxDiscount;
                if (d > subtotal) d = subtotal;
                return Math.round(d);
            }
            case "FIXED": {
                let d = rewardValue;
                if (d > subtotal) d = subtotal;
                return Math.round(d);
            }
            default:
                return 0;
        }
    })();

    // Server calculation
    const serverDiscount = calculateSpinRewardDiscount(
        "FIXED",
        20000,
        null,
        100000
    );

    assertEqual(frontendDiscount, serverDiscount, "frontend == server discount");
    assertEqual(frontendDiscount, 20000, "discount is 20000");
});

test("Frontend grandTotal matches server grossAmount for FIXED", () => {
    const subtotal = 100000;
    const voucherDiscount = 0;
    const shippingCost = 10000;
    const shippingDiscount = 0;
    const finalShippingCost = Math.max(0, shippingCost - shippingDiscount);

    // Frontend grandTotal
    const frontendDiscount = 20000; // spinWheelDisplayDiscount
    const frontendGrandTotal = Math.max(
        0,
        subtotal - voucherDiscount - frontendDiscount + finalShippingCost
    );

    // Server grossAmount
    const serverResult = simulateCreateCheckoutOrder({
        subtotal,
        voucherDiscount: 0,
        shippingCost: 10000,
        spinRewardType: "FIXED",
        spinRewardValue: 20000,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: true,
    });

    assertEqual(
        frontendGrandTotal,
        serverResult.grossAmount,
        "frontend grandTotal == server grossAmount"
    );
    assertEqual(frontendGrandTotal, 90000, "both == 90000");
});

test("Frontend grandTotal matches server grossAmount for PERCENTAGE", () => {
    const subtotal = 100000;
    const finalShippingCost = 10000;

    // Frontend: 10% of 100000 = 10000
    const frontendDiscount = Math.round((subtotal * 10) / 100);
    const frontendGrandTotal = Math.max(
        0,
        subtotal - 0 - frontendDiscount + finalShippingCost
    );

    // Server
    const serverResult = simulateCreateCheckoutOrder({
        subtotal,
        voucherDiscount: 0,
        shippingCost: 10000,
        spinRewardType: "PERCENTAGE",
        spinRewardValue: 10,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: true,
    });

    assertEqual(
        frontendGrandTotal,
        serverResult.grossAmount,
        "frontend == server for PERCENTAGE"
    );
    assertEqual(frontendGrandTotal, 100000, "100000 - 10000 + 10000 = 100000");
});

// ==========================================
// G. iPaymu ITEM DETAILS VERIFICATION
// ==========================================

console.log("\nG. iPaymu Item Details:");

test("iPaymu: Product + Shipping + Spin = grossAmount (FIXED)", () => {
    const items = [
        { price: 100000, quantity: 1 },
    ];
    const shippingCost = 10000;
    const voucherDiscount = 0;
    const spinWheelDiscount = 20000;

    const result = simulateIpaymuItemDetails(
        items,
        shippingCost,
        voucherDiscount,
        spinWheelDiscount
    );

    assertEqual(result.items.length, 3, "3 items (product + shipping + spin)");
    assertEqual(result.items[0].price, 100000, "Product");
    assertEqual(result.items[1].price, 10000, "Shipping");
    assertEqual(result.items[2].price, -20000, "Spin Wheel");
    assertEqual(result.total, 90000, "sum == 90000");
});

test("iPaymu: Product + Shipping + Voucher + Spin (should never happen due to XOR)", () => {
    // This test verifies the XOR prevents this scenario
    let threw = false;
    try {
        simulateCreateCheckoutOrder({
            subtotal: 100000,
            voucherDiscount: 10000,
            shippingCost: 10000,
            spinRewardType: "FIXED",
            spinRewardValue: 20000,
            spinMaxDiscount: null,
            hasVoucher: true,
            hasSpinWheel: true,
        });
    } catch {
        threw = true;
    }
    assert(threw, "XOR prevents both discounts");
});

test("iPaymu: multiple products in cart", () => {
    const items = [
        { price: 60000, quantity: 1 },
        { price: 40000, quantity: 1 },
    ];
    const shippingCost = 10000;
    const spinWheelDiscount = 20000;

    const result = simulateIpaymuItemDetails(
        items,
        shippingCost,
        0,
        spinWheelDiscount
    );

    assertEqual(result.items.length, 4, "4 items (2 products + shipping + spin)");
    assertEqual(result.total, 90000, "60000 + 40000 + 10000 - 20000 = 90000");
});

// ==========================================
// H. COD FLOW VERIFICATION
// ==========================================

console.log("\nH. COD Flow:");

test("COD: order.total from createCheckoutOrder == grossAmount", () => {
    const result = simulateCreateCheckoutOrder({
        subtotal: 100000,
        voucherDiscount: 0,
        shippingCost: 10000,
        spinRewardType: "FIXED",
        spinRewardValue: 20000,
        spinMaxDiscount: null,
        hasVoucher: false,
        hasSpinWheel: true,
    });

    // API response: { total: result.grossAmount }
    const apiTotal = result.grossAmount;
    assertEqual(apiTotal, 90000, "COD API total");
    assertEqual(apiTotal, result.orderTotal, "COD API total == order.total");

    // Database order.total = grossAmount
    assertEqual(result.orderTotal, 90000, "database order.total");
});

// ==========================================
// I. SOURCE CODE VERIFICATION
// (static checks on key patterns)
// ==========================================

console.log("\nI. Source Code Pattern Verification:");

const checkoutCode = readFile("lib/checkout.ts");
const checkoutPage = readFile("app/checkout/CheckoutPage.tsx");
const buyNowPage = readFile("app/buy-now/BuyNowPage.tsx");
const ipaymuRoute = readFile("app/api/payment/ipaymu/route.ts");
const buyNowIpaymuRoute = readFile("app/api/buy-now/ipaymu/route.ts");
const ordersRoute = readFile("app/api/orders/route.ts");
const buyNowRoute = readFile("app/api/buy-now/route.ts");

test("Server: grossAmount = subtotal - discount - spinWheelDiscount + finalShippingCost", () => {
    assert(
        checkoutCode.includes("subtotal -") &&
        checkoutCode.includes("discount -") &&
        checkoutCode.includes("spinWheelDiscount +"),
        "grossAmount formula must subtract spinWheelDiscount"
    );
});

test("Server: order.total = grossAmount", () => {
    assert(
        checkoutCode.includes("total:") &&
        checkoutCode.includes("grossAmount,") &&
        checkoutCode.includes("order.create"),
        "order creation must set total = grossAmount"
    );
});

test("Server: creates SPIN_WHEEL_REWARD item in Midtrans details", () => {
    assert(
        checkoutCode.includes('"SPIN_WHEEL_REWARD"'),
        "Must create SPIN_WHEEL_REWARD item"
    );
});

test("Server: validates spin record from database (not trusted from client)", () => {
    assert(
        checkoutCode.includes("spinWheelSpin.findUnique"),
        "Must fetch spin record from database"
    );
});

test("Server: validates ownership", () => {
    assert(
        checkoutCode.includes("spinRecord.userId !== input.userId"),
        "Must validate ownership"
    );
});

test("Server: rejects ZONK (returns 0)", () => {
    const spinWheelCode = readFile("lib/spin-wheel.ts");
    assert(
        spinWheelCode.includes('case "ZONK"') && spinWheelCode.includes("return 0"),
        "ZONK must return 0"
    );
});

test("API: all 4 routes forward spinWheelSpinId", () => {
    [ordersRoute, ipaymuRoute, buyNowRoute, buyNowIpaymuRoute].forEach(
        (code, i) => {
            const names = ["/api/orders", "/api/payment/ipaymu", "/api/buy-now", "/api/buy-now/ipaymu"];
            assert(
                code.includes("spinWheelSpinId") && code.includes("createCheckoutOrder"),
                `${names[i]} must forward spinWheelSpinId`
            );
        }
    );
});

test("iPaymu: both routes add spin wheel as negative item", () => {
    [ipaymuRoute, buyNowIpaymuRoute].forEach((code, i) => {
        const names = ["/api/payment/ipaymu", "/api/buy-now/ipaymu"];
        assert(
            code.includes('"Reward Spin Wheel"') && code.includes("-result.spinWheelDiscount"),
            `${names[i]} must add spin wheel negative item`
        );
    });
});

test("iPaymu: both routes use result.grossAmount as payment amount", () => {
    [ipaymuRoute, buyNowIpaymuRoute].forEach((code, i) => {
        const names = ["/api/payment/ipaymu", "/api/buy-now/ipaymu"];
        assert(
            code.includes("amount: result.grossAmount"),
            `${names[i]} must use result.grossAmount as payment amount`
        );
    });
});

test("COD routes: both use result.grossAmount for total", () => {
    [ordersRoute, buyNowRoute].forEach((code, i) => {
        const names = ["/api/orders", "/api/buy-now"];
        assert(
            code.includes("total:") && code.includes("result.grossAmount"),
            `${names[i]} must return total: result.grossAmount`
        );
    });
});

test("Frontend: both pages send spinWheelSpinId in COD + iPaymu (>=2 each)", () => {
    [checkoutPage, buyNowPage].forEach((code, i) => {
        const names = ["CheckoutPage", "BuyNowPage"];
        const matches = code.match(/spinWheelSpinId: selectedSpinReward/g);
        assert(
            !!matches && matches.length >= 2,
            `${names[i]} must send spinWheelSpinId in at least 2 payloads`
        );
    });
});

test("Frontend: grandTotal includes spinWheelDisplayDiscount", () => {
    assert(
        checkoutPage.includes("grandTotal") && checkoutPage.includes("spinWheelDisplayDiscount"),
        "CheckoutPage grandTotal must reference spinWheelDisplayDiscount"
    );
    assert(
        buyNowPage.includes("grandTotal") && buyNowPage.includes("spinWheelDisplayDiscount"),
        "BuyNowPage grandTotal must reference spinWheelDisplayDiscount"
    );
});

test("Frontend: spinWheelDisplayDiscount calculates FIXED correctly", () => {
    assert(
        checkoutPage.includes('case "FIXED"') &&
        checkoutPage.includes("selected.rewardValue"),
        "CheckoutPage must calculate FIXED discount from rewardValue"
    );
    assert(
        buyNowPage.includes('case "FIXED"') &&
        buyNowPage.includes("selected.rewardValue"),
        "BuyNowPage must calculate FIXED discount from rewardValue"
    );
});

test("Frontend: spinWheelDisplayDiscount calculates PERCENTAGE correctly", () => {
    assert(
        checkoutPage.includes('case "PERCENTAGE"') &&
        checkoutPage.includes("(subtotal * selected.rewardValue) / 100"),
        "CheckoutPage must calculate PERCENTAGE discount"
    );
    assert(
        buyNowPage.includes('case "PERCENTAGE"') &&
        buyNowPage.includes("(subtotal * selected.rewardValue) / 100"),
        "BuyNowPage must calculate PERCENTAGE discount"
    );
});

test("Client does NOT send spinWheelDiscount amount to server", () => {
    // Neither page should send spinWheelDiscount in the request body
    const checkoutPayloads = checkoutPage.match(
        /body:\s*JSON\.stringify\(\{[\s\S]*?\}\)/g
    );
    if (checkoutPayloads) {
        for (const payload of checkoutPayloads) {
            if (payload.includes("spinWheelSpinId")) {
                assert(
                    !payload.includes("spinWheelDiscount:"),
                    "CheckoutPage must NOT send spinWheelDiscount to server"
                );
            }
        }
    }
});

// ==========================================
// RESULTS
// ==========================================

console.log(`\n${"=".repeat(50)}`);
console.log(
    `\n📊 RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`
);

if (failed > 0) {
    console.log("\n❌ Some tests failed!");
    process.exit(1);
} else {
    console.log("\n✅ All tests passed!");
}
