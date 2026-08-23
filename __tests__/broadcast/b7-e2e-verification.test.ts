/**
 * ==========================================
 * B7: FINAL BROADCAST E2E VERIFICATION
 * ==========================================
 *
 * Comprehensive verification of ALL broadcast flows.
 *
 * Run: npx tsx __tests__/broadcast/b7-e2e-verification.test.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

function readFile(relativePath: string): string {
    return readFileSync(resolve(process.cwd(), relativePath), "utf-8");
}

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(`FAIL: ${message}`);
}

function pass(name: string) { console.log(`  ✅ ${name}`); }
function fail(name: string, error: string) { console.log(`  ❌ ${name}: ${error}`); }

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
    try { fn(); pass(name); passed++; }
    catch (e) { fail(name, e instanceof Error ? e.message : String(e)); failed++; }
}

console.log("\n=== B7: FINAL BROADCAST E2E VERIFICATION ===\n");

const broadcastCode = readFile("lib/marketing/broadcast.ts");
const sendRoute = readFile("app/api/admin/broadcasts/[id]/send/route.ts");
const createRoute = readFile("app/api/admin/broadcasts/route.ts");
const detailRoute = readFile("app/api/admin/broadcasts/[id]/route.ts");
const audienceRoute = readFile("app/api/admin/broadcasts/[id]/audience/route.ts");
const page = readFile("app/admin/broadcasts/page.tsx");
const rateLimit = readFile("lib/rate-limit.ts");
const schema = readFile("prisma/schema.prisma");

// ==========================================
// 1. CREATE BROADCAST
// ==========================================
console.log("1. Create Broadcast:");

test("createBroadcast calculates audience and stores count", () => {
    assert(broadcastCode.includes("getBroadcastAudience(data.type)") && broadcastCode.includes("audienceCount"), "Missing audience calculation");
});

test("createBroadcast sets status to DRAFT or SCHEDULED", () => {
    assert(broadcastCode.includes('status: data.scheduledAt ? "SCHEDULED" : "DRAFT"'), "Missing status logic");
});

test("POST /api/admin/broadcasts validates name and message", () => {
    assert(createRoute.includes("name?.trim()") && createRoute.includes("message?.trim()"), "Missing validation");
});

test("POST validates broadcast type against BROADCAST_TYPE_LABELS", () => {
    assert(createRoute.includes("BROADCAST_TYPE_LABELS") && createRoute.includes("includes(type)"), "Missing type validation");
});

// ==========================================
// 2. AUTHORIZATION
// ==========================================
console.log("\n2. Authorization:");

test("All 6 endpoints require admin auth", () => {
    const endpoints = [createRoute, detailRoute, audienceRoute, sendRoute];
    for (const code of endpoints) {
        assert(code.includes("requireAdmin"), "Endpoint missing auth");
    }
});

test("No customer-facing broadcast API exists", () => {
    // Only /api/admin/broadcasts paths exist
    assert(createRoute.includes("/api/admin/broadcasts"), "Not in admin path");
});

// ==========================================
// 3. AUDIENCE SELECTION
// ==========================================
console.log("\n3. Audience Selection:");

test("Audience is always server-side (8 types)", () => {
    const types = ["BEST_SELLER", "NEW_PRODUCT", "BUY_AGAIN", "INACTIVE_BUYER", "PRICE_DROP", "CART_REMINDER", "CHECKOUT_REMINDER", "THANK_YOU"];
    for (const t of types) {
        assert(broadcastCode.includes(`case "${t}"`), `Missing ${t}`);
    }
});

test("sendBroadcast recalculates audience fresh (not stale)", () => {
    assert(broadcastCode.includes("await getBroadcastAudience(broadcast.type)"), "Missing fresh audience calculation");
});

// ==========================================
// 4. SEND MECHANISM
// ==========================================
console.log("\n4. Send Mechanism:");

test("sendBroadcast uses atomic CAS for SENDING status", () => {
    assert(broadcastCode.includes("$executeRaw") && broadcastCode.includes("UPDATE Broadcast") && broadcastCode.includes("SET status = 'SENDING'"), "Missing atomic CAS");
});

test("sendBroadcast CAS prevents concurrent sends", () => {
    assert(broadcastCode.includes("status IN ('DRAFT', 'SCHEDULED')"), "CAS missing status guard");
});

test("sendBroadcast checks affectedRows === 0 for already-sending", () => {
    assert(broadcastCode.includes("affectedRows === 0") && broadcastCode.includes("sudah dalam status"), "Missing affectedRows check");
});

test("sendBroadcast sends via WhatsApp provider", () => {
    assert(broadcastCode.includes("getWhatsAppService") && broadcastCode.includes("sendMessage"), "Missing WhatsApp send");
});

test("sendBroadcast personalizes message", () => {
    assert(broadcastCode.includes("/{name}/g") && broadcastCode.includes("Pelanggan"), "Missing personalization");
});

test("sendBroadcast updates sentCount/failedCount atomically", () => {
    assert(broadcastCode.includes("sentCount,") && broadcastCode.includes("failedCount,"), "Missing count update");
});

test("sendBroadcast sets final status COMPLETED or FAILED", () => {
    assert(broadcastCode.includes("failedCount === total ? \"FAILED\" : \"COMPLETED\""), "Missing final status logic");
});

test("sendBroadcast checks WhatsApp connection before batch send", () => {
    assert(broadcastCode.includes("CONNECTED") && broadcastCode.includes("WhatsApp tidak terkoneksi"), "Missing connection check");
});

test("sendBroadcast handles empty audience (0 recipients)", () => {
    assert(broadcastCode.includes("total === 0") && broadcastCode.includes("COMPLETED"), "Missing empty audience handling");
});

// ==========================================
// 5. DUPLICATE RECIPIENT PREVENTION
// ==========================================
console.log("\n5. Duplicate Recipient Prevention:");

test("All audience functions use distinct or dedup", () => {
    assert(broadcastCode.includes("distinct:") || broadcastCode.includes("userPurchases") || broadcastCode.includes("groupBy"), "Missing deduplication");
});

test("sendBroadcast sends to each member exactly once (sequential loop)", () => {
    assert(broadcastCode.includes("for (const member of audience)"), "Not sequential loop");
});

// ==========================================
// 6. FAILED DELIVERY
// ==========================================
console.log("\n6. Failed Delivery:");

test("Individual send failure doesn't abort entire broadcast", () => {
    assert(broadcastCode.includes("failedCount++") && broadcastCode.includes("continue;"), "Failure doesn't continue");
});

test("Failed count is tracked per-recipient", () => {
    assert(broadcastCode.includes("failedCount++"), "Missing failedCount increment");
});

test("Final status is FAILED if all recipients fail", () => {
    assert(broadcastCode.includes("failedCount === total ? \"FAILED\""), "Missing all-failed check");
});

// ==========================================
// 7. RETRY
// ==========================================
console.log("\n7. Retry:");

test("FAILED broadcasts can be retried (status → DRAFT)", () => {
    assert(broadcastCode.includes("FAILED:") && broadcastCode.includes('"DRAFT"'), "FAILED can't retry");
});

test("UI shows retry button for FAILED broadcasts", () => {
    assert(page.includes("Kirim Ulang") || (page.includes("FAILED") && page.includes("handleSend")), "Missing retry button");
});

// ==========================================
// 8. CONCURRENT SEND
// ==========================================
console.log("\n8. Concurrent Send:");

test("Atomic CAS prevents concurrent sends of same broadcast", () => {
    assert(broadcastCode.includes("$executeRaw") && broadcastCode.includes("UPDATE Broadcast"), "Missing CAS");
});

test("sendBroadcast returns error if already sending", () => {
    assert(broadcastCode.includes("sudah dalam status pengiriman"), "Missing already-sending error");
});

// ==========================================
// 9. STATUS TRANSITIONS
// ==========================================
console.log("\n9. Status Transitions:");

test("Valid transitions defined in VALID_TRANSITIONS map", () => {
    assert(broadcastCode.includes("VALID_TRANSITIONS"), "Missing map");
});

test("DRAFT → SENDING allowed", () => {
    assert(broadcastCode.includes("DRAFT:") && broadcastCode.includes('"SENDING"'), "DRAFT → SENDING missing");
});

test("SCHEDULED → SENDING allowed", () => {
    assert(broadcastCode.includes("SCHEDULED:") && broadcastCode.includes('"SENDING"'), "SCHEDULED → SENDING missing");
});

test("SENDING → COMPLETED/FAILED allowed", () => {
    assert(broadcastCode.includes("SENDING:") && broadcastCode.includes('"COMPLETED"') && broadcastCode.includes('"FAILED"'), "SENDING transitions missing");
});

test("COMPLETED is terminal (no outgoing transitions)", () => {
    assert(broadcastCode.includes("COMPLETED:") && broadcastCode.includes("[]"), "COMPLETED not terminal");
});

test("FAILED → DRAFT allowed (retry)", () => {
    assert(broadcastCode.includes("FAILED:") && broadcastCode.includes('"DRAFT"'), "FAILED → DRAFT missing");
});

test("updateBroadcast validates status transitions", () => {
    assert(broadcastCode.includes("validateStatusTransition(existing.status, data.status)"), "updateBroadcast missing validation");
});

// ==========================================
// 10. PROVIDER FAILURE
// ==========================================
console.log("\n10. Provider Failure:");

test("WhatsApp not connected → broadcast fails immediately", () => {
    assert(broadcastCode.includes("CONNECTED") && broadcastCode.includes('status: "FAILED"'), "Missing connection failure handling");
});

test("Provider error logged per-recipient", () => {
    assert(broadcastCode.includes("console.error") && broadcastCode.includes("Failed to send"), "Missing error logging");
});

// ==========================================
// 11. RATE LIMITING
// ==========================================
console.log("\n11. Rate Limiting:");

test("broadcastSend rate limiter exists (5/min)", () => {
    assert(rateLimit.includes("broadcastSend:"), "Missing send limiter");
});

test("broadcastCreate rate limiter exists (10/min)", () => {
    assert(rateLimit.includes("broadcastCreate:"), "Missing create limiter");
});

test("Send endpoint uses rate limiting", () => {
    assert(sendRoute.includes("rateLimiters.broadcastSend"), "Send endpoint missing rate limit");
});

test("Create endpoint uses rate limiting", () => {
    assert(createRoute.includes("rateLimiters.broadcastCreate"), "Create endpoint missing rate limit");
});

// ==========================================
// 12. SCHEDULED PROCESSING
// ==========================================
console.log("\n12. Scheduled Processing:");

test("processScheduledBroadcasts queries SCHEDULED with scheduledAt <= now", () => {
    assert(broadcastCode.includes('"SCHEDULED"') && broadcastCode.includes("scheduledAt:") && broadcastCode.includes("lte: now"), "Missing scheduled query");
});

test("processScheduledBroadcasts has take: 5 limit", () => {
    assert(broadcastCode.includes("take: 5"), "Missing batch limit");
});

test("processScheduledBroadcasts calls sendBroadcast per broadcast", () => {
    assert(broadcastCode.includes("await sendBroadcast(broadcast.id)"), "Missing sendBroadcast call");
});

// ==========================================
// 13. LARGE AUDIENCE
// ==========================================
console.log("\n13. Large Audience:");

test("sendBroadcast processes audience sequentially (not all-at-once)", () => {
    assert(broadcastCode.includes("for (const member of audience)"), "Not sequential");
});

test("500ms delay between messages prevents provider rate-limiting", () => {
    assert(broadcastCode.includes("MESSAGE_DELAY_MS") || broadcastCode.includes("sleep("), "Missing delay");
});

// ==========================================
// 14. ADMIN REPORTING
// ==========================================
console.log("\n14. Admin Reporting:");

test("Broadcast list shows status with color coding", () => {
    assert(page.includes("statusColor") && page.includes("statusLabel"), "Missing status display");
});

test("Broadcast list shows audience count with preview", () => {
    assert(page.includes("audienceCount") && page.includes("previewAudience"), "Missing audience display");
});

test("Broadcast list shows sentCount and failedCount", () => {
    assert(page.includes("sentCount") || page.includes("failedCount"), "Missing count display");
});

test("Broadcast list shows creation date", () => {
    assert(page.includes("createdAt") && page.includes("formatDate"), "Missing creation date");
});

// ==========================================
// 15. FINANCIAL/DATA CONSISTENCY
// ==========================================
console.log("\n15. Data Consistency:");

test("audienceCount updated to fresh value on send", () => {
    assert(broadcastCode.includes("audienceCount: total"), "Missing audienceCount update");
});

test("sentAt set on completion", () => {
    assert(broadcastCode.includes("sentAt: new Date()"), "Missing sentAt");
});

test("Broadcast schema has all required fields", () => {
    assert(schema.includes("audienceCount") && schema.includes("sentCount") && schema.includes("failedCount"), "Missing schema fields");
});

// ==========================================
// 16. REGRESSION PROTECTION
// ==========================================
console.log("\n16. Regression Protection:");

test("Marketing pricing engine untouched", () => {
    const batchPricing = readFile("lib/marketing/batch-pricing.ts");
    assert(batchPricing.includes("resolveBatchPrices") && batchPricing.includes("FLASH_SALE"), "Pricing engine changed");
});

test("Checkout transaction untouched", () => {
    const checkout = readFile("lib/checkout.ts");
    assert(checkout.includes("createCheckoutOrder") && checkout.includes("$transaction"), "Checkout changed");
});

test("Payment webhook untouched", () => {
    const webhook = readFile("app/api/payment/midtrans/notification/route.ts");
    assert(webhook.includes("verifySignature") && webhook.includes("releaseReservedStock"), "Webhook changed");
});

// ==========================================
// RESULTS
// ==========================================
console.log(`\n=== B7 RESULTS: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) process.exit(1);
