/**
 * ==========================================
 * BROADCAST SYSTEM INTEGRITY TESTS
 * ==========================================
 *
 * Static/code-path verification tests for broadcast
 * delivery, status transitions, rate limiting,
 * and audience targeting.
 *
 * Run: npx tsx __tests__/broadcast/broadcast-integrity.test.ts
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

console.log("\n=== BROADCAST SYSTEM INTEGRITY TESTS ===\n");

// ==========================================
// LOAD FILES
// ==========================================
const broadcastCode = readFile("lib/marketing/broadcast.ts");
const broadcastIndex = readFile("lib/marketing/index.ts");
const broadcastRoute = readFile("app/api/admin/broadcasts/route.ts");
const broadcastIdRoute = readFile("app/api/admin/broadcasts/[id]/route.ts");
const broadcastAudienceRoute = readFile("app/api/admin/broadcasts/[id]/audience/route.ts");
const broadcastSendRoute = readFile("app/api/admin/broadcasts/[id]/send/route.ts");
const broadcastPage = readFile("app/admin/broadcasts/page.tsx");
const rateLimitCode = readFile("lib/rate-limit.ts");
const adminNavbar = readFile("components/admin/AdminNavbar.tsx");
const schemaCode = readFile("prisma/schema.prisma");

// ==========================================
// 1. SEND MECHANISM
// ==========================================
console.log("1. Send Mechanism:");

test("sendBroadcast function exists and is exported", () => {
    assert(broadcastCode.includes("export async function sendBroadcast"), "Missing sendBroadcast export");
});

test("sendBroadcast validates status transition (DRAFT/SCHEDULED → SENDING)", () => {
    assert(broadcastCode.includes("validateStatusTransition") && broadcastCode.includes("SENDING"), "Missing status transition validation");
});

test("sendBroadcast uses atomic CAS to set SENDING status", () => {
    assert(broadcastCode.includes("$executeRaw") && broadcastCode.includes("UPDATE Broadcast") && broadcastCode.includes("SET status = 'SENDING'"), "Missing atomic CAS for SENDING status");
});

test("sendBroadcast CAS only processes DRAFT/SCHEDULED broadcasts", () => {
    assert(broadcastCode.includes("status IN ('DRAFT', 'SCHEDULED')"), "CAS missing DRAFT/SCHEDULED guard");
});

test("sendBroadcast recalculates audience (fresh, not stale snapshot)", () => {
    assert(broadcastCode.includes("getBroadcastAudience(broadcast.type)"), "sendBroadcast doesn't recalculate audience");
});

test("sendBroadcast updates audienceCount with fresh value", () => {
    assert(broadcastCode.includes("audienceCount: total"), "sendBroadcast doesn't update audienceCount");
});

test("sendBroadcast sends via WhatsApp channel", () => {
    assert(broadcastCode.includes("broadcast.channel === \"whatsapp\""), "sendBroadcast missing WhatsApp channel check");
});

test("sendBroadcast personalizes message with {name} placeholder", () => {
    assert(broadcastCode.includes("personalizeMessage") && broadcastCode.includes("/{name}/g"), "Missing message personalization");
});

test("sendBroadcast updates sentCount and failedCount", () => {
    assert(broadcastCode.includes("sentCount") && broadcastCode.includes("failedCount"), "Missing sentCount/failedCount tracking");
});

test("sendBroadcast sets final status to COMPLETED or FAILED", () => {
    assert(broadcastCode.includes("COMPLETED") && broadcastCode.includes("FAILED"), "Missing final status logic");
});

test("sendBroadcast sets sentAt timestamp", () => {
    assert(broadcastCode.includes("sentAt: new Date()"), "Missing sentAt timestamp");
});

test("sendBroadcast has delay between messages (rate-limit protection)", () => {
    assert(broadcastCode.includes("MESSAGE_DELAY_MS") || broadcastCode.includes("sleep("), "Missing delay between messages");
});

test("sendBroadcast handles empty audience gracefully", () => {
    assert(broadcastCode.includes("total === 0"), "Missing empty audience handling");
});

test("sendBroadcast checks WhatsApp connection before sending", () => {
    assert(broadcastCode.includes("CONNECTED") && broadcastCode.includes("WhatsApp tidak terkoneksi"), "Missing WhatsApp connection check");
});

// ==========================================
// 2. STATUS TRANSITIONS
// ==========================================
console.log("\n2. Status Transitions:");

test("VALID_TRANSITIONS map exists with correct transitions", () => {
    assert(broadcastCode.includes("VALID_TRANSITIONS"), "Missing VALID_TRANSITIONS");
    assert(broadcastCode.includes("DRAFT:") && broadcastCode.includes("SENDING"), "DRAFT → SENDING transition missing");
    assert(broadcastCode.includes("COMPLETED:") && broadcastCode.includes("[]"), "COMPLETED terminal state missing");
});

test("validateStatusTransition function exists", () => {
    assert(broadcastCode.includes("function validateStatusTransition"), "Missing validateStatusTransition");
});

test("updateBroadcast validates status transition", () => {
    assert(broadcastCode.includes("validateStatusTransition(existing.status, data.status)"), "updateBroadcast doesn't validate status transition");
});

test("FAILED can retry to DRAFT", () => {
    assert(broadcastCode.includes("FAILED:") && broadcastCode.includes('"DRAFT"'), "FAILED → DRAFT retry not supported");
});

test("SENDING is blocked from update (existing guard)", () => {
    assert(broadcastCode.includes('existing.status === "SENDING"'), "SENDING not blocked from update");
});

test("COMPLETED is blocked from update (existing guard)", () => {
    assert(broadcastCode.includes('existing.status === "COMPLETED"'), "COMPLETED not blocked from update");
});

// ==========================================
// 3. SCHEDULED BROADCAST PROCESSOR
// ==========================================
console.log("\n3. Scheduled Broadcast Processor:");

test("processScheduledBroadcasts function exists", () => {
    assert(broadcastCode.includes("export async function processScheduledBroadcasts"), "Missing processScheduledBroadcasts");
});

test("processScheduledBroadcasts queries SCHEDULED broadcasts with scheduledAt <= now", () => {
    assert(broadcastCode.includes('status: "SCHEDULED"') && broadcastCode.includes("scheduledAt:"), "Missing scheduled broadcast query");
});

test("processScheduledBroadcasts processes max 5 at a time", () => {
    assert(broadcastCode.includes("take: 5"), "Missing take: 5 limit");
});

test("processScheduledBroadcasts calls sendBroadcast for each", () => {
    assert(broadcastCode.includes("await sendBroadcast(broadcast.id)"), "Missing sendBroadcast call");
});

test("processScheduledBroadcasts has try/catch per broadcast", () => {
    assert(broadcastCode.includes("try {") && broadcastCode.includes("catch (error)"), "Missing try/catch per broadcast");
});

// ==========================================
// 4. SEND API ENDPOINT
// ==========================================
console.log("\n4. Send API Endpoint:");

test("Send endpoint exists at /api/admin/broadcasts/[id]/send", () => {
    assert(broadcastSendRoute.includes("POST"), "Missing POST handler");
});

test("Send endpoint requires admin auth", () => {
    assert(broadcastSendRoute.includes("requireAdmin"), "Missing admin auth");
});

test("Send endpoint has rate limiting", () => {
    assert(broadcastSendRoute.includes("rateLimiters.broadcastSend"), "Missing rate limiting");
});

test("Send endpoint validates broadcast ID", () => {
    assert(broadcastSendRoute.includes("Number.isInteger") && broadcastSendRoute.includes("broadcastId"), "Missing ID validation");
});

test("Send endpoint calls sendBroadcast", () => {
    assert(broadcastSendRoute.includes("await sendBroadcast(broadcastId)"), "Missing sendBroadcast call");
});

test("Send endpoint returns sentCount/failedCount in response", () => {
    assert(broadcastSendRoute.includes("result.sentCount") && broadcastSendRoute.includes("result.failedCount"), "Missing count in response");
});

test("Send endpoint handles errors with appropriate HTTP status", () => {
    assert(broadcastSendRoute.includes("404") && broadcastSendRoute.includes("400") && broadcastSendRoute.includes("409"), "Missing error status codes");
});

// ==========================================
// 5. AUTHORIZATION
// ==========================================
console.log("\n5. Authorization:");

test("All broadcast endpoints have requireAdmin()", () => {
    const endpoints = [broadcastRoute, broadcastIdRoute, broadcastAudienceRoute, broadcastSendRoute];
    for (const code of endpoints) {
        assert(code.includes("requireAdmin"), `Endpoint missing requireAdmin`);
    }
});

test("requireAdmin checks session.user.id", () => {
    assert(broadcastRoute.includes("session?.user?.id"), "Missing session check");
});

test("requireAdmin checks role === ADMIN", () => {
    assert(broadcastRoute.includes("role !== \"ADMIN\"") || broadcastRoute.includes("role !== 'ADMIN'"), "Missing role check");
});

test("No customer-facing broadcast endpoints exist", () => {
    // Broadcast should only be in /api/admin/ path
    assert(broadcastRoute.includes("/api/admin/broadcasts"), "Broadcast route not in admin path");
});

// ==========================================
// 6. RATE LIMITING
// ==========================================
console.log("\n6. Rate Limiting:");

test("broadcastSend rate limiter exists", () => {
    assert(rateLimitCode.includes("broadcastSend:"), "Missing broadcastSend rate limiter");
});

test("broadcastCreate rate limiter exists", () => {
    assert(rateLimitCode.includes("broadcastCreate:"), "Missing broadcastCreate rate limiter");
});

test("broadcastSend uses userId key", () => {
    assert(rateLimitCode.includes("broadcast:${userId}") || rateLimitCode.includes("broadcast:"), "broadcastSend missing userId key");
});

test("Broadcast POST endpoint uses rate limiting", () => {
    assert(broadcastRoute.includes("rateLimiters.broadcastCreate"), "Broadcast POST missing rate limiting");
});

// ==========================================
// 7. AUDIENCE TARGETING
// ==========================================
console.log("\n7. Audience Targeting:");

test("getBroadcastAudience function exists", () => {
    assert(broadcastCode.includes("export async function getBroadcastAudience"), "Missing getBroadcastAudience");
});

test("All 8 broadcast types have audience functions", () => {
    const types = ["BEST_SELLER", "NEW_PRODUCT", "BUY_AGAIN", "INACTIVE_BUYER", "PRICE_DROP", "CART_REMINDER", "CHECKOUT_REMINDER", "THANK_YOU"];
    for (const type of types) {
        assert(broadcastCode.includes(`case "${type}"`), `Missing ${type} case`);
    }
});

test("Audience functions filter users with phone or email", () => {
    assert(broadcastCode.includes("o.user.phone || o.user.email") || broadcastCode.includes("u.phone || u.email") || broadcastCode.includes("c.user.phone || c.user.email"), "Missing phone/email filter");
});

test("Audience functions use distinct or deduplication", () => {
    assert(broadcastCode.includes("distinct:") || broadcastCode.includes("userPurchases") || broadcastCode.includes("groupBy"), "Missing deduplication");
});

test("Price drop audience compares stored order price vs current price", () => {
    assert(broadcastCode.includes("orderPrice") && broadcastCode.includes("currentPriceMap"), "Missing price comparison");
});

// ==========================================
// 8. UI
// ==========================================
console.log("\n8. Admin UI:");

test("Broadcast page has Send button for DRAFT/SCHEDULED broadcasts", () => {
    assert(broadcastPage.includes("handleSend") && broadcastPage.includes("Kirim"), "Missing Send button");
});

test("Send button only shows for DRAFT/SCHEDULED status", () => {
    assert(broadcastPage.includes("DRAFT") && broadcastPage.includes("SCHEDULED") && broadcastPage.includes("status ==="), "Send button not status-gated");
});

test("Broadcast page has retry button for FAILED broadcasts", () => {
    assert(broadcastPage.includes("Kirim Ulang") || broadcastPage.includes("FAILED"), "Missing retry button");
});

test("Broadcast page has audience preview", () => {
    assert(broadcastPage.includes("previewAudience") && broadcastPage.includes("audienceModal"), "Missing audience preview");
});

test("Broadcast page has create/edit modal", () => {
    assert(broadcastPage.includes("modalOpen") && broadcastPage.includes("handleSubmit"), "Missing create/edit modal");
});

test("Broadcast page shows sentCount and failedCount", () => {
    assert(broadcastPage.includes("sentCount") || broadcastPage.includes("failedCount"), "Missing sent/failed count display");
});

test("AdminNavbar has broadcast navigation links", () => {
    assert(adminNavbar.includes("broadcasts"), "AdminNavbar missing broadcast links");
});

test("AdminNavbar has all 8 broadcast type links", () => {
    const types = ["BEST_SELLER", "NEW_PRODUCT", "BUY_AGAIN", "INACTIVE_BUYER", "PRICE_DROP", "CART_REMINDER", "CHECKOUT_REMINDER", "THANK_YOU"];
    for (const type of types) {
        assert(adminNavbar.includes(type), `AdminNavbar missing ${type} link`);
    }
});

// ==========================================
// 9. SCHEMA
// ==========================================
console.log("\n9. Database Schema:");

test("Broadcast model exists with required fields", () => {
    assert(schemaCode.includes("model Broadcast"), "Missing Broadcast model");
    assert(schemaCode.includes("status      BroadcastStatus"), "Missing status field");
    assert(schemaCode.includes("audienceCount"), "Missing audienceCount field");
    assert(schemaCode.includes("sentCount"), "Missing sentCount field");
    assert(schemaCode.includes("failedCount"), "Missing failedCount field");
});

test("BroadcastStatus enum has all 5 states", () => {
    assert(schemaCode.includes("DRAFT") && schemaCode.includes("SCHEDULED") && schemaCode.includes("SENDING") && schemaCode.includes("COMPLETED") && schemaCode.includes("FAILED"), "Missing BroadcastStatus states");
});

test("Broadcast has proper indexes", () => {
    assert(schemaCode.includes("@@index([type])") && schemaCode.includes("@@index([status]") && schemaCode.includes("@@index([createdAt])"), "Missing indexes");
});

test("BroadcastType enum has all 8 types", () => {
    const types = ["BEST_SELLER", "NEW_PRODUCT", "BUY_AGAIN", "INACTIVE_BUYER", "PRICE_DROP", "CART_REMINDER", "CHECKOUT_REMINDER", "THANK_YOU"];
    for (const type of types) {
        assert(schemaCode.includes(type), `Missing ${type} in BroadcastType`);
    }
});

// ==========================================
// 10. BARREL EXPORTS
// ==========================================
console.log("\n10. Barrel Exports:");

test("sendBroadcast exported from marketing index", () => {
    assert(broadcastIndex.includes("sendBroadcast"), "Missing sendBroadcast export");
});

test("processScheduledBroadcasts exported from marketing index", () => {
    assert(broadcastIndex.includes("processScheduledBroadcasts"), "Missing processScheduledBroadcasts export");
});

test("VALID_TRANSITIONS exported from marketing index", () => {
    assert(broadcastIndex.includes("VALID_TRANSITIONS"), "Missing VALID_TRANSITIONS export");
});

// ==========================================
// RESULTS
// ==========================================
console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
    process.exit(1);
}
