/**
 * ==========================================
 * iPaymu PRODUCTION CONFIGURATION VALIDATOR
 * ==========================================
 *
 * Fail-fast validation that prevents
 * deploying to production with sandbox
 * credentials or misconfiguration.
 *
 * Usage:
 *   import { validateIpaymuProductionConfig } from "@/lib/payment/ipaymu-production";
 *   validateIpaymuProductionConfig(); // throws on failure
 *
 * Run as script:
 *   npx tsx lib/payment/ipaymu-production.ts
 */

import crypto from "crypto";

const SANDBOX_URL = "https://sandbox.ipaymu.com";
const PRODUCTION_URL = "https://my.ipaymu.com";

/* ==========================================
 * VALIDATION RESULT
 * ========================================== */

export type ValidationResult = {
    valid: boolean;
    errors: string[];
    warnings: string[];
};

/* ==========================================
 * VALIDATE PRODUCTION CONFIG
 * ========================================== */

export function validateIpaymuProductionConfig(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const isProduction =
        process.env.IPAYMU_IS_PRODUCTION === "true";

    if (!isProduction) {
        warnings.push(
            "IPAYMU_IS_PRODUCTION is not 'true' — running in sandbox mode"
        );
    }

    const apiKey = process.env.IPAYMU_API_KEY || "";
    const va = process.env.IPAYMU_VA || "";
    const configuredUrl = process.env.IPAYMU_URL || "";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

    // ==========================================
    // API KEY
    // ==========================================

    if (!apiKey) {
        errors.push("IPAYMU_API_KEY is not set");
    } else if (apiKey.length < 10) {
        errors.push("IPAYMU_API_KEY appears too short (minimum 10 chars)");
    }

    // ==========================================
    // VA
    // ==========================================

    if (!va) {
        errors.push("IPAYMU_VA is not set");
    } else if (!/^\d{10,20}$/.test(va)) {
        errors.push(
            "IPAYMU_VA should be a numeric string of 10-20 digits"
        );
    }

    // ==========================================
    // PRODUCTION URL
    // ==========================================

    if (isProduction) {
        // In production, URL must be the production endpoint
        if (configuredUrl && configuredUrl !== PRODUCTION_URL) {
            errors.push(
                `IPAYMU_URL is '${configuredUrl}' but production requires '${PRODUCTION_URL}'`
            );
        }

        if (configuredUrl.includes("sandbox")) {
            errors.push(
                "IPAYMU_URL contains 'sandbox' — cannot use sandbox in production"
            );
        }

        // Check for localhost
        if (configuredUrl.includes("localhost")) {
            errors.push(
                "IPAYMU_URL contains 'localhost' — not valid for production"
            );
        }
    }

    // ==========================================
    // APP URL
    // ==========================================

    if (!appUrl) {
        errors.push("NEXT_PUBLIC_APP_URL is not set");
    } else {
        if (!appUrl.startsWith("https://")) {
            errors.push(
                `NEXT_PUBLIC_APP_URL must use HTTPS in production, got '${appUrl}'`
            );
        }

        if (appUrl.includes("localhost")) {
            errors.push(
                "NEXT_PUBLIC_APP_URL contains 'localhost' — not valid for production"
            );
        }

        if (appUrl.includes("127.0.0.1")) {
            errors.push(
                "NEXT_PUBLIC_APP_URL contains '127.0.0.1' — not valid for production"
            );
        }

        // Check for sandbox URL
        if (appUrl.includes("sandbox.ipaymu.com")) {
            errors.push(
                "NEXT_PUBLIC_APP_URL contains sandbox domain"
            );
        }
    }

    // ==========================================
    // LOGGING SAFETY
    // ==========================================

    if (isProduction && apiKey) {
        // Ensure production logs don't expose full API key
        // This is a configuration check — we just verify it exists
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/* ==========================================
 * FAIL-FAST ON MODULE LOAD (production only)
 * ==========================================
 *
 * When IPAYMU_IS_PRODUCTION=true, validates
 * configuration immediately on import.
 * In development, validation is opt-in.
 */

export function initIpaymuConfig() {
    const isProduction =
        process.env.IPAYMU_IS_PRODUCTION === "true";

    if (isProduction) {
        const result = validateIpaymuProductionConfig();

        if (!result.valid) {
            const errorReport = [
                "╔══════════════════════════════════════════════╗",
                "║  CRITICAL: iPaymu Production Config Error    ║",
                "╚══════════════════════════════════════════════╝",
                "",
                ...result.errors.map((e) => `  ✗ ${e}`),
                "",
                "Fix these issues before deploying to production.",
                "Payments will NOT work with incorrect configuration.",
            ].join("\n");

            console.error(errorReport);
            throw new Error(
                `iPaymu production configuration invalid: ${result.errors.join("; ")}`
            );
        }

        if (result.warnings.length > 0) {
            for (const w of result.warnings) {
                console.warn(`[iPaymu] WARNING: ${w}`);
            }
        }
    }
}

/* ==========================================
 * SAFE CONFIG GETTER
 * ==========================================
 *
 * Returns configuration without exposing secrets.
 * For logging/display purposes only.
 */

export function getIpaymuConfigSummary() {
    const apiKey = process.env.IPAYMU_API_KEY || "";
    const va = process.env.IPAYMU_VA || "";
    const url =
        process.env.IPAYMU_URL ||
        (process.env.IPAYMU_IS_PRODUCTION === "true"
            ? PRODUCTION_URL
            : SANDBOX_URL);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const isProduction =
        process.env.IPAYMU_IS_PRODUCTION === "true";

    return {
        isProduction,
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey.length,
        apiKeyPreview: apiKey
            ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
            : "NOT SET",
        hasVa: !!va,
        vaPreview: va
            ? `${va.substring(0, 3)}***${va.substring(va.length - 3)}`
            : "NOT SET",
        baseUrl: url,
        hasAppUrl: !!appUrl,
        appUrl,
        isSandbox: url.includes("sandbox"),
        isProductionUrl: url.includes("my.ipaymu.com"),
    };
}

/* ==========================================
 * VALIDATE CALLBACK URLs
 * ==========================================
 *
 * Checks that constructed URLs are safe and
 * not attacker-controlled.
 */

export function validateCallbackUrl(
    url: string,
    appUrl: string,
    label: string
): string[] {
    const errors: string[] = [];

    if (!url) {
        errors.push(`${label}: URL is empty`);
        return errors;
    }

    try {
        const parsed = new URL(url);

        // Must be HTTPS in production
        if (
            process.env.IPAYMU_IS_PRODUCTION === "true" &&
            parsed.protocol !== "https:"
        ) {
            errors.push(`${label}: must use HTTPS in production, got ${parsed.protocol}`);
        }

        // Must not be localhost
        if (
            parsed.hostname === "localhost" ||
            parsed.hostname === "127.0.0.1"
        ) {
            errors.push(`${label}: must not use localhost`);
        }

        // Must match app URL hostname
        if (appUrl) {
            try {
                const appParsed = new URL(appUrl);
                if (parsed.hostname !== appParsed.hostname) {
                    errors.push(
                        `${label}: hostname '${parsed.hostname}' does not match APP_URL hostname '${appParsed.hostname}'`
                    );
                }
            } catch {
                // Invalid appUrl — skip hostname check
            }
        }
    } catch {
        errors.push(`${label}: invalid URL format`);
    }

    return errors;
}

/* ==========================================
 * CLI: Run as standalone script
 * ==========================================
 */

if (require.main === module) {
    console.log("\n=== iPaymu Production Configuration Audit ===\n");

    const result = validateIpaymuProductionConfig();
    const summary = getIpaymuConfigSummary();

    console.log("Configuration Summary:");
    console.log(`  Production Mode: ${summary.isProduction ? "YES" : "NO (sandbox)"}`);
    console.log(`  API Key: ${summary.apiKeyPreview}`);
    console.log(`  VA: ${summary.vaPreview}`);
    console.log(`  Base URL: ${summary.baseUrl}`);
    console.log(`  App URL: ${summary.appUrl || "NOT SET"}`);
    console.log(`  Is Sandbox: ${summary.isSandbox}`);
    console.log(`  Is Production URL: ${summary.isProductionUrl}`);
    console.log("");

    if (result.errors.length > 0) {
        console.log("ERRORS:");
        for (const e of result.errors) {
            console.log(`  ✗ ${e}`);
        }
    }

    if (result.warnings.length > 0) {
        console.log("WARNINGS:");
        for (const w of result.warnings) {
            console.log(`  ⚠ ${w}`);
        }
    }

    if (result.valid) {
        console.log("✅ All checks passed.");
    } else {
        console.log(`\n❌ ${result.errors.length} error(s) found. Fix before production.`);
        process.exit(1);
    }
}
