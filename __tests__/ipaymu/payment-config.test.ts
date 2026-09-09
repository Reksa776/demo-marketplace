/**
 * iPaymu PAYMENT CONFIG REGRESSION TESTS
 *
 * Run: npx jest __tests__/ipaymu/payment-config.test.ts
 *
 * Verifies the FAIL-CLOSED iPaymu configuration resolver:
 *  - PAYMENT_ENVIRONMENT must be exactly sandbox|production
 *  - per-environment credentials, never mixed
 *  - base-URL allowlist (no SSRF / no cross-env routing)
 *  - production bans sandbox-VA reuse and localhost APP_URL
 *  - resolved config is frozen and memoized safely
 */

import {
    buildIpaymuConfig,
    getIpaymuConfig,
    resetIpaymuConfigCache,
    resolvePayEnvironment,
    PaymentConfigError,
    IPAYMU_SANDBOX_BASE_URL,
    IPAYMU_PRODUCTION_BASE_URL,
    type PayEnvironment,
} from "@/lib/payment/config";

const VALID_SANDBOX_VA = "1234567890";
const VALID_API_KEY = "PKEY_0123456789";

type Env = Record<string, string | undefined>;

function makeSandboxEnv(overrides: Env = {}): Env {
    return {
        PAYMENT_ENVIRONMENT: "sandbox",
        IPAYMU_SANDBOX_VA: VALID_SANDBOX_VA,
        IPAYMU_SANDBOX_API_KEY: VALID_API_KEY,
        ...overrides,
    };
}

function makeProductionEnv(overrides: Env = {}): Env {
    return {
        PAYMENT_ENVIRONMENT: "production",
        IPAYMU_PRODUCTION_VA: VALID_SANDBOX_VA,
        IPAYMU_PRODUCTION_API_KEY: VALID_API_KEY,
        NEXT_PUBLIC_APP_URL: "https://toko.example.com",
        ...overrides,
    };
}

describe("resolvePayEnvironment", () => {
    test("accepts exactly 'sandbox'", () => {
        expect(resolvePayEnvironment("sandbox")).toBe("sandbox");
    });

    test("accepts exactly 'production'", () => {
        expect(resolvePayEnvironment("production")).toBe("production");
    });

    test("rejects missing value (fail-closed, no default)", () => {
        expect(() => resolvePayEnvironment(undefined)).toThrow(
            PaymentConfigError
        );
        expect(() => resolvePayEnvironment(undefined)).toThrow(
            /PAYMENT_ENVIRONMENT/
        );
    });

    test("rejects empty string", () => {
        expect(() => resolvePayEnvironment("")).toThrow(PaymentConfigError);
    });

    test("rejects unknown values", () => {
        for (const bad of ["staging", "PRODUCTION", "Production", "prod", "true"]) {
            expect(() => resolvePayEnvironment(bad)).toThrow(
                PaymentConfigError
            );
        }
    });

    test("rejects whitespace-padded values", () => {
        expect(() => resolvePayEnvironment(" sandbox")).toThrow(
            PaymentConfigError
        );
        expect(() => resolvePayEnvironment("production ")).toThrow(
            PaymentConfigError
        );
    });

    test("infers PayEnvironment type", () => {
        const env: PayEnvironment = resolvePayEnvironment("sandbox");
        expect(env).toBe("sandbox");
    });
});

