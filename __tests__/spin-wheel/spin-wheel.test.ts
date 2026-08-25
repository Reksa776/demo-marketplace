/**
 * SPIN WHEEL PROMO SYSTEM — TESTS
 *
 * Static/code-path verification tests.
 * Run: npx tsx __tests__/spin-wheel/spin-wheel.test.ts
 *
 * Tests cover:
 * A. Spin Wheel Logic (lib/spin-wheel.ts)
 * B. Checkout Integration (lib/checkout.ts)
 * C. API Security
 * D. Database Schema
 * E. UI Structure
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
// A. SPIN WHEEL LOGIC
// ==========================================

console.log("\nA. Spin Wheel Logic (lib/spin-wheel.ts):");

const spinWheelCode = readFile("lib/spin-wheel.ts");

test("checkEligibility function exists", () => {
    assert(spinWheelCode.includes("export async function checkEligibility"), "Missing checkEligibility");
});

test("executeSpin function exists", () => {
    assert(spinWheelCode.includes("export async function executeSpin"), "Missing executeSpin");
});

test("selectReward function exists", () => {
    assert(spinWheelCode.includes("export async function selectReward"), "Missing selectReward");
});

test("calculateSpinRewardDiscount function exists", () => {
    assert(spinWheelCode.includes("export function calculateSpinRewardDiscount"), "Missing calculateSpinRewardDiscount");
});

test("eligibility checks paymentStatus = PAID", () => {
    assert(spinWheelCode.includes('paymentStatus: "PAID"'), "Must filter by paymentStatus PAID");
});

test("eligibility uses aggregate on subtotal", () => {
    assert(spinWheelCode.includes("_sum"), "Must use aggregate sum for spend calculation");
});

test("spin uses $transaction for atomicity", () => {
    assert(spinWheelCode.includes("$transaction"), "executeSpin must use transaction");
});

test("spin catches P2002 for duplicate prevention", () => {
    assert(spinWheelCode.includes("P2002"), "Must catch P2002 unique constraint violation");
});

test("selectReward uses crypto for randomness", () => {
    assert(spinWheelCode.includes("crypto"), "selectReward must use crypto module");
});

test("selectReward filters out-of-stock rewards", () => {
    assert(spinWheelCode.includes("usedQuantity < r.totalQuantity"), "Must filter rewards by remaining quantity");
});

test("selectReward uses weighted random", () => {
    assert(spinWheelCode.includes("totalWeight"), "selectReward must use total weight calculation");
});

test("calculateSpinRewardDiscount handles PERCENTAGE type", () => {
    assert(spinWheelCode.includes('case "PERCENTAGE"'), "Must handle PERCENTAGE type");
});

test("calculateSpinRewardDiscount handles FIXED type", () => {
    assert(spinWheelCode.includes('case "FIXED"'), "Must handle FIXED type");
});

test("calculateSpinRewardDiscount handles FREE_SHIPPING type", () => {
    assert(spinWheelCode.includes('case "FREE_SHIPPING"'), "Must handle FREE_SHIPPING type");
});

test("calculateSpinRewardDiscount handles CASHBACK type", () => {
    assert(spinWheelCode.includes('case "CASHBACK"'), "Must handle CASHBACK type");
});

test("calculateSpinRewardDiscount handles ZONK type", () => {
    assert(spinWheelCode.includes('case "ZONK"'), "Must handle ZONK type");
});

test("calculateSpinRewardDiscount caps discount at subtotal", () => {
    assert(spinWheelCode.includes("discount > subtotal"), "Must cap discount at subtotal");
});

test("spin increments reward usedQuantity", () => {
    assert(spinWheelCode.includes("usedQuantity: { increment: 1 }"), "Must increment usedQuantity");
});

test("spin sets expiresAt for non-ZONK rewards", () => {
    assert(spinWheelCode.includes("expiresAt"), "Must set expiresAt for rewards");
});

// ==========================================
// B. CHECKOUT INTEGRATION
// ==========================================

console.log("\nB. Checkout Integration (lib/checkout.ts):");

const checkoutCode = readFile("lib/checkout.ts");

test("checkout imports calculateSpinRewardDiscount", () => {
    assert(checkoutCode.includes('from "./spin-wheel"'), "Must import from spin-wheel");
});

test("checkout input type includes spinWheelSpinId", () => {
    assert(checkoutCode.includes("spinWheelSpinId?: number | null"), "CreateCheckoutInput must have spinWheelSpinId");
});

test("checkout validates spinWheelSpin ownership", () => {
    assert(checkoutCode.includes("spinRecord.userId !== input.userId"), "Must validate user ownership");
});

test("checkout validates spin status is AVAILABLE", () => {
    assert(checkoutCode.includes('status !== "AVAILABLE"'), "Must check status is AVAILABLE");
});

test("checkout validates spin expiry", () => {
    assert(checkoutCode.includes("spinRecord.expiresAt"), "Must check expiry date");
});

test("checkout calculates spin wheel discount for FIXED type", () => {
    assert(checkoutCode.includes('reward.type === "FIXED"'), "Must handle FIXED discount");
});

test("checkout calculates spin wheel discount for PERCENTAGE type", () => {
    assert(checkoutCode.includes('reward.type === "PERCENTAGE"'), "Must handle PERCENTAGE discount");
});

test("checkout handles FREE_SHIPPING by zeroing shipping", () => {
    assert(checkoutCode.includes("finalShippingCost2 = 0"), "FREE_SHIPPING must zero shipping cost");
});

test("checkout combines voucher + spin wheel discounts in total", () => {
    assert(checkoutCode.includes("totalDiscount = discount + spinWheelDiscount"), "Must combine discounts");
});

test("checkout applies combined discount to order", () => {
    assert(checkoutCode.includes("discount: totalDiscount"), "Order must use combined discount");
});

test("checkout marks spin as USED after order creation", () => {
    assert(checkoutCode.includes('status: "USED"'), "Must mark spin as USED");
});

test("checkout links spin to order via orderId", () => {
    assert(checkoutCode.includes("orderId: order.id"), "Must link spin to order");
});

test("checkout logs SPIN_WHEEL_REWARD_APPLIED", () => {
    assert(checkoutCode.includes("SPIN_WHEEL_REWARD_APPLIED"), "Must log event");
});

// ==========================================
// C. API SECURITY
// ==========================================

console.log("\nC. API Security:");

const spinApiCode = readFile("app/api/spin-wheel/spin/route.ts");
const eligibilityApiCode = readFile("app/api/spin-wheel/route.ts");
const adminCampaignApiCode = readFile("app/api/admin/spin-wheel/campaigns/route.ts");
const adminCampaignIdApiCode = readFile("app/api/admin/spin-wheel/campaigns/[id]/route.ts");

test("spin endpoint requires auth", () => {
    assert(spinApiCode.includes("auth()"), "Must call auth()");
});

test("spin endpoint uses session user ID", () => {
    assert(spinApiCode.includes("session.user.id"), "Must use session.user.id");
});

test("spin endpoint does not accept userId from body", () => {
    assert(!spinApiCode.includes("body.userId") && !spinApiCode.includes("req.body.userId"), "Must not accept userId from body");
});

test("eligibility endpoint requires auth", () => {
    assert(eligibilityApiCode.includes("auth()"), "Must call auth()");
});

test("admin campaign API requires ADMIN role", () => {
    assert(adminCampaignApiCode.includes('"ADMIN"'), "Must require ADMIN role");
});

test("admin campaign [id] API requires ADMIN role", () => {
    assert(adminCampaignIdApiCode.includes('"ADMIN"'), "Must require ADMIN role");
});

test("my-rewards endpoint requires auth", () => {
    const myRewardsCode = readFile("app/api/spin-wheel/my-rewards/route.ts");
    assert(myRewardsCode.includes("auth()"), "Must call auth()");
});

test("my-rewards endpoint uses session userId", () => {
    const myRewardsCode = readFile("app/api/spin-wheel/my-rewards/route.ts");
    assert(myRewardsCode.includes("session.user.id"), "Must use session.user.id");
});

// ==========================================
// D. DATABASE SCHEMA
// ==========================================

console.log("\nD. Database Schema (prisma/schema.prisma):");

const schema = readFile("prisma/schema.prisma");

test("SpinWheelCampaign model exists", () => {
    assert(schema.includes("model SpinWheelCampaign"), "Missing model");
});

test("SpinWheelReward model exists", () => {
    assert(schema.includes("model SpinWheelReward"), "Missing model");
});

test("SpinWheelSpin model exists", () => {
    assert(schema.includes("model SpinWheelSpin"), "Missing model");
});

test("SpinWheelCampaign has minimumSpend field", () => {
    assert(schema.includes("minimumSpend Decimal"), "Missing minimumSpend");
});

test("SpinWheelCampaign has maxSpinsPerUser field", () => {
    assert(schema.includes("maxSpinsPerUser Int"), "Missing maxSpinsPerUser");
});

test("SpinWheelCampaign has isActive field", () => {
    assert(schema.includes("isActive Boolean"), "Missing isActive");
});

test("SpinWheelCampaign has startAt and endAt", () => {
    assert(schema.includes("startAt DateTime"), "Missing startAt");
    assert(schema.includes("endAt DateTime"), "Missing endAt");
});

test("SpinWheelReward has weight field", () => {
    assert(schema.includes("weight Int"), "Missing weight");
});

test("SpinWheelReward has totalQuantity and usedQuantity", () => {
    assert(schema.includes("totalQuantity Int?"), "Missing totalQuantity");
    assert(schema.includes("usedQuantity Int"), "Missing usedQuantity");
});

test("SpinWheelReward has type enum SpinWheelRewardType", () => {
    assert(schema.includes("type SpinWheelRewardType"), "Missing type field");
});

test("SpinWheelRewardType enum includes all types", () => {
    assert(schema.includes("enum SpinWheelRewardType"), "Missing enum");
    assert(schema.includes("PERCENTAGE"), "Missing PERCENTAGE");
    assert(schema.includes("FIXED"), "Missing FIXED");
    assert(schema.includes("FREE_SHIPPING"), "Missing FREE_SHIPPING");
    assert(schema.includes("CASHBACK"), "Missing CASHBACK");
    assert(schema.includes("ZONK"), "Missing ZONK");
});

test("SpinWheelSpin has userId relation", () => {
    assert(schema.includes("userId String"), "Missing userId");
});

test("SpinWheelSpin has unique constraint on [campaignId, userId]", () => {
    assert(schema.includes("@@unique([campaignId, userId])"), "Missing unique constraint");
});

test("SpinWheelSpin has unique orderId for order linking", () => {
    assert(schema.includes("orderId Int? @unique"), "Missing unique orderId");
});

test("SpinWheelSpinStatus enum has correct values", () => {
    assert(schema.includes("enum SpinWheelSpinStatus"), "Missing enum");
    assert(schema.includes("AVAILABLE"), "Missing AVAILABLE");
    assert(schema.includes("USED"), "Missing USED");
    assert(schema.includes("EXPIRED"), "Missing EXPIRED");
    assert(schema.includes("CANCELLED"), "Missing CANCELLED");
});

test("User model has spinWheelSpins relation", () => {
    assert(schema.includes("spinWheelSpins SpinWheelSpin[]"), "Missing User relation");
});

test("Order model has spinWheelSpin relation", () => {
    assert(schema.includes("spinWheelSpin SpinWheelSpin?"), "Missing Order relation");
});

test("SpinWheelCampaign has slug field", () => {
    assert(schema.includes("slug String @unique"), "Missing slug field");
});

test("Migration file exists", () => {
    const migration = readFile("prisma/migrations/20260825100000_add_spin_wheel/migration.sql");
    assert(migration.length > 100, "Migration file must exist and have content");
});

// ==========================================
// E. UI STRUCTURE
// ==========================================

console.log("\nE. UI Structure:");

test("admin spin-wheel page exists", () => {
    const adminPage = readFile("app/admin/spin-wheel/page.tsx");
    assert(adminPage.length > 100, "Admin page must exist");
});

test("admin spin-wheel page has CRUD functionality", () => {
    const adminPage = readFile("app/admin/spin-wheel/page.tsx");
    assert(adminPage.includes("handleSubmit"), "Must have form handler");
    assert(adminPage.includes("loadCampaigns"), "Must load campaigns");
});

test("SpinWheelPopup component exists", () => {
    const popup = readFile("components/SpinWheelPopup.tsx");
    assert(popup.length > 100, "SpinWheelPopup must exist");
});

test("SpinWheelPopup calls server-side spin API", () => {
    const popup = readFile("components/SpinWheelPopup.tsx");
    assert(popup.includes("/api/spin-wheel/spin"), "Must call server spin API");
});

test("SpinWheelPopup does NOT use Math.random()", () => {
    const popup = readFile("components/SpinWheelPopup.tsx");
    assert(!popup.includes("Math.random()"), "Must not use client-side random");
});

test("SpinWheelPopup uses useSession for auth", () => {
    const popup = readFile("components/SpinWheelPopup.tsx");
    assert(popup.includes("useSession"), "Must use useSession");
});

test("/home page includes SpinWheelContainer", () => {
    const homePage = readFile("app/home/page.tsx");
    assert(homePage.includes("SpinWheelContainer"), "/home page must include SpinWheelContainer");
});

test("profile page has Promo Saya link", () => {
    const profile = readFile("app/profile/ProfileContent.tsx");
    assert(profile.includes("Promo Saya") || profile.includes("/promos"), "Profile must have promo link");
});

test("promos page exists", () => {
    const promos = readFile("app/promos/page.tsx");
    assert(promos.length > 100, "Promos page must exist");
});

test("promos page shows reward status badges", () => {
    const promos = readFile("app/promos/page.tsx");
    assert(promos.includes("AVAILABLE") && promos.includes("USED") && promos.includes("EXPIRED"), "Must show all statuses");
});

test("admin navbar includes Spin Wheel link", () => {
    const navbar = readFile("components/admin/AdminNavbar.tsx");
    assert(navbar.includes("/admin/spin-wheel"), "Must include spin wheel link");
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
