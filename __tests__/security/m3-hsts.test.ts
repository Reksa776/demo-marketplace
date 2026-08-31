/**
 * ==========================================
 * M3 SECURITY TEST — HSTS Global Application
 * ==========================================
 *
 * Verifies that Strict-Transport-Security is
 * applied to ALL responses globally, not just
 * /api routes.
 *
 * Attack scenario: SSL stripping on non-API pages
 * (login, checkout, etc.) during first visit.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

function readConfig(): string {
    return readFileSync(
        resolve(process.cwd(), "next.config.ts"),
        "utf-8"
    );
}

/* ==========================================
 * TESTS
 * ========================================== */

describe("M3 — HSTS Configuration Audit", () => {
    let config: string;

    beforeAll(() => {
        config = readConfig();
    });

    test("HSTS header exists in configuration", () => {
        expect(config).toContain("Strict-Transport-Security");
    });

    test("HSTS value includes max-age=31536000 (1 year)", () => {
        expect(config).toContain("max-age=31536000");
    });

    test("HSTS value includes includeSubDomains", () => {
        expect(config).toContain("includeSubDomains");
    });

    test("HSTS is in the global /(.*) source, NOT restricted to /api", () => {
        // Find the HSTS header definition
        const hstsIdx = config.indexOf("Strict-Transport-Security");
        expect(hstsIdx).toBeGreaterThan(-1);

        // Find the source pattern that contains HSTS
        // It should be in the /(.*) block, not /api/(.*)
        const globalSourceIdx = config.indexOf('source: "/(.*)"');
        expect(globalSourceIdx).toBeGreaterThan(-1);

        // HSTS should come AFTER the global source pattern
        // (i.e., it's within the global headers block)
        expect(hstsIdx).toBeGreaterThan(globalSourceIdx);
    });

    test("No separate /api-only HSTS block exists", () => {
        // The old config had a separate block:
        //   source: "/api/(.*)"
        //   headers: [{ key: "Strict-Transport-Security", ... }]
        // This should no longer exist as a separate block
        const apiHstsPattern = /source:\s*["']\/api\/\(\.\*\)["'][\s\S]*?Strict-Transport-Security/;
        expect(config).not.toMatch(apiHstsPattern);
    });

    test("Comment no longer says 'HSTS only for API routes'", () => {
        expect(config).not.toContain(
            "HSTS only for API routes"
        );
    });

    test("No duplicate Strict-Transport-Security definitions", () => {
        const matches = config.match(
            /Strict-Transport-Security/g
        );
        // Should appear exactly once (in the header key)
        expect(matches).toHaveLength(1);
    });

    test("Other security headers still present in global block", () => {
        expect(config).toContain("X-Content-Type-Options");
        expect(config).toContain("nosniff");
        expect(config).toContain("X-Frame-Options");
        expect(config).toContain("DENY");
        expect(config).toContain("Referrer-Policy");
        expect(config).toContain("X-XSS-Protection");
        expect(config).toContain("Permissions-Policy");
    });
});

/* ==========================================
 * OUTGOING SIGNATURE UNCHANGED
 * ========================================== */

describe("M3 — No regression to other fixes", () => {
    test("iPaymu outgoing signature still works", async () => {
        const { generateSignature } = await import(
            "@/lib/payment/ipaymu"
        );
        const sig = generateSignature(
            '{"amount":10000}',
            "1179000899",
            "test-key"
        );
        expect(sig).toMatch(/^[a-f0-9]{64}$/);
    });

    test("getClientIp still works after M2 fix", async () => {
        const { getClientIp } = await import(
            "@/lib/rate-limit"
        );
        const req = new Request("https://example.com", {
            headers: { "x-forwarded-for": "1.2.3.4" },
        });
        // Without TRUSTED_PROXY, should return "untrusted"
        delete process.env.TRUSTED_PROXY;
        const ip = getClientIp(req);
        expect(ip).toBe("untrusted");
    });
});
