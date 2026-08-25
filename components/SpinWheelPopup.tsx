"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";

// =========================================
// TYPES
// =========================================

export type EligibilityData = {
    enabled: boolean;
    eligible: boolean;
    campaignId: number | null;
    minimumSpend: number;
    currentSpend: number;
    remainingSpend: number;
    spinsRemaining: number;
    hasSpun: boolean;
    rewards: Array<{ id: number; name: string; type: string }>;
};

type RewardResult = {
    id: number;
    name: string;
    type: string;
    value: number;
    maxDiscount: number | null;
};

type SpinState = "idle" | "loading" | "spinning" | "result";

// =========================================
// COMPONENT PROPS
// =========================================

export type SpinWheelPopupProps = {
    /** Controlled open state. Parent manages visibility. */
    open: boolean;
    /** Called when user clicks X (minimize). */
    onClose: () => void;
    /** Current eligibility data from server. */
    eligibility: EligibilityData | null;
    /** Called when popup opens (for parent to refresh eligibility). */
    onOpen?: () => void;
};

// =========================================
// WHEEL SEGMENTS CONFIG
// =========================================

const SEGMENT_COLORS = [
    "#F43F5E", // rose-500
    "#8B5CF6", // violet-500
    "#F59E0B", // amber-500
    "#10B981", // emerald-500
    "#3B82F6", // blue-500
    "#EC4899", // pink-500
];

const NUM_SEGMENTS = SEGMENT_COLORS.length;
const SEGMENT_ANGLE = 360 / NUM_SEGMENTS;

// Safety timeout: if animation doesn't complete in 8s, force result
const SPIN_TIMEOUT_MS = 8000;

// =========================================
// HELPER
// =========================================

function formatRupiah(value: number) {
    return `Rp ${value.toLocaleString("id-ID")}`;
}

/**
 * Find the segment index for a given reward ID.
 * Rewards are ordered by id ASC from the API, matching segment order.
 */
function getSegmentIndex(
    rewardId: number,
    rewards: Array<{ id: number; name: string; type: string }>
): number {
    if (!rewards || rewards.length === 0) return 0;
    const idx = rewards.findIndex((r) => r.id === rewardId);
    return idx >= 0 ? idx % NUM_SEGMENTS : 0;
}

/**
 * Calculate the target rotation to land on a specific segment.
 *
 * The pointer is fixed at the TOP of the wheel.
 * Segments are drawn clockwise starting from the top:
 *   Segment 0: 0° to 60°
 *   Segment 1: 60° to 120°
 *   ...
 *
 * To land on segment i, we need the wheel to rotate so that
 * the center of segment i aligns with the pointer (top).
 *
 * Center of segment i = i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2
 * Rotation needed = 360 - center (since wheel rotates clockwise)
 *
 * We add multiple full rotations for visual effect.
 */
function calculateTargetRotation(
    segmentIndex: number,
    currentRotation: number
): number {
    const segmentCenter = segmentIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const targetWithinCircle = (360 - segmentCenter + 360) % 360;

    // Full rotations: at least 5, plus enough to always advance forward
    const fullRotations = 5;
    const baseRotation =
        Math.ceil(currentRotation / 360) * 360 + fullRotations * 360;

    return baseRotation + targetWithinCircle;
}

// =========================================
// COMPONENT
// =========================================

