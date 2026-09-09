/**
 * ==========================================
 * PAYMENT PROVIDER CONFIGURATION
 * ==========================================
 *
 * Single source of truth for the iPaymu customer-payment
 * integration. Replaces the old ad-hoc `IPAYMU_CONFIG`
 * object with a STRICT, FAIL-CLOSED resolver.
 *
 * Environment model (NO fallback, NO default):
 *
 *   PAYMENT_ENVIRONMENT = sandbox | production
 *
 *   sandbox:
 *     IPAYMU_SANDBOX_BASE_URL  (optional, default https://sandbox.ipaymu.com)
 *     IPAYMU_SANDBOX_VA
 *     IPAYMU_SANDBOX_API_KEY
 *
 *   production:
 *     IPAYMU_PRODUCTION_BASE_URL (optional, default https://my.ipaymu.com)
 *     IPAYMU_PRODUCTION_VA
 *     IPAYMU_PRODUCTION_API_KEY
 *
 * Rules:
 * - If PAYMENT_ENVIRONMENT is missing/invalid → payment operations THROW.
 * - Credentials are only read for the selected environment; sandbox and
 *   production credential sets are never mixed.
 * - Base URL must be in a per-environment allowlist (prevents SSRF / money
 *   being routed to an attacker-controlled host). If the operator provides
 *   a base URL it MUST match the allowlist for that environment.
 * - Production ignores sandbox credentials and rejects VA reuse.
 * - The resolved object is frozen; nothing may mutate it at runtime.
 * - Secrets are NEVER logged.
 */

export type PayEnvironment = "sandbox" | "production";

export type IpaymuConfig = {
    environment: PayEnvironment;
    baseUrl: string;
    va: string;
    apiKey: string;
};

export const IPAYMU_SANDBOX_BASE_URL = "https://sandbox.ipaymu.com";
export const IPAYMU_PRODUCTION_BASE_URL = "https://my.ipaymu.com";

const ALLOWED_BASE_URLS: Record<PayEnvironment, string[]> = {
    sandbox: [IPAYMU_SANDBOX_BASE_URL],
    production: [IPAYMU_PRODUCTION_BASE_URL],
};

const ENV_VARS: Record<
    PayEnvironment,
    { va: string; apiKey: string; baseUrl: string }
> = {
    sandbox: {
        va: "IPAYMU_SANDBOX_VA",
        apiKey: "IPAYMU_SANDBOX_API_KEY",
        baseUrl: "IPAYMU_SANDBOX_BASE_URL",
    },
    production: {
        va: "IPAYMU_PRODUCTION_VA",
        apiKey: "IPAYMU_PRODUCTION_API_KEY",
        baseUrl: "IPAYMU_PRODUCTION_BASE_URL",
    },
};

export class PaymentConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PaymentConfigError";
    }
}

type Env = Record<string, string | undefined>;

/**
 * Resolve the payment environment.
 *
 * FAIL-CLOSED: anything other than exactly "sandbox" or "production"
 * is a configuration error. There is intentionally no default — an
 * operator that forgets to set PAYMENT_ENVIRONMENT must not silently
 * send money through the sandbox in production.
 */
export function resolvePayEnvironment(
    raw: string | undefined
): PayEnvironment {
    if (raw === "sandbox") return "sandbox";
    if (raw === "production") return "production";
    throw new PaymentConfigError(
        "PAYMENT_ENVIRONMENT must be exactly 'sandbox' or 'production' " +
            `(got '${raw || ""}'). No fallback is allowed — set it explicitly.`
    );
}

/**
 * Build a validated, frozen iPaymu config from an environment object.
 *
 * Pure function (no global state) so it can be tested with arbitrary
 * environment maps.
 *
 * @param env - Environment variables (defaults to process.env)
 * @returns Frozen IpaymuConfig
 * @throws PaymentConfigError describing every missing/invalid field
 */
export function buildIpaymuConfig(
    env: Env = process.env as unknown as Env
): IpaymuConfig {
    const environment = resolvePayEnvironment(env.PAYMENT_ENVIRONMENT);

    const names = ENV_VARS[environment];
    const va = (env[names.va] ?? "").trim();
    const apiKey = (env[names.apiKey] ?? "").trim();
    const baseUrlRaw = (env[names.baseUrl] ?? "").trim();
    const baseUrl =
        baseUrlRaw ||
        (environment === "sandbox"
            ? IPAYMU_SANDBOX_BASE_URL
            : IPAYMU_PRODUCTION_BASE_URL);

    const errors: string[] = [];

    // ==========================================
    // VA VALIDATION
    // ==========================================
    if (!va) {
        errors.push(`${names.va} is not set`);
    } else if (!/^\d{10,20}$/.test(va)) {
        errors.push(
            `${names.va} should be a numeric string of 10-20 digits`
        );
    }

    // ==========================================
    // API KEY VALIDATION
    // ==========================================
    if (!apiKey) {
        errors.push(`${names.apiKey} is not set`);
    } else if (apiKey.length < 10) {
        errors.push(
            `${names.apiKey} appears too short (minimum 10 chars)`
        );
    }

    // ==========================================
    // BASE URL ALLOWLIST
    // ==========================================
    if (!ALLOWED_BASE_URLS[environment].includes(baseUrl)) {
        errors.push(
            `${names.baseUrl} '${baseUrl}' is not allowed for ${environment}; ` +
                `expected one of: ${ALLOWED_BASE_URLS[environment].join(", ")}`
        );
    }

    // ==========================================
    // PRODUCTION-SPECIFIC SAFETY
    // ==========================================
    if (environment === "production") {
        // Never allow sandbox credential reuse in production
        const sandboxVa = (env.IPAYMU_SANDBOX_VA ?? "").trim();
        if (sandboxVa && sandboxVa === va) {
            errors.push(
                "IPAYMU_SANDBOX_VA must not be reused as the production VA"
            );
        }

        // App URL must exist and not reference localhost/sandbox
        const appUrl = env.NEXT_PUBLIC_APP_URL || "";
        if (!appUrl) {
            errors.push("NEXT_PUBLIC_APP_URL is not set");
        } else if (
            appUrl.includes("localhost") ||
            appUrl.includes("127.0.0.1") ||
            appUrl.includes("sandbox")
        ) {
            errors.push(
                "NEXT_PUBLIC_APP_URL must not reference localhost/sandbox in production"
            );
        }
    }

    if (errors.length > 0) {
        throw new PaymentConfigError(
            `iPaymu configuration invalid: ${errors.join("; ")}`
        );
    }

    return Object.freeze({ environment, baseUrl, va, apiKey });
}

/* ==========================================
 * CACHED GETTER (process.env)
 * ==========================================
 *
 * Memoized so each serverless warm container resolves the
 * config only once. Throws PaymentConfigError on first use
 * when the server is misconfigured — payment operations
 * fail closed instead of silently using the wrong endpoint.
 */

let cachedConfig: IpaymuConfig | null = null;

export function getIpaymuConfig(
    env: Env = process.env as unknown as Env
): IpaymuConfig {
    if (!cachedConfig) {
        cachedConfig = buildIpaymuConfig(env);
    }
    return cachedConfig;
}

/** Test-only: clear the memoized config between test cases. */
export function resetIpaymuConfigCache(): void {
    cachedConfig = null;
}