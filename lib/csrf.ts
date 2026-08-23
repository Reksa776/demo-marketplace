import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * ==========================================
 * CSRF PROTECTION HELPER
 * ==========================================
 *
 * NextAuth uses SameSite cookies which provide
 * inherent CSRF protection for browser-based
 * requests. This helper adds an additional
 * server-side check:
 *
 * 1. Validates that the request has a valid
 *    session (auth() must succeed)
 * 2. Ensures state-changing operations only
 *    come from authenticated sessions
 *
 * For non-cookie-based clients (mobile apps,
 * API consumers), this check ensures they must
 * still provide a valid session token.
 *
 * Usage in API routes:
 *   const csrfResult = await requireSession();
 *   if (csrfResult.error) return csrfResult.error;
 */
export async function requireSession() {
    const session = await auth();

    if (!session?.user?.id) {
        return {
            error: NextResponse.json(
                {
                    success: false,
                    message: "Silakan login terlebih dahulu.",
                },
                { status: 401 }
            ),
            userId: null,
        };
    }

    return {
        error: null,
        userId: session.user.id,
    };
}

/**
 * ==========================================
 * ADMIN SESSION CHECK
 * ==========================================
 *
 * Requires ADMIN role for access.
 */
export async function requireAdminSession() {
    const session = await auth();

    if (!session?.user?.id) {
        return {
            error: NextResponse.json(
                {
                    success: false,
                    message: "Silakan login terlebih dahulu.",
                },
                { status: 401 }
            ),
            userId: null,
        };
    }

    const role = (session.user as any).role;

    if (role !== "ADMIN") {
        return {
            error: NextResponse.json(
                {
                    success: false,
                    message: "Akses ditolak.",
                },
                { status: 403 }
            ),
            userId: null,
        };
    }

    return {
        error: null,
        userId: session.user.id,
    };
}