export default function SpinWheelPopup({
    open,
    onClose,
    eligibility,
    onOpen,
}: SpinWheelPopupProps) {
    const { status: sessionStatus } = useSession();

    const [spinState, setSpinState] = useState<SpinState>("idle");
    const [reward, setReward] = useState<RewardResult | null>(null);
    const [rotation, setRotation] = useState(0);
    const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reset spin state when popup reopens (fresh start for visual)
    useEffect(() => {
        if (open) {
            setSpinState("idle");
            setReward(null);
        }
    }, [open]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (spinTimeoutRef.current) {
                clearTimeout(spinTimeoutRef.current);
            }
        };
    }, []);

    // Notify parent when popup opens (for eligibility refresh)
    useEffect(() => {
        if (open) {
            onOpen?.();
        }
    }, [open, onOpen]);

    function handleMinimize() {
        console.log("[SpinWheel] user minimized popup");
        onClose();
    }

    async function handleSpin() {
        if (spinState === "loading" || spinState === "spinning") return;

        console.log("[SpinWheel] user clicked spin button");
        setSpinState("loading");

        try {
            const response = await fetch("/api/spin-wheel/spin", {
                method: "POST",
            });
            const result = await response.json();
            console.log("[SpinWheel] spin API result:", JSON.stringify(result));

            if (!result.success || !result.data?.reward) {
                console.log("[SpinWheel] spin failed:", result.message);
                alert(
                    result.message ||
                        "Gagal melakukan spin. Silakan coba lagi."
                );
                setSpinState("idle");
                return;
            }

            const rewardData: RewardResult = result.data.reward;
            setReward(rewardData);
            console.log(
                "[SpinWheel] reward received:",
                rewardData.name,
                rewardData.type
            );

            // Map reward to segment index using rewards list
            const segmentIndex = getSegmentIndex(
                rewardData.id,
                eligibility?.rewards ?? []
            );
            console.log("[SpinWheel] reward segment index:", segmentIndex);

            // Calculate rotation targeting the correct segment
            const targetRotation = calculateTargetRotation(
                segmentIndex,
                rotation
            );
            console.log(
                "[SpinWheel] target rotation:",
                targetRotation,
                "from current:",
                rotation
            );

            // Start spinning animation
            setSpinState("spinning");
            setRotation(targetRotation);

            // Safety timeout: force result if animation doesn't complete
            spinTimeoutRef.current = setTimeout(() => {
                console.log("[SpinWheel] spin timeout — forcing result");
                setSpinState("result");
            }, SPIN_TIMEOUT_MS);
        } catch (err) {
            console.log("[SpinWheel] spin request failed:", err);
            alert("Terjadi kesalahan. Silakan coba lagi.");
            setSpinState("idle");
        }
    }

    // Handle animation complete — transition from spinning to result
    function handleSpinAnimationComplete() {
        if (spinState === "spinning") {
            console.log("[SpinWheel] animation complete, showing result");
            if (spinTimeoutRef.current) {
                clearTimeout(spinTimeoutRef.current);
                spinTimeoutRef.current = null;
            }
            setSpinState("result");
        }
    }

    // Don't render if session still loading or popup is closed
    if (sessionStatus === "loading" || !open || !eligibility) {
        return null;
    }

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="spin-wheel-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) handleMinimize();
                    }}
                >
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 300,
                        }}
                        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
                    >
                        {/* CLOSE / MINIMIZE BUTTON */}
                        <button
                            type="button"
                            onClick={handleMinimize}
                            aria-label="Minimize Spin Wheel"
                            title="Minimize"
                            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-gray-500 shadow transition hover:bg-white hover:text-gray-700"
                        >
                            ×
                        </button>

                        {/* HEADER */}
                        <div className="bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-6 text-center text-white">
                            <p className="text-3xl">🎡</p>
                            <h2 className="mt-2 text-xl font-bold">
                                SPIN & MENANG!
                            </h2>
                            <p className="mt-1 text-sm text-white/80">
                                Putar roda dan menangkan promo menarik!
                            </p>
                        </div>

                        <div className="px-6 py-5">
                            {spinState === "result" && reward ? (
                                /* ========== RESULT VIEW ========== */
                                <div className="text-center">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{
                                            type: "spring",
                                            damping: 15,
                                            stiffness: 200,
                                            delay: 0.2,
                                        }}
                                    >
                                        <p className="text-4xl">🎉</p>
                                        <h3 className="mt-3 text-lg font-bold text-gray-900">
                                            SELAMAT!
                                        </h3>
                                        <p className="mt-1 text-sm text-gray-500">
                                            Kamu mendapatkan
                                        </p>
                                        <p className="mt-2 text-2xl font-bold text-rose-600">
                                            {reward.name}
                                        </p>
                                        {reward.type === "FIXED" && (
                                            <p className="mt-1 text-sm text-gray-500">
                                                {formatRupiah(reward.value)} OFF
                                            </p>
                                        )}
                                        {reward.type === "PERCENTAGE" && (
                                            <p className="mt-1 text-sm text-gray-500">
                                                Diskon {reward.value}%
                                                {reward.maxDiscount
                                                    ? ` (maks ${formatRupiah(reward.maxDiscount)})`
                                                    : ""}
                                            </p>
                                        )}
                                        {reward.type === "FREE_SHIPPING" && (
                                            <p className="mt-1 text-sm text-gray-500">
                                                Diskon ongkir akan otomatis
                                                diterapkan
                                            </p>
                                        )}
                                        {reward.type === "ZONK" && (
                                            <p className="mt-1 text-sm text-gray-500">
                                                Coba lagi next time!
                                            </p>
                                        )}
                                    </motion.div>
                                    <div className="mt-5 flex gap-3">
                                        <a
                                            href="/products"
                                            className="flex-1 rounded-xl bg-rose-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-rose-700"
                                        >
                                            Belanja Sekarang
                                        </a>
                                        <button
                                            type="button"
                                            onClick={handleMinimize}
                                            className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                                        >
                                            Nanti Saja
                                        </button>
                                    </div>
                                </div>
                            ) : eligibility.eligible ? (
                                /* ========== ELIGIBLE VIEW ========== */
                                <>
                                    {/* WHEEL */}
                                    <div className="flex justify-center">
                                        <div className="relative h-56 w-56">
                                            {/* Outer ring */}
                                            <div className="absolute inset-0 rounded-full border-4 border-amber-400 shadow-lg" />

                                            {/* Wheel — this div rotates */}
                                            <motion.div
                                                className="h-full w-full"
                                                animate={{ rotate: rotation }}
                                                transition={
                                                    spinState === "spinning"
                                                        ? {
                                                              duration: 5,
                                                              ease: [
                                                                  0.15, 0.85,
                                                                  0.25, 1,
                                                              ], // custom cubic-bezier: slow start, accelerate, then decelerate to stop
                                                          }
                                                        : { duration: 0 }
                                                }
                                                onAnimationComplete={
                                                    handleSpinAnimationComplete
                                                }
                                            >
                                                <svg
                                                    viewBox="0 0 200 200"
                                                    className="h-full w-full"
                                                >
                                                    {SEGMENT_COLORS.map(
                                                        (color, i) => {
                                                            const startAngle =
                                                                i *
                                                                SEGMENT_ANGLE;
                                                            const endAngle =
                                                                startAngle +
                                                                SEGMENT_ANGLE;
                                                            const startRad =
                                                                ((startAngle -
                                                                    90) *
                                                                    Math.PI) /
                                                                180;
                                                            const endRad =
                                                                ((endAngle -
                                                                    90) *
                                                                    Math.PI) /
                                                                180;
                                                            const x1 =
                                                                100 +
                                                                90 *
                                                                    Math.cos(
                                                                        startRad
                                                                    );
                                                            const y1 =
                                                                100 +
                                                                90 *
                                                                    Math.sin(
                                                                        startRad
                                                                    );
                                                            const x2 =
                                                                100 +
                                                                90 *
                                                                    Math.cos(
                                                                        endRad
                                                                    );
                                                            const y2 =
                                                                100 +
                                                                90 *
                                                                    Math.sin(
                                                                        endRad
                                                                    );
                                                            const largeArc =
                                                                SEGMENT_ANGLE >
                                                                180
                                                                    ? 1
                                                                    : 0;

                                                            return (
                                                                <path
                                                                    key={i}
                                                                    d={`M100,100 L${x1},${y1} A90,90 0 ${largeArc},1 ${x2},${y2} Z`}
                                                                    fill={
                                                                        color
                                                                    }
                                                                    stroke="white"
                                                                    strokeWidth="1"
                                                                />
                                                            );
                                                        }
                                                    )}
                                                    {/* Center circle */}
                                                    <circle
                                                        cx="100"
                                                        cy="100"
                                                        r="20"
                                                        fill="white"
                                                        stroke="#e5e7eb"
                                                        strokeWidth="2"
                                                    />
                                                </svg>
                                            </motion.div>

                                            {/* Pointer (fixed at top) */}
                                            <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                                                <div className="h-0 w-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-gray-900" />
                                            </div>
                                        </div>
                                    </div>

                                    <p className="mt-4 text-center text-sm text-gray-600">
                                        Kamu punya{" "}
                                        <span className="font-bold text-rose-600">
                                            {eligibility.spinsRemaining}
                                        </span>{" "}
                                        kesempatan spin!
                                    </p>

                                    <button
                                        type="button"
                                        onClick={handleSpin}
                                        disabled={
                                            spinState === "loading" ||
                                            spinState === "spinning"
                                        }
                                        className="mt-4 w-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-4 text-center text-base font-bold text-white shadow-lg transition hover:from-rose-600 hover:to-pink-600 disabled:opacity-60"
                                    >
                                        {spinState === "loading"
                                            ? "Memproses..."
                                            : spinState === "spinning"
                                              ? "Berputar..."
                                              : "🎰 PUTAR SEKARANG"}
                                    </button>
                                </>
                            ) : (
                                /* ========== NOT ELIGIBLE VIEW ========== */
                                <div className="text-center">
                                    <p className="text-4xl">🛍️</p>
                                    <h3 className="mt-3 text-base font-bold text-gray-900">
                                        Belum Cukup Belanja
                                    </h3>
                                    <p className="mt-2 text-sm text-gray-500">
                                        Belanja minimal{" "}
                                        <span className="font-bold text-rose-600">
                                            {formatRupiah(
                                                eligibility.minimumSpend
                                            )}
                                        </span>{" "}
                                        untuk mendapatkan kesempatan spin.
                                    </p>

                                    {/* Progress bar */}
                                    <div className="mt-4">
                                        <div className="mb-1 flex justify-between text-xs text-gray-500">
                                            <span>
                                                {formatRupiah(
                                                    eligibility.currentSpend
                                                )}
                                            </span>
                                            <span>
                                                {formatRupiah(
                                                    eligibility.minimumSpend
                                                )}
                                            </span>
                                        </div>
                                        <div className="h-3 overflow-hidden rounded-full bg-gray-200">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{
                                                    width: `${Math.min(100, (eligibility.currentSpend / eligibility.minimumSpend) * 100)}%`,
                                                }}
                                                transition={{
                                                    duration: 1,
                                                    ease: "easeOut",
                                                }}
                                                className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600"
                                            />
                                        </div>
                                        {eligibility.remainingSpend > 0 && (
                                            <p className="mt-2 text-xs font-medium text-rose-600">
                                                Kurang{" "}
                                                {formatRupiah(
                                                    eligibility.remainingSpend
                                                )}{" "}
                                                lagi!
                                            </p>
                                        )}
                                    </div>

                                    <a
                                        href="/products"
                                        className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-rose-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
                                    >
                                        Mulai Belanja
                                    </a>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
