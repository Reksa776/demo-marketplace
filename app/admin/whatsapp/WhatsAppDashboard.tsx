"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

// ==========================================
// TYPES
// ==========================================

type WhatsAppStatus =
    | "DISCONNECTED"
    | "CONNECTING"
    | "CONNECTED"
    | "RECONNECTING"
    | "LOGGED_OUT"
    | "ERROR";

type StatusData = {
    status: WhatsAppStatus;
    phoneNumber: string | null;
    connectedAt: string | null;
    lastDisconnectedAt: string | null;
    lastError: string | null;
    reconnectAttempts: number;
};

// ==========================================
// POLLING INTERVAL
// ==========================================
const POLL_INTERVAL_MS = 1500;

// ==========================================
// COMPONENT
// ==========================================

export default function WhatsAppDashboard() {
    const [status, setStatus] = useState<StatusData | null>(null);
    const [qr, setQr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    // ==========================================
    // FETCH STATUS
    // ==========================================
    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/whatsapp/status", {
                credentials: "include",
                cache: "no-store",
            });
            const data = await res.json();
            if (data.success) {
                setStatus(data.data);
            }
        } catch {
            // Silently fail — polling will retry
        }
    }, []);

    // ==========================================
    // FETCH QR
    // ==========================================
    const fetchQr = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/whatsapp/qr", {
                credentials: "include",
                cache: "no-store",
            });
            const data = await res.json();

            if (data.success) {
                // Set QR — let the backend be the source of truth
                setQr(data.qr ?? null);

                // Safe debug log — never log the actual QR string
                console.log("[WA DASHBOARD QR]", {
                    success: data.success,
                    hasQr: Boolean(data.qr),
                    qrLength: data.qr?.length ?? 0,
                    status: data.status?.status,
                });
            }
        } catch {
            // Silently fail
        }
    }, []);

    // ==========================================
    // DERIVED STATE (before refs/hooks that use it)
    // ==========================================
    const currentStatus = status?.status || "DISCONNECTED";
    const isConnected = currentStatus === "CONNECTED";
    const isConnecting = currentStatus === "CONNECTING";
    const canConnect = !isConnected && !isConnecting;

    // ==========================================
    // POLLING LOOP
    // ==========================================
    const statusRef = useRef(currentStatus);
    statusRef.current = currentStatus;

    useEffect(() => {
        // Initial fetch
        fetchStatus();
        fetchQr();

        const interval = setInterval(() => {
            fetchStatus();
            fetchQr();
        }, POLL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [fetchStatus, fetchQr]);

    // ==========================================
    // CONNECT
    // ==========================================
    async function handleConnect() {
        setLoading(true);
        setActionError(null);

        try {
            const res = await fetch("/api/admin/whatsapp/connect", {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json();

            if (!data.success) {
                setActionError(data.message || "Gagal menghubungkan.");
            }
        } catch {
            setActionError("Gagal menghubungkan WhatsApp.");
        } finally {
            setLoading(false);
        }
    }

    // ==========================================
    // DISCONNECT
    // ==========================================
    async function handleDisconnect() {
        setLoading(true);
        setActionError(null);

        try {
            const res = await fetch("/api/admin/whatsapp/disconnect", {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json();

            if (!data.success) {
                setActionError(data.message || "Gagal memutus.");
            } else {
                setQr(null);
            }
        } catch {
            setActionError("Gagal memutus WhatsApp.");
        } finally {
            setLoading(false);
        }
    }

    // ==========================================
    // RENDER STATUS BADGE
    // ==========================================
    function renderStatusBadge(s: WhatsAppStatus) {
        const config: Record<
            WhatsAppStatus,
            { bg: string; text: string; label: string }
        > = {
            DISCONNECTED: {
                bg: "bg-gray-100",
                text: "text-gray-600",
                label: "DISCONNECTED",
            },
            CONNECTING: {
                bg: "bg-yellow-100",
                text: "text-yellow-700",
                label: "CONNECTING",
            },
            CONNECTED: {
                bg: "bg-green-100",
                text: "text-green-700",
                label: "CONNECTED",
            },
            RECONNECTING: {
                bg: "bg-yellow-100",
                text: "text-yellow-700",
                label: "RECONNECTING",
            },
            LOGGED_OUT: {
                bg: "bg-red-100",
                text: "text-red-700",
                label: "LOGGED OUT",
            },
            ERROR: {
                bg: "bg-red-100",
                text: "text-red-700",
                label: "ERROR",
            },
        };

        const c = config[s] || config.DISCONNECTED;

        return (
            <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${c.bg} ${c.text}`}
            >
                {c.label}
            </span>
        );
    }

    // ==========================================
    // RENDER
    // ==========================================

    // Debug log before render
    console.log("[WA DASHBOARD RENDER]", {
        hasQr: Boolean(qr),
        qrLength: qr?.length ?? 0,
        status: currentStatus,
    });

    return (
        <div className="p-4 md:p-8">
            <div className="mx-auto max-w-lg">
                {/* HEADER */}
                <h1 className="mb-6 text-2xl font-bold text-gray-900">
                    WhatsApp Integration
                </h1>

                {/* MAIN CARD */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    {/* STATUS */}
                    <div className="mb-4 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-500">
                            Status
                        </span>
                        {renderStatusBadge(currentStatus)}
                    </div>

                    {/* PHONE */}
                    <div className="mb-4 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-500">
                            Phone
                        </span>
                        <span className="text-sm text-gray-900">
                            {status?.phoneNumber || "-"}
                        </span>
                    </div>

                    {/* CONNECTED AT */}
                    {isConnected && status?.connectedAt && (
                        <div className="mb-4 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">
                                Connected
                            </span>
                            <span className="text-sm text-gray-900">
                                {new Date(status.connectedAt).toLocaleString(
                                    "id-ID",
                                    {
                                        timeZone: "Asia/Jakarta",
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    }
                                )}
                            </span>
                        </div>
                    )}

                    {/* ERROR */}
                    {(status?.lastError || actionError) && (
                        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                            {actionError || status?.lastError}
                        </div>
                    )}

                    {/* QR CODE SECTION */}
                    {qr ? (
                        <div className="mb-6">
                            <div className="flex justify-center rounded-xl border border-gray-200 bg-gray-50 p-6">
                                <QRCodeSVG
                                    value={qr}
                                    size={280}
                                />
                            </div>
                            <p className="mt-3 text-center text-xs text-gray-500">
                                Scan QR code menggunakan WhatsApp:
                                <br />
                                Settings → Linked Devices → Link a Device
                            </p>
                        </div>
                    ) : isConnecting ? (
                        <div className="mb-6 flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-6">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-rose-600" />
                            <span className="text-sm text-gray-500">
                                Menunggu QR code...
                            </span>
                        </div>
                    ) : null}

                    {/* ACTION BUTTONS */}
                    <div className="flex gap-3">
                        {canConnect ? (
                            <button
                                type="button"
                                onClick={handleConnect}
                                disabled={loading || isConnecting}
                                className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading
                                    ? "Menghubungkan..."
                                    : isConnecting
                                      ? "Menunggu QR..."
                                      : "Connect WhatsApp"}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleDisconnect}
                                disabled={loading}
                                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? "Memutus..." : "Disconnect"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
