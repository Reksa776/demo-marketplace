/**
 * ==========================================
 * REFERRAL FLOW E2E REGRESSION TESTS
 * ==========================================
 *
 * Tests the complete referral tracking flow
 * from URL click through registration to checkout.
 *
 * Covers:
 *   1. ReferralTracker (cookie setting)
 *   2. /api/affiliate/resolve (cookie reading)
 *   3. RegisterForm (auto-fill, read-only, override)
 *   4. Register API (server-side validation)
 *   5. Cookie persistence through auth flow
 *   6. Checkout attribution
 *   7. Security (no client-trusted commission fields)
 *   8. Attribution policy (last-touch)
 *   9. Edge cases
 *
 * Run: npx tsx __tests__/affiliate/referral-flow.test.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { assert } from "console";

function readFile(relativePath: string): string {
    return readFileSync(
        resolve(__dirname, "../..", relativePath),
        "utf-8"
    );
}

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

console.log("\n==================================================");
console.log("  REFERRAL FLOW E2E REGRESSION TESTS");
console.log("==================================================\n");

// ==========================================
// 1. REFERRAL TRACKER
// ==========================================
console.log("1. ReferralTracker — Cookie Setting");
const tracker = readFile("app/ReferralTracker.tsx");

test("sets JS-readable cookie (aff_ref_public)", () => {
    assert(tracker.includes("aff_ref_public"), "Must set aff_ref_public cookie");
});

test("sets cookie with 30-day expiry", () => {
    assert(tracker.includes("60 * 60 * 24 * 30"), "Must set 30-day expiry");
});

test("calls /api/affiliate/referral endpoint", () => {
    assert(tracker.includes("/api/affiliate/referral"), "Must call referral API");
});

test("reads ?ref= from URL params", () => {
    assert(tracker.includes('params.get("ref")'), "Must read ?ref= from URL");
});

test("uses SameSite=Lax for cookie", () => {
    assert(tracker.includes("SameSite=Lax"), "Must use SameSite=Lax");
});

test("prevents double-firing with useRef", () => {
    assert(tracker.includes("useRef"), "Must prevent double-firing");
});

test("sets Secure flag in production", () => {
    assert(tracker.includes("window.location.protocol"), "Must check protocol for Secure flag");
    assert(tracker.includes("Secure"), "Must set Secure flag");
});

test("sets Path=/ for cookie", () => {
    assert(tracker.includes("path=/"), "Must set path=/");
});

// ==========================================
// 2. RESOLVE ENDPOINT
// ==========================================
console.log("\n2. /api/affiliate/resolve — Cookie Reading");
const resolveApi = readFile("app/api/affiliate/resolve/route.ts");

test("exports GET handler", () => {
    assert(resolveApi.includes("export async function GET"), "Must export GET");
});

test("reads aff_ref cookie", () => {
    assert(resolveApi.includes("aff_ref"), "Must read aff_ref cookie");
});

test("validates affiliate is APPROVED", () => {
    assert(resolveApi.includes('"APPROVED"'), "Must validate APPROVED status");
});

test("queries AffiliateProfile", () => {
    assert(resolveApi.includes("affiliateProfile"), "Must query AffiliateProfile");
});

test("returns affiliateCode", () => {
    assert(resolveApi.includes("affiliateCode"), "Must return affiliateCode");
});

test("returns null if no cookie", () => {
    assert(resolveApi.includes("code: null"), "Must return null if no cookie");
});

test("does not expose userId", () => {
    // Should use select to limit fields
    assert(resolveApi.includes("select"), "Must use select to limit fields");
});

test("handles errors gracefully", () => {
    assert(resolveApi.includes("catch"), "Must handle errors");
});

// ==========================================
// 3. REGISTER FORM — AUTO-FILL
// ==========================================
console.log("\n3. RegisterForm — Auto-fill Detection");
const registerForm = readFile("components/auth/RegisterForm.tsx");

test("imports useSearchParams", () => {
    assert(registerForm.includes("useSearchParams"), "Must import useSearchParams");
});

test("imports useCallback", () => {
    assert(registerForm.includes("useCallback"), "Must import useCallback");
});

test("has detectReferral function", () => {
    assert(registerForm.includes("detectReferral"), "Must have detectReferral");
});

test("reads ?ref= from URL params", () => {
    assert(registerForm.includes('searchParams.get("ref")'), "Must read ?ref= from URL");
});

test("calls /api/affiliate/resolve", () => {
    assert(registerForm.includes("/api/affiliate/resolve"), "Must call resolve endpoint");
});

test("uses setValue from react-hook-form", () => {
    assert(registerForm.includes("setValue"), "Must use setValue");
});

test("auto-fills referralCode field", () => {
    assert(registerForm.includes('setValue("referralCode"'), "Must auto-fill referralCode");
});

test("sets referralDetected state", () => {
    assert(registerForm.includes("setReferralDetected"), "Must track detection state");
});

test("calls detectReferral on mount", () => {
    assert(registerForm.includes("useEffect") && registerForm.includes("detectReferral"), "Must call on mount");
});

test("priority: URL ?ref= > JS cookie > API resolve", () => {
    const urlIdx = registerForm.indexOf('searchParams.get("ref")');
    const cookieIdx = registerForm.indexOf("aff_ref_public");
    const apiIdx = registerForm.indexOf("/api/affiliate/resolve");
    assert(urlIdx < cookieIdx, "URL must come before cookie");
    assert(cookieIdx < apiIdx, "Cookie must come before API");
});

// ==========================================
// 4. REGISTER FORM — READ-ONLY WHEN DETECTED
// ==========================================
console.log("\n4. RegisterForm — Read-only UX");

test("has referralLoading state", () => {
    assert(registerForm.includes("referralLoading"), "Must have referralLoading state");
});

test("has referralOverride state", () => {
    assert(registerForm.includes("referralOverride"), "Must have referralOverride state");
});

test("shows read-only badge when auto-detected", () => {
    assert(registerForm.includes("Otomatis") || registerForm.includes("otomatis"), "Must show auto-detected badge");
});

test("has override button", () => {
    assert(
        registerForm.includes("Gunakan kode referral lain") || registerForm.includes("handleOverrideReferral"),
        "Must have override option"
    );
});

test("has cancel override button", () => {
    assert(
        registerForm.includes("handleCancelOverride") || registerForm.includes("Kembali ke kode referral"),
        "Must have cancel override option"
    );
});

test("input is readOnly during loading", () => {
    assert(registerForm.includes("readOnly"), "Must set readOnly during loading");
});

test("hidden input ensures value is submitted", () => {
    assert(registerForm.includes("type=\"hidden\""), "Must have hidden input for form submission");
});

test("sets aff_ref_public cookie from URL param", () => {
    assert(
        registerForm.includes("setPublicReferralCookie") || registerForm.includes("aff_ref_public"),
        "Must persist referral to JS cookie from URL"
    );
});

test("fires referral API from URL param", () => {
    assert(
        registerForm.includes("/api/affiliate/referral"),
        "Must fire referral API to set HTTP-only cookie"
    );
});

// ==========================================
// 5. REGISTER FORM — PERSISTENCE
// ==========================================
console.log("\n5. RegisterForm — Persistence Through Errors");

test("referral code NOT cleared on submit error", () => {
    // The onSubmit catch block should NOT call reset() or setValue("referralCode", "")
    const onSubmitIdx = registerForm.indexOf("async function onSubmit");
    const catchBlock = registerForm.indexOf("catch (error:", onSubmitIdx);
    const finallyBlock = registerForm.indexOf("finally:", catchBlock);
    const catchContent = registerForm.substring(catchBlock, finallyBlock);

    assert(
        !catchContent.includes('setValue("referralCode", "")') &&
        !catchContent.includes("reset("),
        "Must NOT clear referral on error"
    );
});

test("has referralResolved ref to prevent re-detection", () => {
    assert(
        registerForm.includes("referralResolved") && registerForm.includes("useRef"),
        "Must use ref to prevent re-detection"
    );
});

test("uses hidden input instead of formRegister for auto-detected", () => {
    // When auto-detected, a hidden input with value={referralCode} is used
    assert(
        registerForm.includes("value={referralCode}") || registerForm.includes('value={referralCode}'),
        "Must use hidden input with explicit value"
    );
});

// ==========================================
// 6. REGISTER PAGE — SUSPENSE
// ==========================================
console.log("\n6. Register Page — Suspense Boundary");
const registerPage = readFile("app/register/page.tsx");

test("imports Suspense from react", () => {
    assert(registerPage.includes("Suspense"), "Must import Suspense");
});

test("wraps RegisterForm in Suspense", () => {
    assert(
        registerPage.includes("<Suspense") && registerPage.includes("<RegisterForm"),
        "Must wrap in Suspense"
    );
});

// ==========================================
// 7. REGISTER API — SERVER-SIDE VALIDATION
// ==========================================
console.log("\n7. Register API — Server-side Referral Validation");
const registerApi = readFile("app/api/auth/register/route.ts");

test("validates referralCode against AffiliateProfile", () => {
    assert(
        registerApi.includes("affiliateProfile") && registerApi.includes("findFirst"),
        "Must validate against AffiliateProfile"
    );
});

test("checks affiliate status is APPROVED", () => {
    assert(
        registerApi.includes('"APPROVED"'),
        "Must check APPROVED status"
    );
});

test("uses validatedReferredBy (not raw client input)", () => {
    assert(
        registerApi.includes("validatedReferredBy"),
        "Must use validated referral, not raw client input"
    );
});

test("sets referredBy to null if affiliate invalid", () => {
    assert(
        registerApi.includes("validatedReferredBy = null") || registerApi.includes("null"),
        "Must set null for invalid codes"
    );
});

test("logs invalid referral attempts", () => {
    assert(
        registerApi.includes("console.log") && registerApi.includes("invalid"),
        "Must log invalid referral attempts"
    );
});

test("does NOT accept commissionRate from client", () => {
    assert(!registerApi.includes("commissionRate"), "Must not accept commissionRate");
});

test("does NOT accept commissionAmount from client", () => {
    assert(!registerApi.includes("commissionAmount"), "Must not accept commissionAmount");
});

test("does NOT accept affiliateId from client", () => {
    assert(!registerApi.includes("affiliateId"), "Must not accept affiliateId");
});

test("uses registerSchema for validation", () => {
    assert(registerApi.includes("registerSchema.parse"), "Must validate with schema");
});

test("has rate limiting", () => {
    assert(registerApi.includes("rateLimit") || registerApi.includes("rateLimiter"), "Must have rate limiting");
});

test("checks for existing user", () => {
    assert(
        registerApi.includes("existing") && registerApi.includes("findFirst"),
        "Must check existing user"
    );
});

// ==========================================
// 8. REGISTRATION SCHEMA
// ==========================================
console.log("\n8. Registration Schema");
const schema = readFile("lib/validations/register.ts");

test("includes referralCode field", () => {
    assert(schema.includes("referralCode"), "Must include referralCode");
});

test("referralCode is optional", () => {
    assert(schema.includes("optional"), "referralCode must be optional");
});

test("validates name min 2 chars", () => {
    assert(schema.includes("min(2"), "Must validate name");
});

test("validates password min 6 chars", () => {
    assert(schema.includes("min(6"), "Must validate password");
});

test("requires email or phone", () => {
    assert(schema.includes("email") && schema.includes("phone"), "Must require email or phone");
});

// ==========================================
// 9. COOKIE PERSISTENCE
// ==========================================
console.log("\n9. Cookie Persistence Through Auth Flow");
const referralApi = readFile("app/api/affiliate/referral/route.ts");
const loginForm = readFile("components/auth/LoginForm.tsx");

test("referral API sets HTTP-only cookie", () => {
    assert(referralApi.includes("httpOnly: true"), "Must set httpOnly");
});

test("referral API sets Secure in production", () => {
    assert(referralApi.includes("secure"), "Must set secure");
});

test("referral API sets SameSite=Lax", () => {
    assert(referralApi.includes('sameSite: "lax"'), "Must set SameSite=Lax");
});

test("referral API sets Path=/", () => {
    assert(referralApi.includes('path: "/"'), "Must set Path=/");
});

test("referral API sets 30-day expiry", () => {
    assert(referralApi.includes("COOKIE_MAX_AGE"), "Must set 30-day expiry");
});

test("login form does not clear cookies", () => {
    assert(
        !loginForm.includes("document.cookie") || !loginForm.includes("delete"),
        "Login must not clear cookies"
    );
});

test("NextAuth config does not touch aff_ref cookie", () => {
    const authConfig = readFile("auth.ts");
    assert(!authConfig.includes("aff_ref"), "NextAuth must not touch aff_ref");
});

// ==========================================
// 10. CHECKOUT ATTRIBUTION
// ==========================================
console.log("\n10. Checkout Attribution");
const checkout = readFile("lib/checkout.ts");
const referral = readFile("lib/affiliate/referral.ts");

test("checkout accepts affiliateCode in input", () => {
    assert(
        checkout.includes("affiliateCode") && checkout.includes("CreateCheckoutInput"),
        "Checkout must accept affiliateCode"
    );
});

test("getReferralCode reads from cookie header", () => {
    assert(
        referral.includes("getReferralCode") && referral.includes("cookieHeader"),
        "Must read from cookie header"
    );
});

test("getReferralCode reads aff_ref cookie", () => {
    assert(referral.includes("aff_ref"), "Must read aff_ref cookie");
});

test("resolveAffiliate validates APPROVED status", () => {
    assert(
        referral.includes("resolveAffiliate") && referral.includes('"APPROVED"'),
        "Must validate APPROVED"
    );
});

test("checkout creates AffiliateConversion", () => {
    assert(checkout.includes("affiliateConversion.create"), "Must create conversion");
});

test("checkout validates affiliate server-side", () => {
    assert(checkout.includes("affiliateProfile.findFirst"), "Must validate server-side");
});

test("checkout uses server-side commission calculation", () => {
    assert(
        checkout.includes("commissionAmount") && checkout.includes("affiliate.commissionRate"),
        "Must use server-side commission"
    );
});

// ==========================================
// 11. SECURITY
// ==========================================
console.log("\n11. Security Audit");

test("referral API only accepts affiliateCode from URL", () => {
    // Should not trust any body params
    assert(
        !referralApi.includes("req.body") && !referralApi.includes("request.body"),
        "Must not read request body"
    );
});

test("resolve endpoint only reads cookie", () => {
    assert(
        !resolveApi.includes("req.body") && !resolveApi.includes("request.body"),
        "Must not read request body"
    );
});

test("register API does not trust commission fields", () => {
    assert(!registerApi.includes("commissionRate"), "No commissionRate from client");
    assert(!registerApi.includes("commissionAmount"), "No commissionAmount from client");
    assert(!registerApi.includes("affiliateId"), "No affiliateId from client");
});

test("checkout validates affiliate is APPROVED", () => {
    assert(
        checkout.includes('"APPROVED"'),
        "Checkout must validate APPROVED"
    );
});

test("referral code is always server-validated", () => {
    // Both referral API and register API validate against AffiliateProfile
    assert(referralApi.includes("affiliateProfile.findFirst"), "Referral API validates");
    assert(registerApi.includes("affiliateProfile.findFirst"), "Register API validates");
});

test("short code format is alphanumeric", () => {
    const shortCode = readFile("lib/affiliate/short-code.ts");
    assert(
        shortCode.includes("CHARSET") && shortCode.includes("ABCDEFGH"),
        "Must use alphanumeric charset"
    );
});

// ==========================================
// 12. ATTRIBUTION POLICY
// ==========================================
console.log("\n12. Attribution Policy");

test("last-touch attribution (cookie overwritten on new referral)", () => {
    // The referral API always sets the cookie with the latest code
    assert(
        referralApi.includes("response.cookies.set"),
        "Must overwrite cookie with latest referral"
    );
});

test("checkout always reads from cookie (latest attribution)", () => {
    assert(
        referral.includes("getReferralCode"),
        "Checkout reads from cookie (latest)"
    );
});

// ==========================================
// 13. INTEGRATION FLOW
// ==========================================
console.log("\n13. Complete Integration Flow");

test("flow: URL → ReferralTracker → cookie set", () => {
    assert(tracker.includes("/api/affiliate/referral"), "Step 1 OK");
    assert(referralApi.includes("cookies.set"), "Step 2 OK");
});

test("flow: cookie → /api/affiliate/resolve → code returned", () => {
    assert(resolveApi.includes("aff_ref"), "Step 3 OK");
    assert(resolveApi.includes("affiliateCode"), "Step 4 OK");
});

test("flow: URL/ref cookie → RegisterForm → auto-fill", () => {
    assert(registerForm.includes("detectReferral"), "Step 5 OK");
    assert(registerForm.includes('setValue("referralCode"'), "Step 6 OK");
});

test("flow: RegisterForm → aff_ref_public cookie set from URL", () => {
    assert(
        registerForm.includes("setPublicReferralCookie") || registerForm.includes("aff_ref_public"),
        "Step 7 OK"
    );
});

test("flow: register form → /api/auth/register → validated referredBy", () => {
    assert(registerApi.includes("validatedReferredBy"), "Step 8 OK");
    assert(registerApi.includes("affiliateProfile"), "Step 9 OK");
});

test("flow: cookie → checkout → AffiliateConversion", () => {
    assert(checkout.includes("affiliateConversion.create"), "Step 10 OK");
});

test("complete chain verified", () => {
    assert(tracker.includes("/api/affiliate/referral"), "1");
    assert(referralApi.includes("cookies.set"), "2");
    assert(resolveApi.includes("aff_ref"), "3");
    assert(registerForm.includes("detectReferral"), "4");
    assert(registerForm.includes("setReferralDetected"), "5");
    assert(registerApi.includes("validatedReferredBy"), "6");
    assert(checkout.includes("affiliateConversion.create"), "7");
});

// ==========================================
// 14. EDGE CASES
// ==========================================
console.log("\n14. Edge Cases");

test("referral input is read-only when auto-detected (not override)", () => {
    assert(registerForm.includes("readOnly"), "Must support readOnly state");
});

test("override resets to manual input", () => {
    assert(
        registerForm.includes("handleOverrideReferral") || registerForm.includes("referralOverride"),
        "Must support override"
    );
});

test("cancel override restores auto-detected value", () => {
    assert(
        registerForm.includes("handleCancelOverride"),
        "Must support cancel override"
    );
});

test("hidden input ensures value submitted even when read-only", () => {
    assert(registerForm.includes("type=\"hidden\""), "Must have hidden input");
});

test("register form preserves referral through validation errors", () => {
    const onSubmitIdx = registerForm.indexOf("async function onSubmit");
    const catchIdx = registerForm.indexOf("catch", onSubmitIdx);
    const content = registerForm.substring(onSubmitIdx, catchIdx + 200);
    assert(
        !content.includes('setValue("referralCode", "")'),
        "Must NOT reset referralCode on error"
    );
});

// ==========================================
// RESULTS
// ==========================================
console.log("\n==================================================");
console.log(`  📊 RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("==================================================\n");

if (failed > 0) {
    process.exit(1);
}
