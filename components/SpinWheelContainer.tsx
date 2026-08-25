"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import SpinWheelPopup from "./SpinWheelPopup";
import SpinWheelFloatingButton from "./SpinWheelFloatingButton";
import type { EligibilityData } from "./SpinWheelPopup";

// =========================================
// STORAGE KEY
// =========================================

const STORAGE_KEY = "spinWheelMinimized";

// =========================================
// COMPONENT
// =========================================

/**
 * SpinWheelContainer — /home only
 *
 * Minimize flow with sessionStorage persistence:
 *   First visit → popup auto-opens
 *   X clicked → minimize → sessionStorage set → floating icon
 *   Refresh /home → check sessionStorage → stays minimized
 *   Tab switch → stays minimized (sessionStorage persists within session)
 *   Click floating icon → popup opens, sessionStorage cleared
 *
 * Architecture:
 *   isOpen = true  → popup visible, floating button hidden
 *   isOpen = false → popup hidden, floating button visible (if campaign active)
 */
export default function SpinWheelContainer() {
    const { data: session, status: sessionStatus } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
    const [loading, setLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);

    // ---------- Fetch eligibility from server ----------
    const fetchEligibility = useCallback(async () => {
        console.log("[SpinWheel] mounted");
        console.log("[SpinWheel] fetching eligibility");

        try {
            const response = await fetch("/api/spin-wheel", {
                cache: "no-store",
            });

            if (!response.ok) {
                console.log("[SpinWheel] API error:", response.status);
                return null;
            }

            const result = await response.json();

            if (result.success && result.data) {
                const data = result.data as EligibilityData;
                console.log("[SpinWheel] eligibility response:", JSON.stringify(data));
                return data;
            }

            console.log("[SpinWheel] API success=false or no data");
            return null;
        } catch (err) {
            console.log("[SpinWheel] eligibility check failed:", err);
            return null;
        }
    }, []);

    // ---------- Initial load: fetch eligibility + check minimize state ----------
    useEffect(() => {
        console.log("[SpinWheel] sessionStatus:", sessionStatus);

        if (sessionStatus === "loading") return;
        if (!session?.user) {
            setLoading(false);
            setInitialized(true);
            return;
        }

        console.log("[SpinWheel] user:", session.user.email ?? session.user.id);

        async function init() {
            const data = await fetchEligibility();
            setEligibility(data);

            if (data?.enabled) {
                // Check sessionStorage: was popup minimized in this session?
                const wasMinimized =
                    typeof window !== "undefined" &&
                    sessionStorage.getItem(STORAGE_KEY) === "1";

                if (wasMinimized) {
                    // Stay minimized — show floating icon, don't open popup
                    console.log("[SpinWheel] previously minimized, staying minimized");
                    setIsOpen(false);
                } else {
                    // First visit in this session — auto-open popup
                    console.log("[SpinWheel] opening popup");
                    setIsOpen(true);
                }
            } else {
                console.log("[SpinWheel] no active campaign");
            }

            setLoading(false);
            setInitialized(true);
        }

        init();
    }, [session, sessionStatus, fetchEligibility]);

    // ---------- Close / Minimize ----------
    const handleClose = useCallback(() => {
        console.log("[SpinWheel] popup minimized");
        setIsOpen(false);
        // Persist minimize state in sessionStorage (survives refresh + tab switch)
        if (typeof window !== "undefined") {
            sessionStorage.setItem(STORAGE_KEY, "1");
        }
    }, []);

    // ---------- Open from floating button (with fresh eligibility) ----------
    const handleOpenFromButton = useCallback(async () => {
        console.log("[SpinWheel] floating icon clicked — refreshing eligibility");

        // Clear minimize state
        if (typeof window !== "undefined") {
            sessionStorage.removeItem(STORAGE_KEY);
        }

        // Fetch fresh eligibility before opening
        const data = await fetchEligibility();
        if (data) {
            setEligibility(data);
        }

        console.log("[SpinWheel] opening popup");
        setIsOpen(true);
    }, [fetchEligibility]);

    // ---------- Popup open callback (for eligibility refresh) ----------
    const handlePopupOpen = useCallback(() => {
        console.log("[SpinWheel] popup opened, refreshing eligibility");
        fetchEligibility().then((data) => {
            if (data) setEligibility(data);
        });
    }, [fetchEligibility]);

    // Don't render until session + eligibility determined
    if (sessionStatus === "loading" || loading || !initialized) {
        return null;
    }

    return (
        <>
            {/* Floating button — visible when popup is minimized (isOpen=false) and campaign active */}
            {!isOpen && (
                <SpinWheelFloatingButton
                    eligibility={eligibility}
                    onClick={handleOpenFromButton}
                />
            )}

            {/* Popup — always mounted when campaign active, visibility controlled by open prop */}
            {eligibility?.enabled && (
                <SpinWheelPopup
                    open={isOpen}
                    onClose={handleClose}
                    eligibility={eligibility}
                    onOpen={handlePopupOpen}
                />
            )}
        </>
    );
}
