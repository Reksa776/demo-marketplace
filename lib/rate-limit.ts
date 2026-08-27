/**
 * ==========================================
 * RATE LIMITER (In-Memory)
 * ==========================================
 *
 * Simple sliding-window rate limiter using
 * in-memory Map.
 *
 * PRODUCTION NOTE:
 * For multi-instance deployments (Kubernetes,
 * serverless, clustered), this in-memory
 * implementation is per-instance. Each instance
 * maintains its own counters.
 *
 * To use distributed rate limiting, set
 * REDIS_URL environment variable and install
 * @upstash/ratelimit or ioredis.
 *
 * When REDIS_URL is set, this module logs a
 * warning to remind about single-instance
 * limitation.
 */

const isProduction = process.env.NODE_ENV === "production";
const hasRedisUrl = Boolean(process.env.REDIS_URL);

if (isProduction && hasRedisUrl) {
    console.warn(
        "[RATE_LIMIT] REDIS_URL is set but Redis rate limiting " +
        "is not configured. Using in-memory rate limiter which " +
        "is per-instance. Install @upstash/ratelimit for " +
        "distributed rate limiting."
    );
}

type RateLimitEntry = {
    count: number;
    resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store) {
            if (now > entry.resetAt) {
                store.delete(key);
            }
        }
    }, 5 * 60 * 1000);
}

export type RateLimitResult = {
    allowed: boolean;
    remaining: number;
    retryAfterMs: number;
};

/**
 * Check rate limit for a given key.
 *
 * @param key - Unique identifier (e.g., "login:192.168.1.1")
 * @param maxRequests - Maximum requests allowed in window
 * @param windowMs - Time window in milliseconds
 * @returns Rate limit result
 */
export function checkRateLimit(
    key: string,
    maxRequests: number = 10,
    windowMs: number = 60 * 1000
): RateLimitResult {
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
        // New window
        store.set(key, {
            count: 1,
            resetAt: now + windowMs,
        });
        return {
            allowed: true,
            remaining: maxRequests - 1,
            retryAfterMs: 0,
        };
    }

    if (entry.count >= maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            retryAfterMs: entry.resetAt - now,
        };
    }

    entry.count++;
    return {
        allowed: true,
        remaining: maxRequests - entry.count,
        retryAfterMs: 0,
    };
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
        return realIp;
    }

    return "unknown";
}

/**
 * Pre-configured rate limiters for sensitive endpoints.
 */
export const rateLimiters = {
    login: (ip: string) =>
        checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000), // 5 attempts per 15 min

    voucherValidation: (ip: string) =>
        checkRateLimit(`voucher:${ip}`, 20, 60 * 1000), // 20 per minute

    orderCreation: (userId: string) =>
        checkRateLimit(`order:${userId}`, 10, 60 * 1000), // 10 per minute

    register: (ip: string) =>
        checkRateLimit(`register:${ip}`, 3, 60 * 60 * 1000), // 3 per hour

    broadcastSend: (userId: string) =>
        checkRateLimit(`broadcast:${userId}`, 5, 60 * 1000), // 5 per minute

    broadcastCreate: (userId: string) =>
        checkRateLimit(`broadcast-create:${userId}`, 10, 60 * 1000), // 10 per minute

    // Payment creation — prevent rapid-fire payment attempts
    paymentCreation: (userId: string) =>
        checkRateLimit(`payment:${userId}`, 5, 5 * 60 * 1000), // 5 per 5 min

    // Spin wheel — prevent rapid spin attempts
    spin: (userId: string) =>
        checkRateLimit(`spin:${userId}`, 10, 60 * 1000), // 10 per minute

    // Affiliate payout — prevent rapid withdrawal requests
    affiliatePayout: (userId: string) =>
        checkRateLimit(`payout:${userId}`, 3, 60 * 60 * 1000), // 3 per hour

    // File upload — prevent upload flooding
    upload: (userId: string) =>
        checkRateLimit(`upload:${userId}`, 20, 60 * 1000), // 20 per minute
};