describe("buildIpaymuConfig — sandbox", () => {
    test("builds valid config with defaults", () => {
        const cfg = buildIpaymuConfig(makeSandboxEnv());
        expect(cfg.environment).toBe("sandbox");
        expect(cfg.va).toBe(VALID_SANDBOX_VA);
        expect(cfg.apiKey).toBe(VALID_API_KEY);
        expect(cfg.baseUrl).toBe(IPAYMU_SANDBOX_BASE_URL);
    });

    test("allows explicit allowlisted sandbox base URL", () => {
        const cfg = buildIpaymuConfig(
            makeSandboxEnv({
                IPAYMU_SANDBOX_BASE_URL: IPAYMU_SANDBOX_BASE_URL,
            })
        );
        expect(cfg.baseUrl).toBe(IPAYMU_SANDBOX_BASE_URL);
    });

    test("rejects attacker-controlled base URL (SSRF guard)", () => {
        for (const bad of [
            "http://evil.example.com",
            "https://my.ipaymu.com.evil.com",
            "https://sandbox.ipaymu.com.evil.com",
            "http://localhost:3000",
        ]) {
            expect(() =>
                buildIpaymuConfig(
                    makeSandboxEnv({ IPAYMU_SANDBOX_BASE_URL: bad })
                )
            ).toThrow(PaymentConfigError);
        }
    });

    test("rejects missing VA", () => {
        expect(() =>
            buildIpaymuConfig(
                makeSandboxEnv({ IPAYMU_SANDBOX_VA: "" })
            )
        ).toThrow(/IPAYMU_SANDBOX_VA is not set/);
    });

    test("rejects non-numeric or wrong-length VA", () => {
        for (const badVa of ["abc", "123", "123456789012345678901"]) {
            expect(() =>
                buildIpaymuConfig(
                    makeSandboxEnv({ IPAYMU_SANDBOX_VA: badVa })
                )
            ).toThrow(PaymentConfigError);
        }
    });

    test("rejects missing or short API key", () => {
        expect(() =>
            buildIpaymuConfig(
                makeSandboxEnv({ IPAYMU_SANDBOX_API_KEY: "" })
            )
        ).toThrow(/IPAYMU_SANDBOX_API_KEY is not set/);

        expect(() =>
            buildIpaymuConfig(
                makeSandboxEnv({ IPAYMU_SANDBOX_API_KEY: "short" })
            )
        ).toThrow(PaymentConfigError);
    });

    test("error message does not leak the API key value", () => {
        try {
            buildIpaymuConfig(
                makeSandboxEnv({
                    IPAYMU_SANDBOX_API_KEY: "ab12cd",
                })
            );
            throw new Error("config should have failed");
        } catch (e) {
            expect(e).toBeInstanceOf(PaymentConfigError);
            expect(String(e)).not.toContain("ab12cd");
            expect(String(e)).not.toContain("SUPERSECRETKEY123");
        }
    });
});

describe("buildIpaymuConfig — production", () => {
    test("builds valid production config", () => {
        const cfg = buildIpaymuConfig(makeProductionEnv());
        expect(cfg.environment).toBe("production");
        expect(cfg.baseUrl).toBe(IPAYMU_PRODUCTION_BASE_URL);
    });

    test("production never reads sandbox credentials", () => {
        const cfg = buildIpaymuConfig(
            makeProductionEnv({
                IPAYMU_SANDBOX_VA: "9999888877",
                IPAYMU_SANDBOX_API_KEY: "SANDBOX_KEY_12345",
            })
        );
        expect(cfg.va).toBe(VALID_SANDBOX_VA);
        expect(cfg.apiKey).toBe(VALID_API_KEY);
    });

    test("rejects reusing sandbox VA in production", () => {
        expect(() =>
            buildIpaymuConfig(
                makeProductionEnv({
                    IPAYMU_PRODUCTION_VA: "9999888877",
                    IPAYMU_SANDBOX_VA: "9999888877",
                })
            )
        ).toThrow(/must not be reused/);
    });

    test("rejects missing NEXT_PUBLIC_APP_URL in production", () => {
        expect(() =>
            buildIpaymuConfig(
                makeProductionEnv({ NEXT_PUBLIC_APP_URL: "" })
            )
        ).toThrow(/NEXT_PUBLIC_APP_URL/);
    });

    test("rejects localhost APP_URL in production", () => {
        for (const badUrl of [
            "http://localhost:3000",
            "https://localhost",
            "http://127.0.0.1:3000",
            "https://toko.sandbox.example.com",
        ]) {
            expect(() =>
                buildIpaymuConfig(
                    makeProductionEnv({ NEXT_PUBLIC_APP_URL: badUrl })
                )
            ).toThrow(PaymentConfigError);
        }
    });

    test("rejects sandbox base URL in production", () => {
        expect(() =>
            buildIpaymuConfig(
                makeProductionEnv({
                    IPAYMU_PRODUCTION_BASE_URL: IPAYMU_SANDBOX_BASE_URL,
                })
            )
        ).toThrow(PaymentConfigError);
    });
});

