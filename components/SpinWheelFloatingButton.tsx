"use client";

import { motion } from "framer-motion";
import type { EligibilityData } from "./SpinWheelPopup";

// ==========================================
// TYPES
// ==========================================

type SpinWheelFloatingButtonProps = {
    eligibility: EligibilityData | null;
    onClick: () => void;
};

// ==========================================
// COMPONENT
// ==========================================

/**
 * SpinWheelFloatingButton — minimized state of the Spin Wheel Popup.
 *
 * Shows when:
 *   - Campaign is active (eligibility.enabled === true)
 *   - Popup is NOT open (parent controls via isOpen)
 *
 * Badge logic:
 *   eligible + spins remaining → "SPIN!" (pulsing)
 *   not eligible (below minimum) → "🎁"
 *   already used → "✓"
 */
export default function SpinWheelFloatingButton({
    eligibility,
    onClick,
}: SpinWheelFloatingButtonProps) {
    // Don't render if campaign not enabled or no data yet
    if (!eligibility || !eligibility.enabled) {
        return null;
    }

    // Determine badge
    let badge: { text: string; color: string; pulse: boolean } | null = null;

    if (eligibility.hasSpun && eligibility.spinsRemaining <= 0) {
        // Already used spin
        badge = { text: "✓", color: "bg-gray-500", pulse: false };
    } else if (eligibility.eligible && eligibility.spinsRemaining > 0) {
        // Eligible — show SPIN! with pulse
        badge = {
            text: "SPIN!",
            color: "bg-gradient-to-r from-amber-400 to-orange-500",
            pulse: true,
        };
    } else if (!eligibility.eligible) {
        // Below minimum spend
        badge = { text: "🎁", color: "bg-rose-500", pulse: false };
    }

    return (
        <motion.button
            type="button"
            onClick={onClick}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 15, stiffness: 200 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="fixed z-[9998] flex flex-col items-center gap-1"
            style={{
                right: "max(1rem, env(safe-area-inset-right, 1rem))",
                // Above bottom navbar (~64px) + safe-area + spacing
                bottom: "max(calc(5rem + env(safe-area-inset-bottom, 0px) + 0.5rem), calc(5rem + 0.5rem))",
            }}
            aria-label="Buka Spin Wheel"
            title="Spin & Menang"
        >
            {/* Pulse ring animation for eligible users */}
            <div className="relative">
                {badge?.pulse && (
                    <motion.div
                        className="absolute inset-0 rounded-full bg-rose-400"
                        animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.6, 0, 0.6],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />
                )}

                {/* Main button circle */}
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-pink-600 shadow-lg shadow-rose-500/30 ring-2 ring-white/30 sm:h-16 sm:w-16">
                    {/* Wheel icon with gentle rotation */}
                    <motion.span
                        className="text-2xl sm:text-3xl"
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    >
                        🎡
                    </motion.span>

                    {/* Badge */}
                    {badge && (
                        <motion.div
                            initial={{ scale: 0, y: 5 }}
                            animate={{ scale: 1, y: 0 }}
                            transition={{
                                type: "spring",
                                damping: 10,
                                stiffness: 300,
                                delay: 0.3,
                            }}
                            className={`absolute -right-1 -top-1 flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md ${badge.color} sm:-right-2 sm:-top-2 sm:px-2 sm:py-1 sm:text-xs`}
                        >
                            {badge.text}
                        </motion.div>
                    )}
                </div>
            </div>
        </motion.button>
    );
}
