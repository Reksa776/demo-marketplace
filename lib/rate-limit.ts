/**
 * ==========================================
 * IN-MEMORY RATE LIMITER
 * ==========================================
 *
 * Simple sliding-window rate limiter using
 * in-memory Map. Suitable for single-instance
 * deployments.
 *
 * For multi-instance deployments, consider
 * Redis-based rate limiting.
 */

type RateLimitEntry = {
    count: number;
    resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (now > entry.resetAt) {
            store.delete(key);
        }
    }
}, 5 * 60 * 1000);

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
};