describe("buildIpaymuConfig — cross-environment isolation", () => {
    test("sandbox key + production key coexist without mixing", () => {
        const cfg = buildIpaymuConfig({
            PAYMENT_ENVIRONMENT: "sandbox",
            IPAYMU_SANDBOX_VA: "1111111111",
            IPAYMU_SANDBOX_API_KEY: "sandbox-key-abcdefgh",
            IPAYMU_PRODUCTION_VA: "2222222222",
            IPAYMU_PRODUCTION_API_KEY: "production-key-abcdefgh",
        });
        expect(cfg.va).toBe("1111111111");
    });

    test("config object is frozen", () => {
        const cfg = buildIpaymuConfig(makeSandboxEnv());
        expect(Object.isFrozen(cfg)).toBe(true);
    });
});

describe("getIpaymuConfig / resetIpaymuConfigCache", () => {
    const oldEnv = { ...process.env };

    afterEach(() => {
        resetIpaymuConfigCache();
        process.env = { ...oldEnv };
    });

    test("throws when PAYMENT_ENVIRONMENT not set (fail-closed)", () => {
        delete process.env.PAYMENT_ENVIRONMENT;
        process.env.IPAYMU_API_KEY = VALID_API_KEY;
        process.env.IPAYMU_VA = VALID_SANDBOX_VA;
        expect(() => getIpaymuConfig()).toThrow(PaymentConfigError);
    });

    test("memoizes the resolved config", () => {
        process.env = {
            ...process.env,
            PAYMENT_ENVIRONMENT: "sandbox",
            IPAYMU_SANDBOX_VA: VALID_SANDBOX_VA,
            IPAYMU_SANDBOX_API_KEY: VALID_API_KEY,
        };
        const a = getIpaymuConfig();
        const b = getIpaymuConfig();
        expect(a).toBe(b);
    });

    test("resetIpaymuConfigCache forces re-resolution", () => {
        process.env = {
            ...process.env,
            PAYMENT_ENVIRONMENT: "sandbox",
            IPAYMU_SANDBOX_VA: VALID_SANDBOX_VA,
            IPAYMU_SANDBOX_API_KEY: VALID_API_KEY,
        };
        const first = getIpaymuConfig();
        const memoized = getIpaymuConfig();
        expect(memoized).toBe(first); // memoized while cache is warm

        resetIpaymuConfigCache();
        const rebuilt = getIpaymuConfig();
        expect(rebuilt).not.toBe(first); // NEW object after reset
        expect(rebuilt).toEqual(first); // same content
    });

    test("re-resolves after environment flips sandbox → production", () => {
        process.env = {
            ...process.env,
            PAYMENT_ENVIRONMENT: "sandbox",
            IPAYMU_SANDBOX_VA: VALID_SANDBOX_VA,
            IPAYMU_SANDBOX_API_KEY: VALID_API_KEY,
        };
        getIpaymuConfig();
        resetIpaymuConfigCache();

        // Use a different VA for production so the sandbox-reuse
        // guard does not fire for this test.
        process.env = {
            ...process.env,
            PAYMENT_ENVIRONMENT: "production",
            IPAYMU_PRODUCTION_VA: "2222222222",
            IPAYMU_PRODUCTION_API_KEY: VALID_API_KEY,
            NEXT_PUBLIC_APP_URL: "https://toko.example.com",
        };
        const cfg = getIpaymuConfig();
        expect(cfg.environment).toBe("production");
    });
});