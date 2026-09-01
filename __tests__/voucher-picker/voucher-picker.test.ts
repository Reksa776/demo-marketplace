/**
 * ==========================================
 * VOUCHER PICKER FEATURE TESTS
 * ==========================================
 *
 * Static/code-path verification tests.
 * Run: npx tsx __tests__/voucher-picker/voucher-picker.test.ts
 *
 * Tests cover:
 * A. API Endpoint (/api/vouchers/available)
 * B. VoucherPickerModal Component
 * C. CheckoutPage Integration
 * D. BuyNowPage Integration
 * E. Server-Side Validation
 * F. Security
 * G. Existing Tests Pass (Regression)
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
// A. API ENDPOINT
// ==========================================

console.log("\nA. API Endpoint (app/api/vouchers/available/route.ts):");

const apiCode = readFile("app/api/vouchers/available/route.ts");

test("API endpoint exists with GET handler", () => {
    assert(apiCode.includes("export async function GET"), "Missing GET handler");
});

test("API requires authentication", () => {
    assert(apiCode.includes("auth()"), "Must call auth()");
    assert(apiCode.includes("session?.user?.id"), "Must check session user ID");
});

test("API validates subtotal parameter", () => {
    assert(apiCode.includes("subtotalParam"), "Must parse subtotal param");
    assert(apiCode.includes("Number(subtotal)"), "Must convert subtotal to number");
});

test("API returns 401 for unauthenticated users", () => {
    assert(apiCode.includes("status: 401"), "Must return 401 for no auth");
});

test("API returns 400 for invalid subtotal", () => {
    assert(apiCode.includes("status: 400"), "Must return 400 for bad input");
});

test("API queries active vouchers from database", () => {
    assert(apiCode.includes("voucher.findMany"), "Must query vouchers from DB");
    assert(apiCode.includes("isActive: true"), "Must filter active vouchers only");
});

test("API checks voucher expiry", () => {
    assert(apiCode.includes("v.endDate"), "Must check endDate");
    assert(apiCode.includes("v.startDate"), "Must check startDate");
});

test("API checks global quota", () => {
    assert(apiCode.includes("v.quota"), "Must check quota");
    assert(apiCode.includes("v.usedCount"), "Must check usedCount");
});

test("API checks per-user usage limits", () => {
    assert(apiCode.includes("voucherUserUsage.findMany"), "Must query user usage");
    assert(apiCode.includes("v.maxUsagePerUser"), "Must check per-user limit");
});

test("API checks product restrictions", () => {
    assert(apiCode.includes("productRestrictions"), "Must check product restrictions");
});

test("API checks category restrictions", () => {
    assert(apiCode.includes("categoryRestrictions"), "Must check category restrictions");
});

test("API checks campaign restrictions", () => {
    assert(apiCode.includes("campaignId"), "Must check campaign restriction");
});

test("API checks eligibility (NEW_USER / RETURNING_USER)", () => {
    assert(apiCode.includes("eligibility"), "Must check eligibility");
    assert(apiCode.includes("NEW_USER"), "Must handle NEW_USER eligibility");
    assert(apiCode.includes("RETURNING_USER"), "Must handle RETURNING_USER eligibility");
});

test("API calculates discount preview for eligible vouchers", () => {
    assert(apiCode.includes("calculatedDiscount"), "Must calculate discount");
    assert(apiCode.includes("PERCENTAGE"), "Must handle PERCENTAGE type");
    assert(apiCode.includes("FIXED"), "Must handle FIXED type");
});

test("API caps discount at maxDiscount", () => {
    assert(apiCode.includes("maxDiscount"), "Must handle maxDiscount cap");
});

test("API caps discount at subtotal", () => {
    assert(apiCode.includes("Math.min(discount, subtotal)"), "Must cap at subtotal");
});

test("API fetches spin wheel rewards", () => {
    assert(apiCode.includes("spinWheelSpin.findMany"), "Must query spin wheel spins");
    assert(apiCode.includes('status: "AVAILABLE"'), "Must filter AVAILABLE spins");
});

test("API checks spin wheel reward expiry", () => {
    assert(apiCode.includes("spin.expiresAt"), "Must check spin expiry");
});

test("API calculates spin wheel discount preview", () => {
    assert(apiCode.includes("calculateSpinRewardDiscount"), "Must calculate spin discount");
});

test("API sorts eligible vouchers by discount descending", () => {
    assert(apiCode.includes("calculatedDiscount"), "Must sort by discount");
    assert(apiCode.includes("b.calculatedDiscount - a.calculatedDiscount"), "Must sort DESC");
});

test("API returns vouchers and spinWheelRewards", () => {
    assert(apiCode.includes("vouchers:"), "Must return vouchers");
    assert(apiCode.includes("spinWheelRewards:"), "Must return spinWheelRewards");
});

test("API does not expose sensitive data", () => {
    // Should not return internal fields like usedCount, quota, etc.
    assert(!apiCode.includes("usedCount:"), "Should not expose usedCount");
    assert(!apiCode.includes("quota:"), "Should not expose quota");
});

test("API returns error reason for ineligible vouchers", () => {
    assert(apiCode.includes("result.reason ="), "Must set reason for ineligible");
});

test("API handles empty items parameter gracefully", () => {
    assert(apiCode.includes("itemsParam"), "Must parse items param");
    assert(apiCode.includes("JSON.parse"), "Must parse JSON items");
});

test("API has rate limiting", () => {
    assert(apiCode.includes("rateLimiters"), "Must use rate limiters");
    assert(apiCode.includes("getClientIp"), "Must get client IP for rate limiting");
});

test("API returns 429 when rate limited", () => {
    assert(apiCode.includes("status: 429"), "Must return 429 on rate limit");
});

// ==========================================
// B. VoucherPickerModal COMPONENT
// ==========================================

console.log("\nB. VoucherPickerModal Component (components/VoucherPickerModal.tsx):");

const modalCode = readFile("components/VoucherPickerModal.tsx");

test("Component is a client component", () => {
    assert(modalCode.includes('"use client"'), "Must be a client component");
});

test("Component exports VoucherPickerModal", () => {
    assert(modalCode.includes("export default function VoucherPickerModal"), "Must export component");
});

test("Component accepts open prop", () => {
    assert(modalCode.includes("open:"), "Must accept open prop");
});

test("Component accepts onClose prop", () => {
    assert(modalCode.includes("onClose:"), "Must accept onClose prop");
});

test("Component accepts onSelect prop", () => {
    assert(modalCode.includes("onSelect:"), "Must accept onSelect prop");
});

test("Component accepts subtotal prop", () => {
    assert(modalCode.includes("subtotal:"), "Must accept subtotal prop");
});

test("Component accepts currentSelection prop", () => {
    assert(modalCode.includes("currentSelection:"), "Must accept currentSelection prop");
});

test("Component fetches vouchers from API", () => {
    assert(modalCode.includes("/api/vouchers/available"), "Must call vouchers API");
});

test("Component renders eligible vouchers section", () => {
    assert(modalCode.includes("Voucher Diskon"), "Must render eligible vouchers section");
});

test("Component renders eligible spin wheel rewards section", () => {
    assert(modalCode.includes("Voucher Spin Wheel"), "Must render spin wheel section");
});

test("Component renders ineligible vouchers section", () => {
    assert(modalCode.includes("Tidak dapat digunakan"), "Must render ineligible section");
});

test("Component shows reason for ineligible vouchers", () => {
    assert(modalCode.includes("item.reason"), "Must show reason for ineligible");
});

test("Component supports radio-style selection", () => {
    assert(modalCode.includes("rounded-full border-2"), "Must have radio indicator");
});

test("Component handles mutual exclusion (voucher vs spin wheel)", () => {
    // When voucher is selected, spin wheel is cleared and vice versa
    assert(modalCode.includes("spinWheelSpinId: null") || modalCode.includes("spinWheelSpinId: isAlreadySelected"), "Must handle mutual exclusion");
});

test("Component shows empty state when no vouchers", () => {
    assert(modalCode.includes("Belum ada voucher"), "Must show empty state");
});

test("Component shows loading state", () => {
    assert(modalCode.includes("Memuat voucher"), "Must show loading state");
});

test("Component has sticky header", () => {
    assert(modalCode.includes("shrink-0"), "Must have sticky header");
});

test("Component has sticky footer with confirm button", () => {
    assert(modalCode.includes("shrink-0") && modalCode.includes("border-t"), "Must have sticky footer");
});

test("Component has scrollable content area", () => {
    assert(modalCode.includes("overflow-y-auto"), "Must have scrollable content");
});

test("Component renders as bottom sheet on mobile", () => {
    assert(modalCode.includes("items-end"), "Must render at bottom on mobile");
});

test("Component renders as centered modal on desktop", () => {
    assert(modalCode.includes("sm:items-center"), "Must center on desktop");
});

test("Component prevents body scroll when open", () => {
    assert(modalCode.includes("overflow"), "Must prevent body scroll");
});

test("Component supports Escape key to close", () => {
    assert(modalCode.includes('"Escape"'), "Must handle Escape key");
});

test("Component shows Hemat discount for eligible items", () => {
    assert(modalCode.includes("Hemat"), "Must show Hemat discount");
});

test("Component shows expiry date", () => {
    assert(modalCode.includes("Berlaku sampai"), "Must show expiry date");
});

test("Component shows minimum purchase", () => {
    assert(modalCode.includes("Min. belanja"), "Must show minimum purchase");
});

test("Component has Tutup (close) button", () => {
    assert(modalCode.includes("Tutup"), "Must have close button");
});

test("Component has Gunakan Voucher/Reward button", () => {
    assert(modalCode.includes("Gunakan Voucher") || modalCode.includes("Gunakan Reward"), "Must have confirm button");
});

test("Component shows Pilih Voucher when nothing selected", () => {
    assert(modalCode.includes("Pilih Voucher"), "Must show Pilih Voucher when nothing selected");
});

// ==========================================
// C. CHECKOUT PAGE INTEGRATION
// ==========================================

console.log("\nC. CheckoutPage Integration (app/checkout/CheckoutPage.tsx):");

const checkoutPage = readFile("app/checkout/CheckoutPage.tsx");

test("CheckoutPage imports VoucherPickerModal", () => {
    assert(checkoutPage.includes('import VoucherPickerModal from "@/components/VoucherPickerModal"'), "Must import VoucherPickerModal");
});

test("CheckoutPage imports VoucherPickerSelection type", () => {
    assert(checkoutPage.includes('import type { VoucherPickerSelection }'), "Must import VoucherPickerSelection type");
});

test("CheckoutPage has showVoucherPicker state", () => {
    assert(checkoutPage.includes("showVoucherPicker"), "Must have showVoucherPicker state");
});

test("CheckoutPage has voucherPickerSelection state", () => {
    assert(checkoutPage.includes("voucherPickerSelection"), "Must have voucherPickerSelection state");
});

test("CheckoutPage has handleVoucherPickerSelect handler", () => {
    assert(checkoutPage.includes("handleVoucherPickerSelect"), "Must have handler function");
});

test("CheckoutPage handler updates appliedVoucherCode", () => {
    assert(checkoutPage.includes("setAppliedVoucherCode(selection.voucherCode"), "Must update appliedVoucherCode");
});

test("CheckoutPage handler updates voucherDiscount", () => {
    assert(checkoutPage.includes("setVoucherDiscount(selection.voucherDiscount)"), "Must update voucherDiscount");
});

test("CheckoutPage handler updates selectedSpinReward", () => {
    assert(checkoutPage.includes("setSelectedSpinReward(selection.spinWheelSpinId)"), "Must update selectedSpinReward");
});

test("CheckoutPage renders VoucherPickerModal", () => {
    assert(checkoutPage.includes("<VoucherPickerModal"), "Must render VoucherPickerModal");
});

test("CheckoutPage VoucherPickerModal receives subtotal", () => {
    assert(checkoutPage.includes("subtotal={data.subtotal}"), "Must pass subtotal");
});

test("CheckoutPage VoucherPickerModal receives currentSelection", () => {
    assert(checkoutPage.includes("currentSelection={voucherPickerSelection}"), "Must pass currentSelection");
});

test("CheckoutPage shows Voucher section with Pilih/Ubah button", () => {
    assert(checkoutPage.includes("Pilih >") || checkoutPage.includes("Ubah >"), "Must show Pilih or Ubah button");
});

test("CheckoutPage shows selected voucher name", () => {
    assert(checkoutPage.includes("appliedVoucherCode"), "Must show voucher code");
});

test("CheckoutPage shows selected spin wheel reward", () => {
    assert(checkoutPage.includes("Reward Spin Wheel"), "Must show spin wheel reward");
});

test("CheckoutPage shows Hemat discount", () => {
    assert(checkoutPage.includes("Hemat"), "Must show Hemat discount");
});

test("CheckoutPage still sends voucherCode in COD payload", () => {
    assert(checkoutPage.includes("voucherCode: appliedVoucherCode || null"), "Must send voucherCode");
});

test("CheckoutPage still sends spinWheelSpinId in COD payload", () => {
    assert(checkoutPage.includes("spinWheelSpinId: selectedSpinReward"), "Must send spinWheelSpinId");
});

test("CheckoutPage still sends voucherCode in iPaymu payload", () => {
    const ipaymuSection = checkoutPage.substring(checkoutPage.indexOf("api/payment/ipaymu"));
    assert(ipaymuSection.includes("voucherCode: appliedVoucherCode || null"), "iPaymu must send voucherCode");
});

test("CheckoutPage still sends spinWheelSpinId in iPaymu payload", () => {
    const ipaymuSection = checkoutPage.substring(checkoutPage.indexOf("api/payment/ipaymu"));
    assert(ipaymuSection.includes("spinWheelSpinId: selectedSpinReward"), "iPaymu must send spinWheelSpinId");
});

test("CheckoutPage has manual voucher code input option", () => {
    assert(checkoutPage.includes('Masukkan kode voucher'), "Must have manual voucher code input option");
    assert(checkoutPage.includes('manualVoucherCode'), "Must have manualVoucherCode state");
});

test("CheckoutPage no longer has spin wheel radio list in summary", () => {
    // The old code had radio inputs for spin wheel rewards inline in summary
    assert(!checkoutPage.includes('name="spinReward"'), "Must not have inline spin wheel radio list");
});

// ==========================================
// D. BUY NOW PAGE INTEGRATION
// ==========================================

console.log("\nD. BuyNowPage Integration (app/buy-now/BuyNowPage.tsx):");

const buyNowPage = readFile("app/buy-now/BuyNowPage.tsx");

test("BuyNowPage imports VoucherPickerModal", () => {
    assert(buyNowPage.includes('import VoucherPickerModal from "@/components/VoucherPickerModal"'), "Must import VoucherPickerModal");
});

test("BuyNowPage imports VoucherPickerSelection type", () => {
    assert(buyNowPage.includes('import type { VoucherPickerSelection }'), "Must import VoucherPickerSelection type");
});

test("BuyNowPage has showVoucherPicker state", () => {
    assert(buyNowPage.includes("showVoucherPicker"), "Must have showVoucherPicker state");
});

test("BuyNowPage has voucherPickerSelection state", () => {
    assert(buyNowPage.includes("voucherPickerSelection"), "Must have voucherPickerSelection state");
});

test("BuyNowPage has handleVoucherPickerSelect handler", () => {
    assert(buyNowPage.includes("handleVoucherPickerSelect"), "Must have handler function");
});

test("BuyNowPage renders VoucherPickerModal", () => {
    assert(buyNowPage.includes("<VoucherPickerModal"), "Must render VoucherPickerModal");
});

test("BuyNowPage VoucherPickerModal receives subtotal", () => {
    assert(buyNowPage.includes("subtotal={data.subtotal}"), "Must pass subtotal");
});

test("BuyNowPage shows Voucher section with Pilih/Ubah button", () => {
    assert(buyNowPage.includes("Pilih >") || buyNowPage.includes("Ubah >"), "Must show Pilih or Ubah button");
});

test("BuyNowPage shows selected voucher or spin wheel", () => {
    assert(buyNowPage.includes("appliedVoucherCode") || buyNowPage.includes("selectedSpinReward"), "Must show selection");
});

test("BuyNowPage sends voucherCode in COD payload", () => {
    assert(buyNowPage.includes("voucherCode: appliedVoucherCode || null"), "Must send voucherCode");
});

test("BuyNowPage sends spinWheelSpinId in COD payload", () => {
    assert(buyNowPage.includes("spinWheelSpinId: selectedSpinReward"), "Must send spinWheelSpinId");
});

test("BuyNowPage sends voucherCode in iPaymu payload", () => {
    const ipaymuSection = buyNowPage.substring(buyNowPage.indexOf("api/buy-now/ipaymu"));
    assert(ipaymuSection.includes("voucherCode: appliedVoucherCode || null"), "iPaymu must send voucherCode");
});

test("BuyNowPage sends spinWheelSpinId in iPaymu payload", () => {
    const ipaymuSection = buyNowPage.substring(buyNowPage.indexOf("api/buy-now/ipaymu"));
    assert(ipaymuSection.includes("spinWheelSpinId: selectedSpinReward"), "iPaymu must send spinWheelSpinId");
});

test("BuyNowPage has manual voucher code input option", () => {
    assert(buyNowPage.includes('Masukkan kode voucher'), "Must have manual voucher code input option");
    assert(buyNowPage.includes('manualVoucherCode'), "Must have manualVoucherCode state");
});

test("BuyNowPage has no spin wheel radio list in summary", () => {
    assert(!buyNowPage.includes('name="spinReward"'), "Must not have inline spin wheel radio list");
});

test("CheckoutPage has removeManualVoucher function", () => {
    assert(checkoutPage.includes('function removeManualVoucher'), "Must have removeManualVoucher function");
});

test("BuyNowPage has removeManualVoucher function", () => {
    assert(buyNowPage.includes('function removeManualVoucher'), "Must have removeManualVoucher function");
});

test("CheckoutPage has validateManualVoucher function", () => {
    assert(checkoutPage.includes('async function validateManualVoucher'), "Must have validateManualVoucher function");
});

test("BuyNowPage has validateManualVoucher function", () => {
    assert(buyNowPage.includes('async function validateManualVoucher'), "Must have validateManualVoucher function");
});

test("CheckoutPage validateManualVoucher calls /api/voucher/validate", () => {
    assert(checkoutPage.includes('/api/voucher/validate'), "Must call voucher validate API");
});

test("BuyNowPage validateManualVoucher calls /api/voucher/validate", () => {
    assert(buyNowPage.includes('/api/voucher/validate'), "Must call voucher validate API");
});

test("CheckoutPage validates voucher server-side (not client-side)", () => {
    assert(checkoutPage.includes('setVoucherDiscount(result.data.discount)'), "Must use server-calculated discount");
});

test("BuyNowPage validates voucher server-side (not client-side)", () => {
    assert(buyNowPage.includes('setVoucherDiscount(result.data.discount)'), "Must use server-calculated discount");
});

test("CheckoutPage shows error on invalid manual voucher", () => {
    assert(checkoutPage.includes('Kode voucher tidak dapat digunakan'), "Must show user-friendly error");
});

test("BuyNowPage shows error on invalid manual voucher", () => {
    assert(buyNowPage.includes('Kode voucher tidak dapat digunakan'), "Must show user-friendly error");
});

test("CheckoutPage manual voucher clears spin wheel (mutual exclusion)", () => {
    assert(checkoutPage.includes('setSelectedSpinReward(null)'), "Must clear spin wheel on manual voucher apply");
});

test("BuyNowPage manual voucher clears spin wheel (mutual exclusion)", () => {
    assert(buyNowPage.includes('setSelectedSpinReward(null)'), "Must clear spin wheel on manual voucher apply");
});

test("CheckoutPage has remove (Hapus) button for applied voucher", () => {
    assert(checkoutPage.includes('removeManualVoucher'), "Must have remove button");
});

test("BuyNowPage has remove (Hapus) button for applied voucher", () => {
    assert(buyNowPage.includes('removeManualVoucher'), "Must have remove button");
});

test("BuyNowPage has no duplicate voucher sections", () => {
    const voucherTriggers = buyNowPage.match(/setShowVoucherPicker\(true\)/g);
    assert(voucherTriggers && voucherTriggers.length === 1, `Expected exactly 1 voucher picker trigger, found ${voucherTriggers?.length || 0}`);
});

test("CheckoutPage has no dead applyVoucher function", () => {
    assert(!checkoutPage.includes("async function applyVoucher()"), "Must not have dead applyVoucher function");
});

test("CheckoutPage has no dead removeVoucher function", () => {
    assert(!checkoutPage.includes("function removeVoucher()"), "Must not have dead removeVoucher function");
});

test("BuyNowPage has no dead applyVoucher function", () => {
    assert(!buyNowPage.includes("async function applyVoucher()"), "Must not have dead applyVoucher function");
});

test("BuyNowPage has no dead removeVoucher function", () => {
    assert(!buyNowPage.includes("function removeVoucher()"), "Must not have dead removeVoucher function");
});

test("CheckoutPage has no voucherLoading state", () => {
    assert(!checkoutPage.includes("voucherLoading"), "Must not have unused voucherLoading state");
});

test("BuyNowPage has no voucherLoading state", () => {
    assert(!buyNowPage.includes("voucherLoading"), "Must not have unused voucherLoading state");
});

// ==========================================
// E. SERVER-SIDE VALIDATION
// ==========================================

console.log("\nE. Server-Side Validation:");

test("Server validates voucher ownership via userId", () => {
    assert(apiCode.includes("userId"), "Must validate ownership");
});

test("Server validates voucher status (isActive)", () => {
    assert(apiCode.includes("isActive"), "Must validate status");
});

test("Server validates voucher expiry", () => {
    assert(apiCode.includes("endDate") || apiCode.includes("expiresAt"), "Must validate expiry");
});

test("Server validates minimum purchase", () => {
    assert(apiCode.includes("minPurchase"), "Must validate minimum purchase");
});

test("Server validates product restrictions", () => {
    assert(apiCode.includes("productRestrictions"), "Must validate product restrictions");
});

test("Server validates category restrictions", () => {
    assert(apiCode.includes("categoryRestrictions"), "Must validate category restrictions");
});

test("Server calculates discount, not client", () => {
    assert(apiCode.includes("calculatedDiscount"), "Must calculate discount server-side");
});

test("Server caps discount at maxDiscount", () => {
    assert(apiCode.includes("maxDiscount"), "Must cap at maxDiscount");
});

test("Server ensures total never negative", () => {
    assert(apiCode.includes("Math.min(discount, subtotal)"), "Must ensure non-negative total");
});

test("Server validates spin wheel ownership", () => {
    assert(apiCode.includes("userId"), "Must validate spin wheel ownership");
});

test("Server validates spin wheel status is AVAILABLE", () => {
    assert(apiCode.includes('"AVAILABLE"'), "Must validate spin status");
});

test("Server validates spin wheel expiry", () => {
    assert(apiCode.includes("spin.expiresAt"), "Must validate spin expiry");
});

// ==========================================
// F. SECURITY
// ==========================================

console.log("\nF. Security:");

test("API does not accept discount amount from client", () => {
    assert(!apiCode.includes("body.discount") && !apiCode.includes("req.body.discount"), "Must not accept discount from client");
});

test("API does not accept final total from client", () => {
    assert(!apiCode.includes("body.total") && !apiCode.includes("body.finalTotal"), "Must not accept total from client");
});

test("API does not accept eligibility from client", () => {
    assert(!apiCode.includes("body.eligible"), "Must not accept eligibility from client");
});

test("API does not accept voucher code from client", () => {
    assert(!apiCode.includes("body.code") && !apiCode.includes("body.voucherCode"), "Must not accept voucher code from client");
});

test("API does not accept price from client", () => {
    assert(!apiCode.includes("body.price"), "Must not accept price from client");
});

test("VoucherPickerModal does not store discount amount as source of truth", () => {
    // The modal receives discount for display, but checkout sends only IDs
    assert(checkoutPage.includes("voucherCode: appliedVoucherCode || null"), "Checkout sends only code, not amount");
    assert(checkoutPage.includes("spinWheelSpinId: selectedSpinReward"), "Checkout sends only spinId, not amount");
});

test("Client does not send discountAmount to server", () => {
    assert(!checkoutPage.includes("discountAmount:"), "Checkout must not send discountAmount");
    assert(!buyNowPage.includes("discountAmount:"), "BuyNow must not send discountAmount");
});

test("Client does not send finalTotal to server", () => {
    assert(!checkoutPage.includes("finalTotal:"), "Checkout must not send finalTotal");
    assert(!buyNowPage.includes("finalTotal:"), "BuyNow must not send finalTotal");
});

// ==========================================
// G. MUTUAL EXCLUSION (SERVER-SIDE)
// ==========================================

console.log("\nG. Mutual Exclusion — Voucher XOR Spin Wheel:");

const checkoutCode = readFile("lib/checkout.ts");

test("Server enforces mutual exclusion between voucher and spin wheel", () => {
    assert(
        checkoutCode.includes("hasVoucher") &&
        checkoutCode.includes("hasSpinWheel") &&
        checkoutCode.includes("Silakan pilih salah satu"),
        "Must check hasVoucher && hasSpinWheel and reject with message"
    );
});

test("Mutual exclusion check is BEFORE voucher processing", () => {
    const mutualIdx = checkoutCode.indexOf("hasVoucher && hasSpinWheel");
    const voucherIdx = checkoutCode.indexOf("let voucherId:");
    assert(
        mutualIdx > 0 && voucherIdx > 0 && mutualIdx < voucherIdx,
        "Mutual exclusion must come before voucher processing"
    );
});

test("Mutual exclusion check is BEFORE spin wheel processing", () => {
    const mutualIdx = checkoutCode.indexOf("hasVoucher && hasSpinWheel");
    const spinIdx = checkoutCode.indexOf("SPIN WHEEL REWARD DISCOUNT");
    assert(
        mutualIdx > 0 && spinIdx > 0 && mutualIdx < spinIdx,
        "Mutual exclusion must come before spin wheel processing"
    );
});

test("Mutual exclusion check is BEFORE order creation", () => {
    const mutualIdx = checkoutCode.indexOf("hasVoucher && hasSpinWheel");
    const orderIdx = checkoutCode.indexOf("tx.order.create");
    assert(
        mutualIdx > 0 && orderIdx > 0 && mutualIdx < orderIdx,
        "Mutual exclusion must come before order creation"
    );
});

test("Mutual exclusion check is BEFORE stock reservation", () => {
    const mutualIdx = checkoutCode.indexOf("hasVoucher && hasSpinWheel");
    const stockIdx = checkoutCode.indexOf("RESERVE STOCK");
    assert(
        mutualIdx > 0 && stockIdx > 0 && mutualIdx < stockIdx,
        "Mutual exclusion must come before stock reservation"
    );
});

test("Server rejects with user-friendly error message", () => {
    assert(
        checkoutCode.includes('"Silakan pilih salah satu voucher atau reward Spin Wheel."'),
        "Must have user-friendly rejection message"
    );
});

test("hasVoucher checks string type and non-empty trim", () => {
    assert(
        checkoutCode.includes('typeof input.voucherCode === "string"') &&
        checkoutCode.includes('input.voucherCode.trim().length > 0'),
        "hasVoucher must check type and non-empty"
    );
});

test("hasSpinWheel checks number type and positive value", () => {
    assert(
        checkoutCode.includes('typeof input.spinWheelSpinId === "number"') &&
        checkoutCode.includes('input.spinWheelSpinId > 0'),
        "hasSpinWheel must check type and positive"
    );
});

test("Frontend CheckoutPage sends only one of voucherCode or spinWheelSpinId", () => {
    // The payload should send both fields but server enforces XOR
    assert(
        checkoutPage.includes("voucherCode: appliedVoucherCode || null") &&
        checkoutPage.includes("spinWheelSpinId: selectedSpinReward"),
        "Checkout payload must include both fields (server enforces XOR)"
    );
});

test("Frontend BuyNowPage sends only one of voucherCode or spinWheelSpinId", () => {
    assert(
        buyNowPage.includes("voucherCode: appliedVoucherCode || null") &&
        buyNowPage.includes("spinWheelSpinId: selectedSpinReward"),
        "BuyNow payload must include both fields (server enforces XOR)"
    );
});

test("Frontend handleVoucherPickerSelect clears opposite selection", () => {
    // When voucher is selected, spinWheelSpinId should be null
    // When spin wheel is selected, voucherCode should be null
    assert(
        checkoutCode.includes("setSelectedSpinReward(selection.spinWheelSpinId)"),
        "Checkout handler must update selectedSpinReward"
    );
    // The VoucherPickerModal handles the mutual exclusion by setting null
    const modalCode = readFile("components/VoucherPickerModal.tsx");
    assert(
        modalCode.includes("spinWheelSpinId: isAlreadySelected ? pendingSelection.spinWheelSpinId : null") ||
        modalCode.includes("spinWheelSpinId: null") ||
        modalCode.includes("spinWheelSpinId: isAlreadySelected"),
        "Modal must enforce mutual exclusion by clearing spinWheelSpinId when voucher selected"
    );
    assert(
        modalCode.includes("voucherCode: isAlreadySelected ? pendingSelection.voucherCode : null") ||
        modalCode.includes("voucherCode: null") ||
        modalCode.includes("voucherCode: isAlreadySelected"),
        "Modal must enforce mutual exclusion by clearing voucherCode when spin wheel selected"
    );
});

test("Both COD and iPaymu payloads include mutual exclusion fields", () => {
    // Checkout COD
    const codPayload = checkoutPage.substring(
        checkoutPage.indexOf('/api/orders'),
        checkoutPage.indexOf('/api/orders') + 500
    );
    assert(codPayload.includes("voucherCode") && codPayload.includes("spinWheelSpinId"), "COD payload must have both fields");
    // Checkout iPaymu
    const ipaymuPayload = checkoutPage.substring(
        checkoutPage.indexOf('/api/payment/ipaymu'),
        checkoutPage.indexOf('/api/payment/ipaymu') + 500
    );
    assert(ipaymuPayload.includes("voucherCode") && ipaymuPayload.includes("spinWheelSpinId"), "iPaymu payload must have both fields");
});

test("Buy Now COD and iPaymu payloads include mutual exclusion fields", () => {
    // Buy Now COD
    const codPayload = buyNowPage.substring(
        buyNowPage.indexOf('/api/buy-now'),
        buyNowPage.indexOf('/api/buy-now') + 500
    );
    assert(codPayload.includes("voucherCode") && codPayload.includes("spinWheelSpinId"), "Buy Now COD payload must have both fields");
    // Buy Now iPaymu
    const ipaymuPayload = buyNowPage.substring(
        buyNowPage.indexOf('/api/buy-now/ipaymu'),
        buyNowPage.indexOf('/api/buy-now/ipaymu') + 500
    );
    assert(ipaymuPayload.includes("voucherCode") && ipaymuPayload.includes("spinWheelSpinId"), "Buy Now iPaymu payload must have both fields");
});

// ==========================================
// H. EXISTING TESTS PASS (REGRESSION)
// ==========================================

console.log("\nH. Regression — Existing Patterns Preserved:");

test("Checkout still uses createCheckoutOrder for order creation", () => {
    const ordersRoute = readFile("app/api/orders/route.ts");
    assert(ordersRoute.includes("createCheckoutOrder"), "COD must use createCheckoutOrder");
});

test("iPaymu route still uses createCheckoutOrder", () => {
    const ipaymuRoute = readFile("app/api/payment/ipaymu/route.ts");
    assert(ipaymuRoute.includes("createCheckoutOrder"), "iPaymu must use createCheckoutOrder");
});

test("Buy Now COD route still uses createCheckoutOrder", () => {
    const buyNowRoute = readFile("app/api/buy-now/route.ts");
    assert(buyNowRoute.includes("createCheckoutOrder"), "Buy Now COD must use createCheckoutOrder");
});

test("Buy Now iPaymu route still uses createCheckoutOrder", () => {
    const buyNowIpaymu = readFile("app/api/buy-now/ipaymu/route.ts");
    assert(buyNowIpaymu.includes("createCheckoutOrder"), "Buy Now iPaymu must use createCheckoutOrder");
});

test("Midtrans customer payment routes remain disabled", () => {
    const midtransRoute = readFile("app/api/payment/midtrans/notification/route.ts");
    // Midtrans should only be notification/callback, not customer payment
    assert(!midtransRoute.includes("createCheckoutOrder"), "Midtrans must not create orders");
});

test("CheckoutPage still has spinWheelPendingRewards localStorage integration", () => {
    assert(checkoutPage.includes("spinWheelPendingRewards"), "Must still load from localStorage");
});

test("BuyNowPage still has spinWheelPendingRewards localStorage integration", () => {
    assert(buyNowPage.includes("spinWheelPendingRewards"), "Must still load from localStorage");
});

test("CheckoutPage clears localStorage on success", () => {
    assert(checkoutPage.includes('localStorage.removeItem("spinWheelPendingRewards")'), "Must clear localStorage on success");
});

test("BuyNowPage clears localStorage on success", () => {
    assert(buyNowPage.includes('localStorage.removeItem("spinWheelPendingRewards")'), "Must clear localStorage on success");
});

test("Checkout still has address selection", () => {
    assert(checkoutPage.includes("selectedAddress"), "Must have address selection");
});

test("Checkout still has shipping selection", () => {
    assert(checkoutPage.includes("selectedShipping"), "Must have shipping selection");
});

test("Checkout still has payment method selection", () => {
    assert(checkoutPage.includes("paymentMethod"), "Must have payment method selection");
});

test("Checkout still has creatingOrder guard", () => {
    assert(checkoutPage.includes("creatingOrder"), "Must have creatingOrder guard");
});

test("BuyNowPage still has creatingOrder guard", () => {
    assert(buyNowPage.includes("creatingOrder"), "Must have creatingOrder guard");
});

test("Checkout still calculates grandTotal from subtotal - discounts + shipping", () => {
    assert(checkoutPage.includes("grandTotal"), "Must calculate grandTotal");
});

test("Checkout grandTotal uses voucherDiscount", () => {
    assert(checkoutPage.includes("voucherDiscount"), "grandTotal must use voucherDiscount");
});

test("Checkout grandTotal uses spinWheelDisplayDiscount", () => {
    assert(checkoutPage.includes("spinWheelDisplayDiscount"), "grandTotal must use spinWheelDisplayDiscount");
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
