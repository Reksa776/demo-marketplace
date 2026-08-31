/**
 * ==========================================
 * M2 SECURITY TEST — IP-Spoofable Rate Limiting
 * ==========================================
 *
 * Verifies that getClientIp() does NOT trust
 * attacker-controlled forwarding headers unless
 * TRUSTED_PROXY is configured.
 *
 * Attack scenarios tested:
 * A. Spoof x-forwarded-for to bypass rate limit
 * B. Spoof x-real-ip to bypass rate limit
 * C. Rotate spoofed forwarded IP values
 * D. Send multiple forwarding headers
 * E. Legitimate traffic still works
 * F. Missing IP info cannot bypass limiter
 */

import { getClientIp, checkRateLimit } from "../../lib/rate-limit";

/* ==========================================
 * HELPERS
 * ========================================== */

function makeRequest(
    headers: Record<string, string> = {}
): Request {
    return new Request("https://example.com/api/test", {
        method: "POST",
        headers,
    });
}

/* ==========================================
 * SAVE/RESTORE ENV
 * ========================================== */

const originalEnv = process.env.TRUSTED_PROXY;

afterEach(() => {
    // Restore env after each test
    if (originalEnv === undefined) {
        delete process.env.TRUSTED_PROXY;
    } else {
        process.env.TRUSTED_PROXY = originalEnv;
    }
});

/* ==========================================
 * TESTS — WITHOUT TRUSTED_PROXY (default)
 * ========================================== */

describe("M2 — getClientIp WITHOUT TRUSTED_PROXY (default)", () => {
    beforeEach(() => {
        delete process.env.TRUSTED_PROXY;
    });

    test("Spoofed x-forwarded-for is IGNORED", () => {
        const req = makeRequest({
            "x-forwarded-for": "1.2.3.4, 10.0.0.1",
        });
        const ip = getClientIp(req);
        expect(ip).toBe("untrusted");
    });

    test("Spoofed x-real-ip is IGNORED", () => {
        const req = makeRequest({
            "x-real-ip": "5.6.7.8",
        });
        const ip = getClientIp(req);
        expect(ip).toBe("untrusted");
    });

    test("Both forwarding headers spoofed — still untrusted", () => {
        const req = makeRequest({
            "x-forwarded-for": "1.2.3.4",
            "x-real-ip": "5.6.7.8",
        });
        const ip = getClientIp(req);
        expect(ip).toBe("untrusted");
    });

    test("No headers at all — returns untrusted", () => {
        const req = makeRequest({});
        const ip = getClientIp(req);
        expect(ip).toBe("untrusted");
    });

    test("Attacker rotating IPs via x-forwarded-for — all ignored", () => {
        const ips = ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"];
        const results = ips.map((ip) => {
            const req = makeRequest({ "x-forwarded-for": ip });
            return getClientIp(req);
        });
        // All should be "untrusted" — attacker cannot get unique buckets
        expect(results.every((r) => r === "untrusted")).toBe(true);
    });

    test("Multiple x-forwarded-for values — all ignored", () => {
        const req = makeRequest({
            "x-forwarded-for":
                "1.2.3.4, 10.0.0.1, 192.168.1.1, 172.16.0.1",
        });
        const ip = getClientIp(req);
        expect(ip).toBe("untrusted");
    });
});

/* ==========================================
 * TESTS — WITH TRUSTED_PROXY
 * ========================================== */

describe("M2 — getClientIp WITH TRUSTED_PROXY configured", () => {
    beforeEach(() => {
        process.env.TRUSTED_PROXY = "10.0.0.1";
    });

    test("x-forwarded-for is TRUSTED when proxy configured", () => {
        const req = makeRequest({
            "x-forwarded-for": "1.2.3.4, 10.0.0.1",
        });
        const ip = getClientIp(req);
        expect(ip).toBe("1.2.3.4");
    });

    test("x-real-ip is TRUSTED when proxy configured", () => {
        const req = makeRequest({
            "x-real-ip": "5.6.7.8",
        });
        const ip = getClientIp(req);
        expect(ip).toBe("5.6.7.8");
    });

    test("x-forwarded-for takes precedence over x-real-ip", () => {
        const req = makeRequest({
            "x-forwarded-for": "1.2.3.4",
            "x-real-ip": "5.6.7.8",
        });
        const ip = getClientIp(req);
        expect(ip).toBe("1.2.3.4");
    });

    test("No forwarding headers — returns untrusted", () => {
        const req = makeRequest({});
        const ip = getClientIp(req);
        expect(ip).toBe("untrusted");
    });

    test("Multiple IPs in x-forwarded-for — first one is client", () => {
        const req = makeRequest({
            "x-forwarded-for":
                "203.0.113.50, 10.0.0.1, 172.16.0.1",
        });
        const ip = getClientIp(req);
        expect(ip).toBe("203.0.113.50");
    });
});

