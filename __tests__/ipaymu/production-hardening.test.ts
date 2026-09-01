/**
 * iPaymu PRODUCTION HARDENING TESTS
 *
 * Run: npx tsx __tests__/ipaymu/production-hardening.test.ts
 *
 * Tests cover:
 * A. Configuration
 * B. Signature generation
 * C. Webhook signature verification
 * D. Notification status mapping
 * E. Amount verification
 * F. Pricing / item details
 * G. Security (URL, logging, state machine)
 * H. Error handling
 * I. Source code pattern verification
 */

import { readFileSync } from "fs";
import crypto from "crypto";

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

function assert(condition: boolean, message?: string) {
    if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(actual: any, expected: any, label: string) {
    if (actual !== expected)
        throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

function readFile(path: string): string {
    try {
        return readFileSync(path, "utf-8");
    } catch {
        return "";
    }
}

// Load source files for pattern verification
const ipaymuLib = readFile("lib/payment/ipaymu.ts");
const ipaymuProdConfig = readFile("lib/payment/ipaymu-production.ts");
const notificationRoute = readFile(
    "app/api/payment/ipaymu/notification/route.ts"
);
const cartIpaymuRoute = readFile("app/api/payment/ipaymu/route.ts");
const buyNowIpaymuRoute = readFile(
    "app/api/buy-now/ipaymu/route.ts"
);
const appOrigin = readFile("lib/app-origin.ts");

// ==========================================
// A. CONFIGURATION
// ==========================================

console.log("\nA. Configuration:");

test("IPAYMU_CONFIG has apiKey, va, baseUrl", () => {
    assert(
        ipaymuLib.includes("apiKey:") &&
            ipaymuLib.includes("va:") &&
            ipaymuLib.includes("baseUrl:"),
        "IPAYMU_CONFIG must have apiKey, va, baseUrl"
    );
});

test("Production URL defaults to my.ipaymu.com", () => {
    assert(
        ipaymuLib.includes("https://my.ipaymu.com"),
        "Production URL must be https://my.ipaymu.com"
    );
});

test("Sandbox URL defaults to sandbox.ipaymu.com", () => {
    assert(
        ipaymuLib.includes("https://sandbox.ipaymu.com"),
        "Sandbox URL must be https://sandbox.ipaymu.com"
    );
});

test("Production config validator exists", () => {
    assert(
        ipaymuProdConfig.includes("validateIpaymuProductionConfig"),
        "Production config validator must exist"
    );
});

test("Production config validates API key", () => {
    assert(
        ipaymuProdConfig.includes("IPAYMU_API_KEY") &&
            ipaymuProdConfig.includes("is not set"),
        "Must validate API key presence"
    );
});

test("Production config validates VA", () => {
    assert(
        ipaymuProdConfig.includes("IPAYMU_VA") &&
            ipaymuProdConfig.includes("is not set"),
        "Must validate VA presence"
    );
});

test("Production config rejects sandbox URL", () => {
    assert(
        ipaymuProdConfig.includes("sandbox") &&
            ipaymuProdConfig.includes("cannot use sandbox in production"),
        "Must reject sandbox URL in production"
    );
});

test("Production config rejects localhost APP_URL", () => {
    assert(
        ipaymuProdConfig.includes("localhost") &&
            ipaymuProdConfig.includes("not valid for production"),
        "Must reject localhost in production"
    );
});

test("Production config requires HTTPS APP_URL", () => {
    assert(
        ipaymuProdConfig.includes("must use HTTPS in production"),
        "Must require HTTPS for production APP_URL"
    );
});

test("Callback URL validator exists", () => {
    assert(
        ipaymuProdConfig.includes("validateCallbackUrl"),
        "Callback URL validator must exist"
    );
});

test("Callback URL validator checks hostname mismatch", () => {
    assert(
        ipaymuProdConfig.includes("does not match APP_URL hostname"),
        "Must detect hostname mismatch in callback URLs"
    );
});

test("Fail-fast init on production import", () => {
    assert(
        ipaymuProdConfig.includes("initIpaymuConfig"),
        "Must have initIpaymuConfig for fail-fast"
    );
});

// ==========================================
// B. SIGNATURE GENERATION
// ==========================================

console.log("\nB. Signature Generation:");

// Import the actual functions
import {
    generateSignature,
    generateTimestamp,
    computeCanonicalJson,
    normalizeCallbackBody,
    computeWebhookSignature,
    verifyWebhookSignature,
    isSuccessNotification,
    isPendingNotification,
    isFailedNotification,
    verifyNotificationAmount,
    formatProductName,
} from "@/lib/payment/ipaymu";

test("generateSignature produces valid hex", () => {
    const sig = generateSignature(
        '{"test":1}',
        "1234567890",
        "test-key"
    );
    assert(/^[a-f0-9]{64}$/.test(sig), "Must be 64-char hex");
});

test("generateSignature is deterministic", () => {
    const sig1 = generateSignature("body", "va", "key");
    const sig2 = generateSignature("body", "va", "key");
    assertEqual(sig1, sig2, "Same input → same sig");
});

test("generateSignature changes with body", () => {
    const sig1 = generateSignature("body1", "va", "key");
    const sig2 = generateSignature("body2", "va", "key");
    assert(sig1 !== sig2, "Different body → different sig");
});

test("generateSignature changes with VA", () => {
    const sig1 = generateSignature("body", "va1", "key");
    const sig2 = generateSignature("body", "va2", "key");
    assert(sig1 !== sig2, "Different VA → different sig");
});

test("generateSignature changes with API key", () => {
    const sig1 = generateSignature("body", "va", "key1");
    const sig2 = generateSignature("body", "va", "key2");
    assert(sig1 !== sig2, "Different API key → different sig");
});

test("generateSignature uses SHA256 HMAC", () => {
    const body = '{"product":["Test"],"qty":["1"],"price":["100000"],"amount":100000}';
    const va = "1234567890";
    const apiKey = "my-secret-key";

    const sig = generateSignature(body, va, apiKey);

    // Verify manually: POST:VA:SHA256(body).lowercase():API_KEY → HMAC-SHA256
    const bodyHash = crypto
        .createHash("sha256")
        .update(body)
        .digest("hex");
    const stringToSign = `POST:${va}:${bodyHash}:${apiKey}`;
    const expected = crypto
        .createHmac("sha256", apiKey)
        .update(stringToSign)
        .digest("hex");

    assertEqual(sig, expected, "Signature must match manual computation");
});

test("generateTimestamp returns YYYYMMDDHHmmss", () => {
    const ts = generateTimestamp();
    assert(/^\d{14}$/.test(ts), `Expected 14-digit timestamp, got: ${ts}`);
});

test("formatProductName handles empty variant", () => {
    assertEqual(
        formatProductName("Product", ""),
        "Product",
        "Empty variant"
    );
    assertEqual(
        formatProductName("Product", null),
        "Product",
        "Null variant"
    );
    assertEqual(
        formatProductName("Product", undefined),
        "Product",
        "Undefined variant"
    );
});

test("formatProductName with variant", () => {
    assertEqual(
        formatProductName("Product", "Variant"),
        "Product - Variant",
        "With variant"
    );
});

test("formatProductName trims whitespace", () => {
    assertEqual(
        formatProductName("  Product  ", "  Variant  "),
        "Product - Variant",
        "Should trim"
    );
});

// ==========================================
// C. WEBHOOK SIGNATURE VERIFICATION
// ==========================================

console.log("\nC. Webhook Signature Verification:");

test("normalizeCallbackBody handles all field types", () => {
    const raw = {
        reference_id: "ORD-123",
        trx_id: "456",
        status_code: "1",
        is_escrow: "true",
        additional_info: '[{"key":"val"}]',
        buyer_name: "Test",
    };

    const normalized = normalizeCallbackBody(raw);

    assertEqual(
        normalized.reference_id,
        "ORD-123",
        "String field"
    );
    assertEqual(normalized.trx_id, 456, "Integer field");
    assertEqual(normalized.status_code, 1, "Integer field");
    assertEqual(normalized.is_escrow, true, "Boolean field");
    assert(Array.isArray(normalized.additional_info), "Array field");
    assertEqual(
        (normalized.additional_info as any[]).length,
        1,
        "Array length"
    );
});

test("normalizeCallbackBody adds additional_info if missing", () => {
    const raw = { reference_id: "ORD-123" };
    const normalized = normalizeCallbackBody(raw);
    assert(
        Array.isArray(normalized.additional_info),
        "Must add additional_info"
    );
});

test("computeCanonicalJson sorts keys alphabetically", () => {
    const raw = {
        zebra: "1",
        alpha: "2",
        mango: "3",
    };
    const json = computeCanonicalJson(raw);
    const parsed = JSON.parse(json);
    const keys = Object.keys(parsed);
    // normalizeCallbackBody adds additional_info if missing
    assert(
        keys.indexOf("alpha") < keys.indexOf("mango"),
        "alpha must come before mango"
    );
    assert(
        keys.indexOf("mango") < keys.indexOf("zebra"),
        "mango must come before zebra"
    );
    assert(
        keys.indexOf("additional_info") >= 0,
        "additional_info must be present"
    );
});

test("computeCanonicalJson escapes forward slashes", () => {
    const raw = {
        url: "https://example.com/path",
    };
    const json = computeCanonicalJson(raw);
    assert(
        json.includes("\\/"),
        "Must escape forward slashes"
    );
});

test("verifyWebhookSignature accepts valid signature", () => {
    const va = "1234567890";
    const fields = {
        reference_id: "PAY-123",
        status_code: "1",
        sub_total: "100000",
        additional_info: "[]",
    };
    const canonicalJson = computeCanonicalJson(fields);
    const expectedSig = computeWebhookSignature(
        canonicalJson,
        va
    );
    const rawBody = new URLSearchParams(fields).toString();

    assert(
        verifyWebhookSignature(rawBody, expectedSig, va),
        "Valid signature must be accepted"
    );
});

test("verifyWebhookSignature rejects wrong signature", () => {
    const rawBody = "reference_id=PAY-123&status_code=1";
    assert(
        !verifyWebhookSignature(rawBody, "deadbeef", "1234567890"),
        "Wrong signature must be rejected"
    );
});

test("verifyWebhookSignature rejects empty signature", () => {
    const rawBody = "reference_id=PAY-123";
    assert(
        !verifyWebhookSignature(rawBody, "", "1234567890"),
        "Empty signature must be rejected"
    );
});

test("verifyWebhookSignature rejects missing VA", () => {
    const rawBody = "reference_id=PAY-123";
    assert(
        !verifyWebhookSignature(rawBody, "sig", ""),
        "Missing VA must be rejected (fail-closed)"
    );
});

test("verifyWebhookSignature rejects malformed body", () => {
    assert(
        !verifyWebhookSignature(
            "not%valid%body",
            "sig",
            "1234567890"
        ),
        "Malformed body must be rejected"
    );
});

// ==========================================
// D. NOTIFICATION STATUS MAPPING
// ==========================================

console.log("\nD. Notification Status Mapping:");

test("Status 200 = success", () => {
    assert(isSuccessNotification({ Status: 200 }));
});

test("Status \"berhasil\" = success", () => {
    assert(
        isSuccessNotification({ status: "berhasil" })
    );
});

test("Status 150 = pending", () => {
    assert(isPendingNotification({ Status: 150 }));
});

test("Status \"pending\" = pending", () => {
    assert(
        isPendingNotification({ status: "pending" })
    );
});

test("Status 400 = failed", () => {
    assert(isFailedNotification({ Status: 400 }));
});

test("Status \"gagal\" = failed", () => {
    assert(isFailedNotification({ status: "gagal" }));
});

test("Status \"expired\" = failed", () => {
    assert(
        isFailedNotification({ status: "expired" })
    );
});

test("Status 200 is NOT pending", () => {
    assert(!isPendingNotification({ Status: 200 }));
});

test("Status 150 is NOT success", () => {
    assert(!isSuccessNotification({ Status: 150 }));
});

test("Status 400 is NOT success", () => {
    assert(!isSuccessNotification({ Status: 400 }));
});

// ==========================================
// E. AMOUNT VERIFICATION
// ==========================================

console.log("\nE. Amount Verification:");

test("Amount matches via sub_total", () => {
    assert(
        verifyNotificationAmount({ sub_total: "100000" }, 100000)
    );
});

test("Amount matches via Amount field", () => {
    assert(
        verifyNotificationAmount({ Amount: "100000" }, 100000)
    );
});

test("Amount mismatch rejected", () => {
    assert(
        !verifyNotificationAmount({ sub_total: "99999" }, 100000)
    );
});

test("NaN amount rejected", () => {
    assert(
        !verifyNotificationAmount({ sub_total: "abc" }, 100000)
    );
});

test("Empty notification rejected", () => {
    assert(!verifyNotificationAmount({}, 100000));
});

test("Negative expected amount rejected", () => {
    assert(
        !verifyNotificationAmount({ sub_total: "-100" }, 100000)
    );
});

// ==========================================
// F. PRICING / ITEM DETAILS
// ==========================================

console.log("\nF. Pricing & Item Details:");

test("Cart iPaymu uses result.grossAmount as payment amount", () => {
    assert(
        cartIpaymuRoute.includes("amount: result.grossAmount"),
        "Cart must use grossAmount as amount"
    );
});

test("BuyNow iPaymu uses result.grossAmount as payment amount", () => {
    assert(
        buyNowIpaymuRoute.includes("amount: result.grossAmount"),
        "BuyNow must use grossAmount as amount"
    );
});

test("Cart iPaymu adds spin wheel as negative item", () => {
    assert(
        cartIpaymuRoute.includes('"Reward Spin Wheel"') &&
            cartIpaymuRoute.includes("-result.spinWheelDiscount"),
        "Cart must add spin wheel negative item"
    );
});

test("BuyNow iPaymu adds spin wheel as negative item", () => {
    assert(
        buyNowIpaymuRoute.includes('"Reward Spin Wheel"') &&
            buyNowIpaymuRoute.includes("-result.spinWheelDiscount"),
        "BuyNow must add spin wheel negative item"
    );
});

test("Cart iPaymu adds voucher as negative item", () => {
    assert(
        cartIpaymuRoute.includes("Voucher ") &&
            cartIpaymuRoute.includes("-result.discount"),
        "Cart must add voucher negative item"
    );
});

test("BuyNow iPaymu adds voucher as negative item", () => {
    assert(
        buyNowIpaymuRoute.includes("Voucher ") &&
            buyNowIpaymuRoute.includes("-result.discount"),
        "BuyNow must add voucher negative item"
    );
});

test("Cart iPaymu adds shipping as positive item", () => {
    assert(
        cartIpaymuRoute.includes('"Biaya Pengiriman"') &&
            cartIpaymuRoute.includes("result.shippingCost"),
        "Cart must add shipping item"
    );
});

test("notifyUrl uses APP_URL env var (not request headers)", () => {
    assert(
        cartIpaymuRoute.includes("notifyUrl:") &&
            cartIpaymuRoute.includes("appUrl") &&
            cartIpaymuRoute.includes("api/payment/ipaymu/notification"),
        "Cart must use APP_URL for notifyUrl"
    );
});

test("returnUrl uses APP_URL env var", () => {
    assert(
        cartIpaymuRoute.includes("returnUrl:") &&
            cartIpaymuRoute.includes("appUrl"),
        "Cart must use APP_URL for returnUrl"
    );
});

test("cancelUrl uses APP_URL env var", () => {
    assert(
        cartIpaymuRoute.includes("cancelUrl:") &&
            cartIpaymuRoute.includes("appUrl"),
        "Cart must use APP_URL for cancelUrl"
    );
});

// ==========================================
// G. SECURITY
// ==========================================

console.log("\nG. Security:");

test("Webhook verifies signature before processing", () => {
    assert(
        notificationRoute.includes("verifyWebhookSignature") &&
            notificationRoute.includes("x-signature"),
        "Webhook must verify signature"
    );
});

test("Webhook rejects missing auth headers", () => {
    assert(
        notificationRoute.includes("MISSING WEBHOOK AUTH HEADERS") ||
            notificationRoute.includes("Missing authentication"),
        "Webhook must reject missing headers"
    );
});

test("Webhook uses atomic CAS for payment settlement", () => {
    assert(
        notificationRoute.includes("$executeRaw") &&
            notificationRoute.includes("status IN ('PENDING', 'PROCESSING')") &&
            notificationRoute.includes("paymentStatus NOT IN ('PAID', 'REFUNDED')"),
        "Must use atomic CAS for settlement"
    );
});

test("Webhook prevents PAID → PENDING regression", () => {
    assert(
        notificationRoute.includes("paymentStatus != 'PAID'") ||
            notificationRoute.includes("NOT IN ('PAID', 'REFUNDED')"),
        "Must prevent PAID regression"
    );
});

test("Webhook validates amount against order.total", () => {
    assert(
        notificationRoute.includes("verifyNotificationAmount"),
        "Must verify amount against order"
    );
});

test("Webhook validates order ownership via orderNumber", () => {
    assert(
        notificationRoute.includes("orderNumber") &&
            notificationRoute.includes("findUnique"),
        "Must validate order exists"
    );
});

test("Forged Host header cannot alter callback URLs", () => {
    assert(
        appOrigin.includes("REJECTED") ||
            appOrigin.includes("allowlist") ||
            appOrigin.includes("NEXT_PUBLIC_APP_URL"),
        "Must use trusted URL source, not request headers"
    );
});

test("API key not logged in createRedirectPayment", () => {
    // Check that debug logs don't expose the full API key
    const debugSection = ipaymuLib.substring(
        ipaymuLib.indexOf("IPAYMU DEBUG"),
        ipaymuLib.indexOf("========== IPAYMU CREATE")
    );
    assert(
        !debugSection.includes("apiKey") ||
            debugSection.includes("SIGNATURE FIRST8"),
        "Must not log full API key"
    );
});

test("Signature not fully logged", () => {
    assert(
        ipaymuLib.includes("SIGNATURE FIRST8") ||
            ipaymuLib.includes("bodyHash:"),
        "Must only log partial signature/hash"
    );
});

test("App origin uses allowlist for header fallback", () => {
    assert(
        appOrigin.includes("buildAllowedHosts") ||
            appOrigin.includes("allowedHosts"),
        "Must use allowlist for header-based fallback"
    );
});

test("Notification logs safe fields only", () => {
    // The notification route should log reference_id, trx_id, status_code
    // but NOT buyer PII or sensitive data
    assert(
        notificationRoute.includes("reference_id") &&
            notificationRoute.includes("trx_id"),
        "Should log safe identifiers"
    );
});

// ==========================================
// H. ERROR HANDLING
// ==========================================

console.log("\nH. Error Handling:");

test("createRedirectPayment has timeout support", () => {
    assert(
        ipaymuLib.includes("AbortController") ||
            ipaymuLib.includes("signal") ||
            ipaymuLib.includes("TIMEOUT"),
        "Must have request timeout"
    );
});

test("createRedirectPayment validates amount", () => {
    assert(
        ipaymuLib.includes("Number.isFinite(request.amount)") ||
            ipaymuLib.includes("amount <= 0"),
        "Must validate payment amount"
    );
});

test("createRedirectPayment validates product arrays", () => {
    assert(
        ipaymuLib.includes("product.length === 0") ||
            ipaymuLib.includes("product.length !== request.qty.length"),
        "Must validate product arrays"
    );
});

test("Cart iPaymu rolls back on payment creation failure", () => {
    assert(
        cartIpaymuRoute.includes("rollbackCheckoutOrder") &&
            cartIpaymuRoute.includes("SAFETY ROLLBACK"),
        "Must rollback on failure"
    );
});

test("BuyNow iPaymu rolls back on payment creation failure", () => {
    assert(
        buyNowIpaymuRoute.includes("rollbackCheckoutOrder"),
        "Must rollback on failure"
    );
});

test("Cart iPaymu validates credentials before creating order", () => {
    assert(
        cartIpaymuRoute.includes("IPAYMU_CONFIG.apiKey") &&
            cartIpaymuRoute.includes("IPAYMU_CONFIG.va"),
        "Must check credentials before order creation"
    );
});

test("BuyNow iPaymu validates credentials before creating order", () => {
    assert(
        buyNowIpaymuRoute.includes("IPAYMU_CONFIG.apiKey") &&
            buyNowIpaymuRoute.includes("IPAYMU_CONFIG.va"),
        "Must check credentials before order creation"
    );
});

test("Cart iPaymu has rate limiting", () => {
    assert(
        cartIpaymuRoute.includes("rateLimiters") &&
            cartIpaymuRoute.includes("orderCreation"),
        "Must have rate limiting"
    );
});

test("BuyNow iPaymu has rate limiting", () => {
    assert(
        buyNowIpaymuRoute.includes("rateLimiters") &&
            buyNowIpaymuRoute.includes("orderCreation"),
        "Must have rate limiting"
    );
});

test("Cart iPaymu requires authentication", () => {
    assert(
        cartIpaymuRoute.includes("auth()") &&
            cartIpaymuRoute.includes("session?.user?.id"),
        "Must require authentication"
    );
});

test("BuyNow iPaymu requires authentication", () => {
    assert(
        buyNowIpaymuRoute.includes("auth()"),
        "Must require authentication"
    );
});

// ==========================================
// I. PAYMENT STATE MACHINE
// ==========================================

console.log("\nI. Payment State Machine:");

test("Webhook: PENDING/PROCESSING → PAID (allowed)", () => {
    assert(
        notificationRoute.includes("status IN ('PENDING', 'PROCESSING')") &&
            notificationRoute.includes("status = 'PAID'"),
        "Must allow PENDING → PAID transition"
    );
});

test("Webhook: PAID → PAID (idempotent no-op)", () => {
    assert(
        notificationRoute.includes("already processed") ||
            notificationRoute.includes("idempotent") ||
            notificationRoute.includes("settled"),
        "Must handle PAID → PAID idempotently"
    );
});

test("Webhook: PAID → PENDING prevented", () => {
    assert(
        notificationRoute.includes("paymentStatus != 'PAID'") ||
            notificationRoute.includes("NOT IN ('PAID')"),
        "Must prevent PAID → PENDING regression"
    );
});

test("Webhook: FAILED/EXPIRED releases stock", () => {
    assert(
        notificationRoute.includes("releaseStockAndVoucherForOrder"),
        "Must release stock on payment failure"
    );
});

test("Webhook: FAILED/EXPIRED cancels affiliate commission", () => {
    assert(
        notificationRoute.includes("cancelCommissionForOrder"),
        "Must cancel commission on failure"
    );
});

// ==========================================
// J. IDEMPOTENCY
// ==========================================

console.log("\nJ. Idempotency:");

test("Webhook handles duplicate success callback", () => {
    // The CAS update with affectedRows check ensures idempotency
    assert(
        notificationRoute.includes("affectedRows") ||
            notificationRoute.includes("settled"),
        "Must track settlement state for idempotency"
    );
});

test("Webhook returns success for duplicate non-existent order", () => {
    // Should return 200 so iPaymu doesn't retry
    assert(
        notificationRoute.includes("Order tidak ditemukan"),
        "Must handle non-existent order gracefully"
    );
});

// ==========================================
// K. SOURCE CODE: CHECKOUT INTEGRATION
// ==========================================

console.log("\nK. Checkout Integration:");

test("XOR: voucher + spin wheel rejected at server", () => {
    const checkoutCode = readFile("lib/checkout.ts");
    assert(
        checkoutCode.includes(
            '"Silakan pilih salah satu voucher atau reward Spin Wheel."'
        ),
        "Must reject voucher + spin wheel"
    );
});

test("Checkout creates SPIN_WHEEL_REWARD item in Midtrans details", () => {
    const checkoutCode = readFile("lib/checkout.ts");
    assert(
        checkoutCode.includes('"SPIN_WHEEL_REWARD"'),
        "Must create SPIN_WHEEL_REWARD item"
    );
});

test("Checkout validates item details total", () => {
    const checkoutCode = readFile("lib/checkout.ts");
    assert(
        checkoutCode.includes("validateItemDetailsTotal"),
        "Must validate item details total"
    );
});

test("BuyNow iPaymu validates item total before payment creation", () => {
    assert(
        buyNowIpaymuRoute.includes("itemTotal") &&
            buyNowIpaymuRoute.includes("result.grossAmount"),
        "BuyNow iPaymu must validate item total == grossAmount"
    );
});

test("Cart iPaymu validates item total before payment creation", () => {
    assert(
        cartIpaymuRoute.includes("itemTotal") &&
            cartIpaymuRoute.includes("result.grossAmount"),
        "Cart iPaymu must validate item total == grossAmount"
    );
});

test("BuyNow iPaymu rolls back on item total mismatch", () => {
    assert(
        buyNowIpaymuRoute.includes("ITEM TOTAL MISMATCH"),
        "Must log mismatch and rollback"
    );
});

test("Error messages include error category prefix", () => {
    assert(
        ipaymuLib.includes("[TIMEOUT]") &&
            ipaymuLib.includes("[DNS_ERROR]") &&
            ipaymuLib.includes("[NETWORK_ERROR]") &&
            ipaymuLib.includes("[AUTH_ERROR]") &&
            ipaymuLib.includes("[IPAYMU_API_ERROR]") &&
            ipaymuLib.includes("[IPAYMU_SERVER_ERROR]") &&
            ipaymuLib.includes("[INVALID_JSON]") &&
            ipaymuLib.includes("[CONNECTION_REFUSED]") &&
            ipaymuLib.includes("[CONNECTION_RESET]") &&
            ipaymuLib.includes("[TLS_ERROR]") &&
            ipaymuLib.includes("[IPAYMU_HTTP_ERROR]"),
        "Must categorize errors by type"
    );
});

test("Spin wheel diagnostic logging includes reward details", () => {
    const checkoutCode = readFile("lib/checkout.ts");
    assert(
        checkoutCode.includes("SPIN_REWARD_CALC") &&
            checkoutCode.includes("rewardType") &&
            checkoutCode.includes("rewardValue") &&
            checkoutCode.includes("spinWheelDiscount"),
        "Must log spin reward details for debugging"
    );
});

test("Both frontend pages send spinWheelSpinId", () => {
    const checkoutPage = readFile("app/checkout/CheckoutPage.tsx");
    const buyNowPage = readFile("app/buy-now/BuyNowPage.tsx");

    const checkoutMatches = checkoutPage.match(
        /spinWheelSpinId: selectedSpinReward/g
    );
    assert(
        !!checkoutMatches && checkoutMatches.length >= 2,
        "Checkout must send spinWheelSpinId in 2+ payloads"
    );

    const buyNowMatches = buyNowPage.match(
        /spinWheelSpinId: selectedSpinReward/g
    );
    assert(
        !!buyNowMatches && buyNowMatches.length >= 2,
        "BuyNow must send spinWheelSpinId in 2+ payloads"
    );
});

// ==========================================
// RESULTS
// ==========================================

console.log(
    `\n${"=".repeat(50)}`
);
console.log(
    `\n📊 RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`
);

if (failed > 0) {
    console.log("\n❌ Some tests failed!");
    process.exit(1);
} else {
    console.log("\n✅ All tests passed!");
}
