/**
 * ==========================================
 * REGISTER RATE LIMIT TESTS
 * ==========================================
 *
 * Static/code-path verification tests.
 * These verify that rate limiting is correctly
 * integrated into the register endpoint without
 * requiring a running database.
 *
 * Run: npx tsx __tests__/auth/register-rate-limit.test.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

function readFile(relativePath: string): string {
    return readFileSync(
        resolve(process.cwd(), relativePath),
        "utf-8"
    );
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

// ==========================================
// TEST SUITE
// ==========================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
    try {
        fn();
        pass(name);
        passed++;
    } catch (e) {
        fail(
            name,
            e instanceof Error ? e.message : String(e)
        );
        failed++;
    }
}

console.log("\n=== REGISTER RATE LIMIT TESTS ===\n");

// ==========================================
// 1. IMPORTS
// ==========================================

console.log("1. Imports:");

const registerCode = readFile("app/api/auth/register/route.ts");
const rateLimitCode = readFile("lib/rate-limit.ts");

test("Register imports rateLimiters from @/lib/rate-limit", () => {
    assert(
        registerCode.includes('rateLimiters') &&
        registerCode.includes('@/lib/rate-limit'),
        "Register doesn't import rateLimiters from @/lib/rate-limit"
    );
});

test("Register imports getClientIp from @/lib/rate-limit", () => {
    assert(
        registerCode.includes('getClientIp') &&
        registerCode.includes('@/lib/rate-limit'),
        "Register doesn't import getClientIp from @/lib/rate-limit"
    );
});

// ==========================================
// 2. RATE LIMITER EXISTS
// ==========================================

console.log("\n2. Rate Limiter Configuration:");

test("rateLimiters.register is defined", () => {
    assert(
        rateLimitCode.includes('register:'),
        "rateLimiters.register not defined in lib/rate-limit.ts"
    );
});

test("rateLimiters.register uses IP-based key (register:${ip})", () => {
    assert(
        rateLimitCode.includes('`register:${ip}`'),
        "rateLimiters.register doesn't use IP-based key"
    );
});

test("rateLimiters.register has max 3 requests per hour", () => {
    // Should have checkRateLimit with 3 and 60*60*1000
    assert(
        rateLimitCode.includes('register:') &&
        rateLimitCode.includes('3, 60 * 60 * 1000'),
        "rateLimiters.register should be 3 requests per hour"
    );
});

// ==========================================
// 3. RATE LIMIT APPLICATION
// ==========================================

console.log("\n3. Rate Limit Application:");

test("getClientIp is called with request object", () => {
    assert(
        registerCode.includes('getClientIp(req)'),
        "getClientIp not called with request object"
    );
});

test("rateLimiters.register is called with clientIp", () => {
    assert(
        registerCode.includes('rateLimiters.register(clientIp)'),
        "rateLimiters.register not called with clientIp"
    );
});

test("Rate limit check happens before body parsing", () => {
    const rateLimitIdx = registerCode.indexOf('rateLimiters.register(clientIp)');
    const bodyIdx = registerCode.indexOf('await req.json()');
    assert(
        rateLimitIdx > 0 && bodyIdx > 0 && rateLimitIdx < bodyIdx,
        "Rate limit check must happen before body parsing"
    );
});

test("Rate limit check happens before database queries", () => {
    const rateLimitIdx = registerCode.indexOf('rateLimiters.register(clientIp)');
    const dbIdx = registerCode.indexOf('prisma.user.findFirst');
    assert(
        rateLimitIdx > 0 && dbIdx > 0 && rateLimitIdx < dbIdx,
        "Rate limit check must happen before database queries"
    );
});

// ==========================================
// 4. RATE LIMIT RESPONSE
// ==========================================

console.log("\n4. Rate Limit Response:");

test("Returns HTTP 429 when rate limited", () => {
    assert(
        registerCode.includes('{ status: 429 }'),
        "Register doesn't return 429 status"
    );
});

test("Returns success: false in rate limit response", () => {
    assert(
        registerCode.includes('success: false'),
        "Rate limit response missing success: false"
    );
});

test("Rate limit response includes user-friendly message", () => {
    assert(
        registerCode.includes('Terlalu banyak permintaan'),
        "Rate limit response missing user-friendly message"
    );
});

test("Rate limit check returns early (no database writes)", () => {
    // The rate limit block should have a return statement
    const rateLimitBlock = registerCode.substring(
        registerCode.indexOf('rateLimiters.register(clientIp)'),
        registerCode.indexOf('await req.json()')
    );
    assert(
        rateLimitBlock.includes('return NextResponse.json'),
        "Rate limit block doesn't return early"
    );
});

// ==========================================
// 5. EXISTING BEHAVIOR PRESERVED
// ==========================================

console.log("\n5. Existing Behavior Preserved:");

test("Register validation still uses registerSchema", () => {
    assert(
        registerCode.includes('registerSchema.parse(body)'),
        "Register validation missing registerSchema.parse"
    );
});

test("Email/phone requirement check preserved", () => {
    assert(
        registerCode.includes('data.email && !data.phone'),
        "Email/phone requirement check missing"
    );
});

test("Existing user check preserved (findFirst)", () => {
    assert(
        registerCode.includes('prisma.user.findFirst'),
        "Existing user check missing"
    );
});

test("Password hashing preserved", () => {
    assert(
        registerCode.includes('hashPassword(data.password)'),
        "Password hashing missing"
    );
});

test("Referral code generation preserved", () => {
    assert(
        registerCode.includes('referralCode') &&
        registerCode.includes('REF'),
        "Referral code generation missing"
    );
});

test("User creation preserved", () => {
    assert(
        registerCode.includes('prisma.user.create'),
        "User creation missing"
    );
});

test("Success response preserves 201 status", () => {
    assert(
        registerCode.includes('{ status: 201 }'),
        "Success response missing 201 status"
    );
});

test("Error handling preserved (catch block)", () => {
    assert(
        registerCode.includes('catch (error'),
        "Error handling missing"
    );
});

test("Success message preserved", () => {
    assert(
        registerCode.includes('Register berhasil'),
        "Success message missing"
    );
});

// ==========================================
// 6. NO UNWANTED CHANGES
// ==========================================

console.log("\n6. No Unwanted Changes:");

test("No password hashing changes", () => {
    assert(
        registerCode.includes('hashPassword(data.password)'),
        "Password hashing was changed unexpectedly"
    );
});

test("No referral logic changes", () => {
    assert(
        registerCode.includes('`REF${Math.random()') ||
        registerCode.includes('Math.random()'),
        "Referral logic was changed unexpectedly"
    );
});

test("No database schema changes (no alter/create table)", () => {
    assert(
        !registerCode.includes('ALTER') &&
        !registerCode.includes('CREATE TABLE'),
        "Register contains database schema changes"
    );
});

// ==========================================
// 7. INTEGRATION CONSISTENCY
// ==========================================

console.log("\n7. Integration Consistency:");

test("Rate limit response format matches voucher validate endpoint", () => {
    const voucherCode = readFile("app/api/voucher/validate/route.ts");
    assert(
        voucherCode.includes('success: false, message: "Terlalu banyak permintaan'),
        "Voucher validate doesn't use same response format"
    );
    assert(
        registerCode.includes('success: false, message: "Terlalu banyak permintaan'),
        "Register doesn't use same response format"
    );
});

test("getClientIp usage pattern matches voucher validate endpoint", () => {
    const voucherCode = readFile("app/api/voucher/validate/route.ts");
    // Both should call getClientIp with the request object
    assert(
        voucherCode.includes('getClientIp(request)') || voucherCode.includes('getClientIp(req'),
        "Voucher validate doesn't use getClientIp"
    );
    assert(
        registerCode.includes('getClientIp(req)'),
        "Register doesn't use getClientIp"
    );
});

test("Rate limit check is the first operation after try block", () => {
    // Find the position of getClientIp relative to the try block
    const tryIdx = registerCode.indexOf('try {');
    const ipIdx = registerCode.indexOf('getClientIp(req)');
    assert(
        tryIdx > 0 && ipIdx > tryIdx && ipIdx < tryIdx + 200,
        "Rate limit check should be the first operation after try block"
    );
});

// ==========================================
// RESULTS
// ==========================================

console.log(
    `\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`
);

if (failed > 0) {
    process.exit(1);
}
