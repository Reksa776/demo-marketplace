"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";

/* ==========================================
 * TYPES
 * ========================================== */

export type VoucherItem = {
    id: number;
    type: "REGULAR_VOUCHER" | "SPIN_WHEEL_REWARD";
    title: string;
    code?: string;
    voucherType?: "PERCENTAGE" | "FIXED";
    value?: number;
    maxDiscount?: number | null;
    minPurchase?: number;
    expiresAt?: string | null;
    eligible: boolean;
    reason: string;
    calculatedDiscount: number;
    spinId?: number;
    rewardId?: number;
    rewardType?: string;
};

export type VoucherPickerSelection = {
    voucherCode: string | null;
    spinWheelSpinId: number | null;
    voucherDiscount: number;
    spinWheelDiscount: number;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onSelect: (selection: VoucherPickerSelection) => void;
    subtotal: number;
    currentSelection: VoucherPickerSelection;
    loading?: boolean;
};

/* ==========================================
 * HELPER
 * ========================================== */

function formatRupiah(amount: number): string {
    return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function getVoucherSubtitle(item: VoucherItem): string {
    if (item.type === "SPIN_WHEEL_REWARD") {
        if (item.rewardType === "FIXED") {
            return `Diskon ${formatRupiah(item.value || 0)}`;
        }
        if (item.rewardType === "PERCENTAGE") {
            let text = `${item.value}% OFF`;
            if (item.maxDiscount) {
                text += ` (maks ${formatRupiah(item.maxDiscount)})`;
            }
            return text;
        }
        if (item.rewardType === "FREE_SHIPPING") {
            return "Gratis Ongkir";
        }
        if (item.rewardType === "CASHBACK") {
            return `Cashback ${formatRupiah(item.value || 0)}`;
        }
        return item.title;
    }

    // Regular voucher
    if (item.voucherType === "PERCENTAGE") {
        let text = `${item.value}% OFF`;
        if (item.maxDiscount) {
            text += ` (maks ${formatRupiah(item.maxDiscount)})`;
        }
        return text;
    }
    if (item.voucherType === "FIXED") {
        return formatRupiah(item.value || 0);
    }
    return "";
}

function getVoucherIcon(item: VoucherItem): string {
    if (item.type === "SPIN_WHEEL_REWARD") {
        return "🎡";
    }
    return "🎟️";
}

/* ==========================================
 * COMPONENT
 * ========================================== */

export default function VoucherPickerModal({
    open,
    onClose,
    onSelect,
    subtotal,
    currentSelection,
}: Props) {
    const [loading, setLoading] = useState(false);
    const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
    const [spinRewards, setSpinRewards] = useState<VoucherItem[]>([]);
    const [pendingSelection, setPendingSelection] =
        useState<VoucherPickerSelection>(currentSelection);

    // Sync pending selection when currentSelection changes (e.g., modal re-opened)
    useEffect(() => {
        setPendingSelection(currentSelection);
    }, [currentSelection, open]);

    const fetchVouchers = useCallback(async () => {
        if (!open || subtotal <= 0) return;

        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.set("subtotal", String(subtotal));

            const response = await fetch(
                `/api/vouchers/available?${params.toString()}`,
                { cache: "no-store" }
            );

            const result = await response.json();

            if (result.success && result.data) {
                setVouchers(result.data.vouchers || []);
                setSpinRewards(result.data.spinWheelRewards || []);
            }
        } catch {
            // Silently fail — modal still works, just no vouchers
        } finally {
            setLoading(false);
        }
    }, [open, subtotal]);

    useEffect(() => {
        if (open) {
            fetchVouchers();
        }
    }, [open, fetchVouchers]);

    // Prevent body scroll when open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [open]);

    // Escape key
    useEffect(() => {
        if (!open) return;
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    function handleSelect(item: VoucherItem) {
        if (!item.eligible) return;

        if (item.type === "REGULAR_VOUCHER") {
            const isAlreadySelected = pendingSelection.voucherCode === item.code;
            setPendingSelection({
                voucherCode: isAlreadySelected ? null : item.code || null,
                spinWheelSpinId: isAlreadySelected
                    ? pendingSelection.spinWheelSpinId
                    : null, // Mutual exclusion with regular voucher
                voucherDiscount: isAlreadySelected ? 0 : item.calculatedDiscount,
                spinWheelDiscount: isAlreadySelected
                    ? pendingSelection.spinWheelDiscount
                    : 0,
            });
        } else if (item.type === "SPIN_WHEEL_REWARD") {
            const isAlreadySelected = pendingSelection.spinWheelSpinId === item.spinId;
            setPendingSelection({
                voucherCode: isAlreadySelected
                    ? pendingSelection.voucherCode
                    : null, // Mutual exclusion with spin wheel reward
                spinWheelSpinId: isAlreadySelected ? null : item.spinId || null,
                voucherDiscount: isAlreadySelected ? pendingSelection.voucherDiscount : 0,
                spinWheelDiscount: isAlreadySelected ? 0 : item.calculatedDiscount,
            });
        }
    }

    function handleConfirm() {
        onSelect(pendingSelection);
        onClose();
    }

    function handleCancel() {
        setPendingSelection(currentSelection);
        onClose();
    }

    if (!open) return null;

    const eligibleVouchers = vouchers.filter((v) => v.eligible);
    const ineligibleVouchers = vouchers.filter((v) => !v.eligible);
    const eligibleSpinRewards = spinRewards.filter((r) => r.eligible);
    const ineligibleSpinRewards = spinRewards.filter((r) => !r.eligible);

    const hasAnyVoucher =
        eligibleVouchers.length > 0 || eligibleSpinRewards.length > 0;
    const hasAnyIneligible =
        ineligibleVouchers.length > 0 || ineligibleSpinRewards.length > 0;

    const isVoucherSelected = pendingSelection.voucherCode !== null;
    const isSpinSelected = pendingSelection.spinWheelSpinId !== null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voucher-picker-title"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleCancel}
            />

            {/* Modal / Bottom Sheet */}
            <div className="relative flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:mx-4 sm:max-w-lg sm:rounded-3xl">
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
                    <h2
                        id="voucher-picker-title"
                        className="text-lg font-bold text-gray-900"
                    >
                        Pilih Voucher
                    </h2>
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Tutup"
                    >
                        ✕
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {loading ? (
                        <div className="py-12 text-center text-sm text-gray-500">
                            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-rose-600" />
                            Memuat voucher...
                        </div>
                    ) : !hasAnyVoucher && !hasAnyIneligible ? (
                        <div className="py-12 text-center">
                            <div className="text-4xl">🎫</div>
                            <p className="mt-3 font-medium text-gray-900">
                                Belum ada voucher yang tersedia
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                                Belanja lagi untuk mendapatkan voucher!
                            </p>
                        </div>
                    ) : !hasAnyVoucher && hasAnyIneligible ? (
                        <div className="py-8">
                            <div className="mb-6 text-center">
                                <div className="text-4xl">🎫</div>
                                <p className="mt-3 text-sm text-gray-500">
                                    Belum ada voucher yang bisa digunakan untuk pesanan ini.
                                </p>
                            </div>
                            {/* Still show ineligible section */}
                            <div>
                                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                                    Tidak dapat digunakan
                                </h3>
                                <div className="space-y-3">
                                    {ineligibleVouchers.map((item) => (
                                        <div
                                            key={item.id}
                                            className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 opacity-60"
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className="mt-0.5 text-lg grayscale">
                                                    {getVoucherIcon(item)}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-bold text-gray-700">
                                                        {getVoucherSubtitle(item)}
                                                    </div>
                                                    {item.minPurchase && item.minPurchase > 0 && (
                                                        <div className="mt-1 text-xs text-gray-500">
                                                            Min. belanja {formatRupiah(item.minPurchase)}
                                                        </div>
                                                    )}
                                                    {item.expiresAt && (
                                                        <div className="mt-1 text-xs text-gray-400">
                                                            Berlaku sampai {formatDate(item.expiresAt)}
                                                        </div>
                                                    )}
                                                    <div className="mt-2 text-xs font-medium text-gray-500">
                                                        {item.reason}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {ineligibleSpinRewards.map((item) => (
                                        <div
                                            key={item.spinId}
                                            className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 opacity-60"
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className="mt-0.5 text-lg grayscale">
                                                    🎡
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-bold text-gray-700">
                                                        Reward Spin Wheel
                                                    </div>
                                                    <div className="mt-2 text-xs font-medium text-gray-500">
                                                        {item.reason}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* ======================================== */}
                            {/* ELIGIBLE VOUCHERS */}
                            {/* ======================================== */}

                            {eligibleVouchers.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                                        Voucher Diskon
                                    </h3>
                                    <div className="space-y-3">
                                        {eligibleVouchers.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => handleSelect(item)}
                                                className={`w-full rounded-2xl border-2 p-4 text-left transition ${
                                                    pendingSelection.voucherCode ===
                                                    item.code
                                                        ? "border-rose-500 bg-rose-50"
                                                        : "border-gray-200 hover:border-gray-300"
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    {/* Radio indicator */}
                                                    <div
                                                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                                            pendingSelection.voucherCode ===
                                                            item.code
                                                                ? "border-rose-500"
                                                                : "border-gray-300"
                                                        }`}
                                                    >
                                                        {pendingSelection.voucherCode ===
                                                            item.code && (
                                                            <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg">
                                                                {getVoucherIcon(item)}
                                                            </span>
                                                            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                                                                {item.code}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1 text-sm font-bold text-gray-900">
                                                            {getVoucherSubtitle(item)}
                                                        </div>
                                                        {item.minPurchase
                                                            ? item.minPurchase > 0 && (
                                                                  <div className="mt-1 text-xs text-gray-500">
                                                                      Min. belanja{" "}
                                                                      {formatRupiah(
                                                                          item.minPurchase
                                                                      )}
                                                                  </div>
                                                              )
                                                            : null}
                                                        {item.expiresAt && (
                                                            <div className="mt-1 text-xs text-gray-400">
                                                                Berlaku sampai{" "}
                                                                {formatDate(item.expiresAt)}
                                                            </div>
                                                        )}
                                                        <div className="mt-2 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                                            Hemat{" "}
                                                            {formatRupiah(
                                                                item.calculatedDiscount
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ======================================== */}
                            {/* ELIGIBLE SPIN WHEEL REWARDS */}
                            {/* ======================================== */}

                            {eligibleSpinRewards.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                                        Voucher Spin Wheel
                                    </h3>
                                    <div className="space-y-3">
                                        {eligibleSpinRewards.map((item) => (
                                            <button
                                                key={item.spinId}
                                                type="button"
                                                onClick={() => handleSelect(item)}
                                                className={`w-full rounded-2xl border-2 p-4 text-left transition ${
                                                    pendingSelection.spinWheelSpinId ===
                                                    item.spinId
                                                        ? "border-amber-500 bg-amber-50"
                                                        : "border-gray-200 hover:border-gray-300"
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    {/* Radio indicator */}
                                                    <div
                                                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                                            pendingSelection.spinWheelSpinId ===
                                                            item.spinId
                                                                ? "border-amber-500"
                                                                : "border-gray-300"
                                                        }`}
                                                    >
                                                        {pendingSelection.spinWheelSpinId ===
                                                            item.spinId && (
                                                            <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg">
                                                                🎡
                                                            </span>
                                                            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                                                                Reward Spin Wheel
                                                            </span>
                                                        </div>
                                                        <div className="mt-1 text-sm font-bold text-gray-900">
                                                            {getVoucherSubtitle(item)}
                                                        </div>
                                                        {item.expiresAt && (
                                                            <div className="mt-1 text-xs text-gray-400">
                                                                Berlaku sampai{" "}
                                                                {formatDate(item.expiresAt)}
                                                            </div>
                                                        )}
                                                        {item.calculatedDiscount > 0 && (
                                                            <div className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                                                                Hemat{" "}
                                                                {formatRupiah(
                                                                    item.calculatedDiscount
                                                                )}
                                                            </div>
                                                        )}
                                                        {item.rewardType ===
                                                            "FREE_SHIPPING" && (
                                                            <div className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                                                                Gratis Ongkir
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ======================================== */}
                            {/* INELIGIBLE VOUCHERS */}
                            {/* ======================================== */}

                            {hasAnyIneligible && (
                                <div>
                                    <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                                        Tidak dapat digunakan
                                    </h3>
                                    <div className="space-y-3">
                                        {ineligibleVouchers.map((item) => (
                                            <div
                                                key={item.id}
                                                className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 opacity-60"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <span className="mt-0.5 text-lg grayscale">
                                                        {getVoucherIcon(item)}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm font-bold text-gray-700">
                                                            {getVoucherSubtitle(item)}
                                                        </div>
                                                        {item.minPurchase
                                                            ? item.minPurchase > 0 && (
                                                                  <div className="mt-1 text-xs text-gray-500">
                                                                      Min. belanja{" "}
                                                                      {formatRupiah(
                                                                          item.minPurchase
                                                                      )}
                                                                  </div>
                                                              )
                                                            : null}
                                                        {item.expiresAt && (
                                                            <div className="mt-1 text-xs text-gray-400">
                                                                Berlaku sampai{" "}
                                                                {formatDate(item.expiresAt)}
                                                            </div>
                                                        )}
                                                        <div className="mt-2 text-xs font-medium text-gray-500">
                                                            {item.reason}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {ineligibleSpinRewards.map((item) => (
                                            <div
                                                key={item.spinId}
                                                className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 opacity-60"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <span className="mt-0.5 text-lg grayscale">
                                                        🎡
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm font-bold text-gray-700">
                                                            Reward Spin Wheel
                                                        </div>
                                                        <div className="mt-2 text-xs font-medium text-gray-500">
                                                            {item.reason}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex shrink-0 gap-3 border-t px-5 py-4">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="flex-1 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                        Tutup
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={
                            !isVoucherSelected && !isSpinSelected
                        }
                        className="flex-1 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        {!isVoucherSelected && !isSpinSelected
                            ? "Pilih Voucher"
                            : isVoucherSelected
                                ? "Gunakan Voucher"
                                : "Gunakan Reward"}
                    </button>
                </div>
            </div>
        </div>
    );
}