/* ==========================================
 * RATE LIMIT ENFORCEMENT TESTS
 * ========================================== */

describe("M2 — Rate limit enforcement with untrusted IP", () => {
    beforeEach(() => {
        delete process.env.TRUSTED_PROXY;
    });

    test("All spoofed requests share the same 'untrusted' bucket", () => {
        // Without trusted proxy, all requests go to "untrusted" bucket
        // Rate limit should still work — just shared across all clients
        const key = "test-m2:untrusted";

        // First request should be allowed
        const result1 = checkRateLimit(key, 3, 60000);
        expect(result1.allowed).toBe(true);
        expect(result1.remaining).toBe(2);

        // Second request
        const result2 = checkRateLimit(key, 3, 60000);
        expect(result2.allowed).toBe(true);
        expect(result2.remaining).toBe(1);

        // Third request
        const result3 = checkRateLimit(key, 3, 60000);
        expect(result3.allowed).toBe(true);
        expect(result3.remaining).toBe(0);

        // Fourth request — rate limited
        const result4 = checkRateLimit(key, 3, 60000);
        expect(result4.allowed).toBe(false);
        expect(result4.remaining).toBe(0);
    });

    test("Spoofed IPs do not create separate rate limit buckets", () => {
        // Simulate attacker sending requests with different spoofed IPs
        // Without TRUSTED_PROXY, all should hit the same bucket
        const requests = [
            makeRequest({ "x-forwarded-for": "1.1.1.1" }),
            makeRequest({ "x-forwarded-for": "2.2.2.2" }),
            makeRequest({ "x-forwarded-for": "3.3.3.3" }),
        ];

        const ips = requests.map((r) => getClientIp(r));

        // All should be "untrusted"
        expect(ips).toEqual([
            "untrusted",
            "untrusted",
            "untrusted",
        ]);

        // All share the same rate limit bucket
        const key = "test-m2:shared";
        const results = [];
        for (let i = 0; i < 5; i++) {
            results.push(checkRateLimit(key, 3, 60000));
        }

        // First 3 allowed, then rate limited
        expect(results.filter((r) => r.allowed).length).toBe(3);
        expect(results.filter((r) => !r.allowed).length).toBe(2);
    });
});

/* ==========================================
 * LEGITIMATE TRAFFIC TEST
 * ========================================== */

describe("M2 — Legitimate traffic", () => {
    test("Legitimate requests without forwarding headers still work", () => {
        delete process.env.TRUSTED_PROXY;

        const req = makeRequest({});
        const ip = getClientIp(req);

        // Should return "untrusted" — not crash or return undefined
        expect(ip).toBe("untrusted");
        expect(typeof ip).toBe("string");
    });

    test("Legitimate requests with TRUSTED_PROXY still work", () => {
        process.env.TRUSTED_PROXY = "10.0.0.1";

        const req = makeRequest({
            "x-forwarded-for": "203.0.113.50, 10.0.0.1",
        });
        const ip = getClientIp(req);

        expect(ip).toBe("203.0.113.50");
    });
});

/* ==========================================
 * OUTGOING IPAYMU SIGNATURE UNCHANGED
 * ========================================== */

describe("M2 — Outgoing iPaymu signature unaffected", () => {
    test("generateSignature still works correctly", async () => {
        const { generateSignature } = await import(
            "@/lib/payment/ipaymu"
        );

        const body =
            '{"product":["Test"],"qty":["1"],"price":["10000"],"amount":10000}';
        const sig = generateSignature(
            body,
            "1179000899",
            "test-key"
        );

        expect(sig).toMatch(/^[a-f0-9]{64}$/);
    });
});
