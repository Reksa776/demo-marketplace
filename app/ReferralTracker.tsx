"use client";

import { useEffect, useRef } from "react";

/**
 * Reads ?ref=CODE from the URL and calls
 * /api/affiliate/referral to set an HTTP-only cookie.
 *
 * Also sets a JS-readable cookie (aff_ref_public)
 * so the register form can auto-fill the referral
 * code field without needing a server call.
 *
 * Runs once on mount. Uses a ref to prevent
 * double-firing in React Strict Mode.
 */
export default function ReferralTracker() {
    const called = useRef(false);

    useEffect(() => {
        if (called.current) return;
        called.current = true;

        const params = new URLSearchParams(
            window.location.search
        );
        const refCode = params.get("ref");

        if (!refCode) return;

        // Set a JS-readable cookie for register/login forms
        // This is a backup — the HTTP-only cookie is the source of truth
        try {
            const maxAge = 60 * 60 * 24 * 30; // 30 days
            const isSecure = window.location.protocol === "https:";
            document.cookie = `aff_ref_public=${encodeURIComponent(refCode)}; path=/; max-age=${maxAge}; SameSite=Lax${isSecure ? "; Secure" : ""}`;
        } catch {
            // Cookie setting failure is non-critical
        }

        // Fire-and-forget — cookie is set server-side
        fetch(
            `/api/affiliate/referral?ref=${encodeURIComponent(refCode)}`,
            { method: "GET" }
        ).catch(() => {
            // Silently ignore — referral tracking is non-critical
        });
    }, []);

    return null;
}
