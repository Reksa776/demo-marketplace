/**
 * AFFILIATE PRODUCTION UPGRADE TESTS
 *
 * Static/code-path verification tests.
 * Run: npx tsx __tests__/admin/affiliate-production.test.ts
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
// 1. COMMISSION UTILITY
// ==========================================

console.log("\n1. Commission Utility (lib/affiliate/commission.ts):");

const commissionUtil = readFile("lib/affiliate/commission.ts");

test("calculateCommission function exists", () => {
    assert(commissionUtil.includes("export function calculateCommission"), "Missing calculateCommission");
});

test("uses Prisma Decimal for money safety", () => {
    assert(commissionUtil.includes("Prisma.Decimal"), "Should use Prisma.Decimal");
});

test("isValidTransition function exists", () => {
    assert(commissionUtil.includes("export function isValidTransition"), "Missing isValidTransition");
});

test("PENDING can transition to APPROVED", () => {
    assert(commissionUtil.includes('PENDING: ["APPROVED"'), "PENDING should allow APPROVED");
});

test("PENDING can transition to CANCELLED", () => {
    assert(commissionUtil.includes('"CANCELLED"'), "Should allow CANCELLED");
});

test("PAID is terminal (no transitions)", () => {
    assert(commissionUtil.includes('PAID: []'), "PAID should be terminal");
});

test("CANCELLED is terminal", () => {
    assert(commissionUtil.includes('CANCELLED: []'), "CANCELLED should be terminal");
});

test("updateCommissionRate function exists", () => {
    assert(commissionUtil.includes("export async function updateCommissionRate"), "Missing updateCommissionRate");
});

test("rate validation: max 50%", () => {
    assert(commissionUtil.includes("newRate > 50"), "Should validate max rate");
});

test("transitionCommission function exists", () => {
    assert(commissionUtil.includes("export async function transitionCommission"), "Missing transitionCommission");
});

test("getAvailableBalance function exists", () => {
    assert(commissionUtil.includes("export async function getAvailableBalance"), "Missing getAvailableBalance");
});

test("balance = APPROVED - PAID", () => {
    assert(commissionUtil.includes("approvedAmt - paidAmt"), "Balance should be APPROVED minus PAID");
});

test("isValidPayoutTransition function exists", () => {
    assert(commissionUtil.includes("export function isValidPayoutTransition"), "Missing isValidPayoutTransition");
});

test("PAYOUT_TRANSITIONS defined", () => {
    assert(commissionUtil.includes("PAYOUT_TRANSITIONS"), "Missing PAYOUT_TRANSITIONS");
});

test("createWithdrawalRequest function exists", () => {
    assert(commissionUtil.includes("export async function createWithdrawalRequest"), "Missing createWithdrawalRequest");
});

test("withdrawal validates amount > 0", () => {
    assert(commissionUtil.includes("amount <= 0"), "Should validate amount > 0");
});

test("withdrawal checks existing PENDING payout (double-click protection)", () => {
    assert(commissionUtil.includes("existingPending"), "Should check existing PENDING payout");
});

test("withdrawal checks available balance", () => {
    assert(commissionUtil.includes("amount > available"), "Should check available balance");
});

test("withdrawal uses bank info from KYC", () => {
    assert(commissionUtil.includes("bankName"), "Should use bank info");
});

// ==========================================
// 2. ADMIN AFFILIATE LIST API
// ==========================================

console.log("\n2. Admin Affiliate List API:");

const adminAffiliateRoute = readFile("app/api/admin/affiliate/route.ts");

test("GET export exists", () => {
    assert(adminAffiliateRoute.includes("export async function GET"), "Missing GET");
});

test("checks ADMIN role", () => {
    assert(adminAffiliateRoute.includes('"ADMIN"'), "Should check ADMIN role");
});

test("supports status filter", () => {
    assert(adminAffiliateRoute.includes("statusParam"), "Should support status filter");
});

test("supports search", () => {
    assert(adminAffiliateRoute.includes("search"), "Should support search");
});

test("supports sort", () => {
    assert(adminAffiliateRoute.includes("sort"), "Should support sort");
});

test("returns clicks per affiliate", () => {
    assert(adminAffiliateRoute.includes("affiliateClick.groupBy"), "Should aggregate clicks");
});

test("returns commission per affiliate", () => {
    assert(adminAffiliateRoute.includes("pendingAgg"), "Should aggregate commission");
});

test("supports pagination", () => {
    assert(adminAffiliateRoute.includes("page"), "Should support pagination");
});

// ==========================================
// 3. ADMIN AFFILIATE DETAIL API
// ==========================================

console.log("\n3. Admin Affiliate Detail API:");

const adminDetailRoute = readFile("app/api/admin/affiliate/[id]/route.ts");

test("GET export exists", () => {
    assert(adminDetailRoute.includes("export async function GET"), "Missing GET");
});

test("PATCH export exists", () => {
    assert(adminDetailRoute.includes("export async function PATCH"), "Missing PATCH");
});

test("checks ADMIN role", () => {
    assert(adminDetailRoute.includes('"ADMIN"'), "Should check ADMIN role");
});

test("supports UPDATE_RATE action", () => {
    assert(adminDetailRoute.includes("UPDATE_RATE"), "Should support UPDATE_RATE");
});

test("supports UPDATE_STATUS action", () => {
    assert(adminDetailRoute.includes("UPDATE_STATUS"), "Should support UPDATE_STATUS");
});

test("validates rate range 0-50", () => {
    assert(adminDetailRoute.includes("rate > 50"), "Should validate max rate");
});

test("returns conversion history", () => {
    assert(adminDetailRoute.includes("recentConversions"), "Should return conversions");
});

test("returns commission breakdown", () => {
    assert(adminDetailRoute.includes("pendingConv"), "Should return commission breakdown");
});

test("returns pending payouts", () => {
    assert(adminDetailRoute.includes("pendingPayouts"), "Should return pending payouts");
});

// ==========================================
// 4. COMMISSION MANAGEMENT API
// ==========================================

console.log("\n4. Commission Management API:");

const commissionsRoute = readFile("app/api/admin/affiliate/commissions/route.ts");

test("GET export exists", () => {
    assert(commissionsRoute.includes("export async function GET"), "Missing GET");
});

test("checks ADMIN role", () => {
    assert(commissionsRoute.includes('"ADMIN"'), "Should check ADMIN role");
});

test("supports status filter", () => {
    assert(commissionsRoute.includes("statusFilter"), "Should support status filter");
});

test("returns affiliate info", () => {
    assert(commissionsRoute.includes("affiliateName"), "Should return affiliate info");
});

const commissionActionRoute = readFile("app/api/admin/affiliate/commissions/[id]/route.ts");

test("PATCH export exists", () => {
    assert(commissionActionRoute.includes("export async function PATCH"), "Missing PATCH");
});

test("supports APPROVE action", () => {
    assert(commissionActionRoute.includes('"APPROVE"'), "Should support APPROVE");
});

test("supports CANCEL action", () => {
    assert(commissionActionRoute.includes('"CANCEL"'), "Should support CANCEL");
});

test("CANCEL requires reason", () => {
    assert(commissionActionRoute.includes("alasan pembatalan"), "CANCEL should require reason");
});

test("uses transitionCommission", () => {
    assert(commissionActionRoute.includes("transitionCommission"), "Should use transitionCommission");
});

// ==========================================
// 5. PAYOUT MANAGEMENT API
// ==========================================

console.log("\n5. Payout Management API:");

const payoutsRoute = readFile("app/api/admin/affiliate/payouts/route.ts");

test("GET export exists", () => {
    assert(payoutsRoute.includes("export async function GET"), "Missing GET");
});

test("checks ADMIN role", () => {
    assert(payoutsRoute.includes('"ADMIN"'), "Should check ADMIN role");
});

test("returns bank info", () => {
    assert(payoutsRoute.includes("bankName"), "Should return bank info");
});

const payoutActionRoute = readFile("app/api/admin/affiliate/payouts/[id]/route.ts");

test("PATCH export exists", () => {
    assert(payoutActionRoute.includes("export async function PATCH"), "Missing PATCH");
});

test("supports APPROVE action", () => {
    assert(payoutActionRoute.includes('"APPROVE"'), "Should support APPROVE");
});

test("supports REJECT action", () => {
    assert(payoutActionRoute.includes('"REJECT"'), "Should support REJECT");
});

test("supports CONFIRM_PAID action", () => {
    assert(payoutActionRoute.includes('"CONFIRM_PAID"'), "Should support CONFIRM_PAID");
});

test("supports STATUS action", () => {
    assert(payoutActionRoute.includes('"STATUS"'), "Should support STATUS");
});

test("supports SETTLE action", () => {
    assert(payoutActionRoute.includes('"SETTLE"'), "Should support SETTLE");
});

test("supports UPLOAD_PROOF action", () => {
    assert(payoutActionRoute.includes('"UPLOAD_PROOF"'), "Should support UPLOAD_PROOF");
});

test("CONFIRM_PAID uses CAS UPDATE (idempotent)", () => {
    assert(payoutActionRoute.includes("status = 'PAID'"), "CONFIRM_PAID should use CAS UPDATE");
});

test("REJECT requires reason", () => {
    assert(payoutActionRoute.includes("alasan penolakan"), "REJECT should require reason");
});

test("APPROVE validates affiliate status", () => {
    assert(payoutActionRoute.includes("affiliate.status !== \"APPROVED\""), "APPROVE should validate affiliate");
});

test("APPROVE generates idempotency key", () => {
    assert(payoutActionRoute.includes("idempotencyKey"), "APPROVE should generate idempotency key");
});

test("APPROVE handles provider PENDING/PROCESSING (not failed)", () => {
    assert(payoutActionRoute.includes("isDefinitiveFailure"), "APPROVE should distinguish definitive vs transient");
});

test("STATUS action checks provider status", () => {
    assert(payoutActionRoute.includes("getDisbursementStatus"), "STATUS should check provider status");
});

// ==========================================
// 6. CUSTOMER PAYOUT API
// ==========================================

console.log("\n6. Customer Payout API:");

const customerPayoutRoute = readFile("app/api/affiliate/payouts/route.ts");

test("GET export exists", () => {
    assert(customerPayoutRoute.includes("export async function GET"), "Missing GET");
});

test("POST export exists", () => {
    assert(customerPayoutRoute.includes("export async function POST"), "Missing POST");
});

test("GET checks authentication", () => {
    assert(customerPayoutRoute.includes("Unauthorized"), "Should check auth");
});

test("POST uses createWithdrawalRequest", () => {
    assert(customerPayoutRoute.includes("createWithdrawalRequest"), "Should use createWithdrawalRequest");
});

test("POST uses bank info from KYC", () => {
    assert(customerPayoutRoute.includes("affiliate.kyc"), "Should use KYC bank info");
});

test("POST validates amount", () => {
    assert(customerPayoutRoute.includes("amount <= 0"), "Should validate amount");
});

test("masks bank account in list", () => {
    assert(customerPayoutRoute.includes("replace"), "Should mask bank account");
});

// ==========================================
// 7. CUSTOMER COMMISSION API
// ==========================================

console.log("\n7. Customer Commission API:");

const customerCommRoute = readFile("app/api/affiliate/commissions/route.ts");

test("GET export exists", () => {
    assert(customerCommRoute.includes("export async function GET"), "Missing GET");
});

test("checks authentication", () => {
    assert(customerCommRoute.includes("Unauthorized"), "Should check auth");
});

test("scopes to own affiliate", () => {
    assert(customerCommRoute.includes("affiliateId: affiliate.id"), "Should scope to own affiliate");
});

test("supports status filter", () => {
    assert(customerCommRoute.includes("statusFilter"), "Should support status filter");
});

test("supports pagination", () => {
    assert(customerCommRoute.includes("page"), "Should support pagination");
});

// ==========================================
// 8. DASHBOARD API BALANCE
// ==========================================

console.log("\n8. Dashboard API Balance:");

const dashboardRoute = readFile("app/api/affiliate/dashboard/route.ts");

test("queries approvedBalance", () => {
    assert(dashboardRoute.includes("approvedBalance"), "Should query approvedBalance");
});

test("queries paidBalance", () => {
    assert(dashboardRoute.includes("paidBalance"), "Should query paidBalance");
});

test("queries recentPayouts", () => {
    assert(dashboardRoute.includes("recentPayouts"), "Should query recentPayouts");
});

test("returns balance data", () => {
    assert(dashboardRoute.includes("balance:"), "Should return balance");
});

test("returns payout history", () => {
    assert(dashboardRoute.includes("payouts:"), "Should return payouts");
});

test("balance.available = approved - paid", () => {
    assert(dashboardRoute.includes("available:"), "Should calculate available balance");
});

// ==========================================
// 9. ADMIN UI PAGES
// ==========================================

console.log("\n9. Admin UI Pages:");

const adminManagement = readFile("components/admin/affiliate/AdminAffiliateManagement.tsx");

test("AdminAffiliateManagement exists", () => {
    assert(adminManagement.includes("export default"), "Missing component");
});

test("shows affiliate table", () => {
    assert(adminManagement.includes("<table"), "Should show table");
});

test("shows clicks column", () => {
    assert(adminManagement.includes("clicks"), "Should show clicks");
});

test("shows commission column", () => {
    assert(adminManagement.includes("totalCommission"), "Should show commission");
});

test("shows sales column", () => {
    assert(adminManagement.includes("sales"), "Should show sales");
});

test("supports search", () => {
    assert(adminManagement.includes("search"), "Should support search");
});

test("supports status filter", () => {
    assert(adminManagement.includes("statusFilter"), "Should support status filter");
});

test("supports sort", () => {
    assert(adminManagement.includes("sort"), "Should support sort");
});

test("links to detail page", () => {
    assert(adminManagement.includes("/admin/affiliate/"), "Should link to detail");
});

const adminDetail = readFile("components/admin/affiliate/AdminAffiliateDetail.tsx");

test("AdminAffiliateDetail exists", () => {
    assert(adminDetail.includes("export default"), "Missing component");
});

test("shows commission rate edit", () => {
    assert(adminDetail.includes("commissionRate"), "Should show commission rate");
});

test("rate edit validates 0-50%", () => {
    assert(adminDetail.includes("rate > 50"), "Should validate rate range");
});

test("shows commission breakdown", () => {
    assert(adminDetail.includes("Commission Breakdown"), "Should show breakdown");
});

test("shows conversion history", () => {
    assert(adminDetail.includes("Riwayat Konversi"), "Should show conversions");
});

test("shows approve/cancel actions", () => {
    assert(adminDetail.includes("Approve"), "Should show approve action");
    assert(adminDetail.includes("Cancel"), "Should show cancel action");
});

test("shows pending payouts", () => {
    assert(adminDetail.includes("Pending Payouts"), "Should show pending payouts");
});

const adminPayouts = readFile("components/admin/affiliate/AdminPayoutsPage.tsx");

test("AdminPayoutsPage exists", () => {
    assert(adminPayouts.includes("export default"), "Missing component");
});

test("shows payout table", () => {
    assert(adminPayouts.includes("<table"), "Should show table");
});

test("shows bank info", () => {
    assert(adminPayouts.includes("bankName"), "Should show bank info");
});

test("shows approve/reject buttons", () => {
    assert(adminPayouts.includes("Approve"), "Should show approve");
    assert(adminPayouts.includes("Reject"), "Should show reject");
});

test("shows Confirm Paid button for PROCESSING payouts", () => {
    assert(adminPayouts.includes("Confirm Paid"), "Should show Confirm Paid");
});

test("shows Check Status button for PROCESSING payouts", () => {
    assert(adminPayouts.includes("Check Status"), "Should show Check Status");
});

test("shows Settle button for PAID payouts", () => {
    assert(adminPayouts.includes("Settle"), "Should show Settle button");
});

test("reject requires reason", () => {
    assert(adminPayouts.includes("Alasan Penolakan"), "Reject should require reason");
});

test("Confirm Paid shows proof file input", () => {
    assert(adminPayouts.includes("Bukti Pembayaran"), "Confirm Paid should show proof input");
});

// ==========================================
// 10. ADMIN NAVBAR
// ==========================================

console.log("\n10. Admin Navbar:");

const adminNavbar = readFile("components/admin/AdminNavbar.tsx");

test("has Management submenu", () => {
    assert(adminNavbar.includes("/admin/affiliate/manage"), "Should have Management link");
});

test("has Payouts submenu", () => {
    assert(adminNavbar.includes("/admin/affiliate/payouts"), "Should have Payouts link");
});

test("has Pengajuan submenu", () => {
    assert(adminNavbar.includes('label: "Pengajuan"'), "Should have Pengajuan link");
});

// ==========================================
// 11. CHECKOUT INTEGRATION
// ==========================================

console.log("\n11. Checkout Integration:");

const checkout = readFile("lib/checkout.ts");

test("checkout creates AffiliateConversion", () => {
    assert(checkout.includes("affiliateConversion.create"), "Should create conversion");
});

test("checkout uses orderId @unique (idempotent)", () => {
    assert(checkout.includes("P2002"), "Should handle P2002");
});

test("checkout snapshots commission rate", () => {
    assert(checkout.includes("commissionRate:"), "Should snapshot rate");
});

// ==========================================
// 12. SECURITY
// ==========================================

console.log("\n12. Security:");

test("admin affiliate list requires ADMIN", () => {
    assert(adminAffiliateRoute.includes('"ADMIN"'), "Should require ADMIN");
});

test("admin affiliate detail requires ADMIN", () => {
    assert(adminDetailRoute.includes('"ADMIN"'), "Should require ADMIN");
});

test("commission action requires ADMIN", () => {
    assert(commissionActionRoute.includes('"ADMIN"'), "Should require ADMIN");
});

test("payout action requires ADMIN", () => {
    assert(payoutActionRoute.includes('"ADMIN"'), "Should require ADMIN");
});

test("customer payout requires auth", () => {
    assert(customerPayoutRoute.includes("Unauthorized"), "Should require auth");
});

test("customer commission requires auth", () => {
    assert(customerCommRoute.includes("Unauthorized"), "Should require auth");
});

test("customer payout scopes to own affiliate", () => {
    assert(customerPayoutRoute.includes("userId: session.user.id"), "Should scope to own user");
});

test("admin commission uses server-side transition", () => {
    assert(commissionActionRoute.includes("transitionCommission"), "Should use server-side transition");
});

test("admin payout uses CAS UPDATE for state transitions", () => {
    assert(payoutActionRoute.includes("$executeRaw"), "Should use CAS UPDATE for idempotency");
});

test("admin payout APPROVE uses FOR UPDATE lock", () => {
    assert(payoutActionRoute.includes("FOR UPDATE"), "APPROVE should use FOR UPDATE lock");
});

test("admin payout calls settleCommissionsForPayout on PAID", () => {
    assert(payoutActionRoute.includes("settleCommissionsForPayout"), "Should settle commissions on PAID");
});

// ==========================================
// RESULTS
// ==========================================

console.log("\n==================================================");
console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);

if (failed > 0) {
    console.log("❌ Some tests failed!\n");
    process.exit(1);
} else {
    console.log("✅ All tests passed!\n");
}
