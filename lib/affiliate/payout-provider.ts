/**
 * AFFILIATE PAYOUT DISBURSEMENT PROVIDER
 *
 * Abstraction layer for bank transfer disbursement.
 * Uses Midtrans Iris API for actual bank transfers.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 *   PAYOUT_API_KEY       - Midtrans Iris API key (server key)
 *   PAYOUT_SECRET_KEY    - Midtrans Iris secret key
 *   PAYOUT_BASE_URL      - API base URL (default: https://api.midtrans.com)
 *   PAYOUT_MERCHANT_ID   - Merchant ID for disbursement
 *
 * DEVELOPMENT MODE:
 *   If PAYOUT_API_KEY is not set, operates in development/mock mode.
 *   Development mode logs transfers but does NOT execute real bank transfers.
 *
 * IMPORTANT:
 *   - NEVER hardcode credentials
 *   - NEVER expose credentials to frontend
 *   - ALWAYS use idempotency keys
 *   - ALWAYS verify webhook signatures
 */

import crypto from "crypto";

/* ==========================================
 * TYPES
 * ========================================== */

export type DisbursementStatus =
    | "PENDING"
    | "PROCESSING"
    | "SUCCESS"
    | "FAILED"
    | "REJECTED";

export interface DisbursementRequest {
    payoutId: number;
    amount: number;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    idempotencyKey: string;
    description?: string;
}

export interface DisbursementResponse {
    success: boolean;
    providerTransactionId?: string;
    providerReference?: string;
    status: DisbursementStatus;
    message?: string;
    rawResponse?: unknown;
}

export interface DisbursementStatusRequest {
    providerTransactionId: string;
    providerReference?: string;
}

export interface DisbursementStatusResponse {
    success: boolean;
    status: DisbursementStatus;
    providerTransactionId?: string;
    message?: string;
    rawResponse?: unknown;
}

/* ==========================================
 * CONFIGURATION
 * ========================================== */

const config = {
    apiKey: process.env.PAYOUT_API_KEY || "",
    secretKey: process.env.PAYOUT_SECRET_KEY || "",
    baseUrl:
        process.env.PAYOUT_BASE_URL ||
        "https://api.midtrans.com",
    merchantId: process.env.PAYOUT_MERCHANT_ID || "",
};

const isDevelopment =
    !config.apiKey || !config.secretKey;

/* ==========================================
 * HELPERS
 * ========================================== */

function generateSignature(
    path: string,
    method: string,
    body: string
): string {
    const raw = `${method}${path}${body}`;
    return crypto
        .createHmac("sha512", config.secretKey)
        .update(raw)
        .digest("hex");
}

function getBankCode(bankName: string): string {
    const bankMap: Record<string, string> = {
        BCA: "bca",
        MANDIRI: "mandiri",
        BRI: "bri",
        BNI: "bni",
        CIMB: "cimb",
        PERMATA: "permata",
        DANAMON: "danamon",
        PANIN: "panin",
        MUAMALAT: "muamalat",
        BSI: "bsi",
        BJB: "bjb",
        BTPN: "btpn",
        CIMB_NIAGA: "cimb",
        MAYBANK: "maybank",
        OCBC: "ocbc",
        "CITIBANK": "citibank",
    };
    return bankMap[bankName.toUpperCase()] || bankName.toLowerCase();
}

/* ==========================================
 * PROVIDER IMPLEMENTATION
 * ========================================== */

/**
 * Create a disbursement (bank transfer) request.
 *
 * In development mode: logs and returns SUCCESS mock.
 * In production mode: calls Midtrans Iris API.
 */
export async function createDisbursement(
    request: DisbursementRequest
): Promise<DisbursementResponse> {
    const {
        payoutId,
        amount,
        bankCode,
        accountNumber,
        accountName,
        idempotencyKey,
        description,
    } = request;

    console.log(
        `[PAYOUT PROVIDER] Creating disbursement for payout #${payoutId}: ` +
        `Rp${amount.toLocaleString("id-ID")} → ${bankCode}/${accountNumber}`
    );

    /* ==========================================
     * DEVELOPMENT MODE
     * ==========================================
     *
     * If credentials not configured, simulate
     * a successful disbursement for testing.
     */
    if (isDevelopment) {
        console.log(
            `[PAYOUT PROVIDER] DEVELOPMENT MODE — simulating successful transfer`
        );
        console.log(
            `[PAYOUT PROVIDER] NOTE: No real bank transfer executed. Configure PAYOUT_API_KEY and PAYOUT_SECRET_KEY for production.`
        );

        // Simulate processing delay
        await new Promise((resolve) => setTimeout(resolve, 100));

        const mockTransactionId = `DEV-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        return {
            success: true,
            providerTransactionId: mockTransactionId,
            providerReference: idempotencyKey,
            status: "SUCCESS",
            message:
                "Development mode: simulated successful transfer",
        };
    }

    /* ==========================================
     * PRODUCTION MODE — Midtrans Iris API
     * ==========================================
     *
     * API Endpoint: POST /disbursements
     * Docs: https://iris-docs.midtrans.com/
     */
    try {
        const bank = getBankCode(bankCode);
        const payload = {
            beneficiary_name: accountName,
            beneficiary_account: accountNumber,
            beneficiary_bank: bank,
            beneficiary_email: null,
            amount: amount,
            notes: description || `Payout #${payoutId}`,
            reference_id: idempotencyKey,
        };

        const bodyString = JSON.stringify(payload);
        const path = "/disbursements";
        const signature = generateSignature(
            path,
            "POST",
            bodyString
        );

        const response = await fetch(
            `${config.baseUrl}${path}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: `Basic ${Buffer.from(
                        `${config.apiKey}:${config.secretKey}`
                    ).toString("base64")}`,
                    "X-Signature": signature,
                    "X-Idempotency-Key": idempotencyKey,
                },
                body: bodyString,
            }
        );

        const data = await response.json();

        if (response.ok) {
            /*
             * Provider responded with 2xx.
             *  - success/completed/paid → immediate settlement
             *  - pending/processing     → async, wait for webhook
             *  - failed/rejected        → definitive rejection
             *
             * PREVIOUSLY: only "success" was handled;
             * everything else fell to the FAILED catch-all,
             * causing accepted-but-async transfers to be
             * incorrectly rolled back to PENDING.
             */
            const mappedStatus = mapProviderStatus(data.status);

            if (
                mappedStatus === "FAILED" ||
                mappedStatus === "REJECTED"
            ) {
                /*
                 * Provider accepted the HTTP request but
                 * definitively rejected the disbursement.
                 * Return success:false so the caller can
                 * transition the payout to FAILED/REJECTED
                 * instead of leaving it stuck in PROCESSING.
                 */
                return {
                    success: false,
                    status: mappedStatus,
                    message:
                        data.message ||
                        data.error_messages?.join(", ") ||
                        `Disbursement ${mappedStatus.toLowerCase()} by provider`,
                    rawResponse: data,
                };
            }

            return {
                success: true,
                providerTransactionId:
                    data.id || data.transaction_id,
                providerReference:
                    data.reference_id || idempotencyKey,
                status: mappedStatus,
                message: data.message || "Disbursement accepted",
                rawResponse: data,
            };
        }

        if (response.status === 429) {
            // Rate limited — retry may be safe
            return {
                success: false,
                status: "PENDING",
                message:
                    "Rate limited by provider. Retry later.",
                rawResponse: data,
            };
        }

        if (response.status >= 500) {
            // Server error — retry may be safe
            return {
                success: false,
                status: "PENDING",
                message: "Provider server error. Retry later.",
                rawResponse: data,
            };
        }

        /*
         * Client error (4xx) — likely invalid request.
         * This is a definitive failure: the provider
         * rejected the disbursement. Map to FAILED/REJECTED
         * based on provider message when possible.
         */
        const mappedFailure = (
            data.status === "rejected"
                ? "REJECTED"
                : "FAILED"
        );

        return {
            success: false,
            status: mappedFailure,
            message:
                data.message ||
                data.error_messages?.join(", ") ||
                "Disbursement failed",
            rawResponse: data,
        };
    } catch (error: any) {
        console.error(
            `[PAYOUT PROVIDER] Network error for payout #${payoutId}:`,
            error.message
        );
        return {
            success: false,
            status: "PENDING",
            message: `Network error: ${error.message}`,
        };
    }
}

/**
 * Check disbursement status from provider.
 *
 * Used for reconciliation when:
 * - Provider response was lost
 * - Webhook was delayed
 * - Admin wants to verify status
 */
export async function getDisbursementStatus(
    request: DisbursementStatusRequest
): Promise<DisbursementStatusResponse> {
    const { providerTransactionId, providerReference } =
        request;

    if (isDevelopment) {
        console.log(
            `[PAYOUT PROVIDER] DEVELOPMENT MODE — returning SUCCESS for ${providerTransactionId}`
        );
        return {
            success: true,
            status: "SUCCESS",
            providerTransactionId,
            message: "Development mode: simulated status check",
        };
    }

    try {
        const path = `/disbursements/status`;
        const payload = {
            ...(providerTransactionId
                ? { id: providerTransactionId }
                : {}),
            ...(providerReference
                ? { reference_id: providerReference }
                : {}),
        };

        const bodyString = JSON.stringify(payload);
        const signature = generateSignature(
            path,
            "POST",
            bodyString
        );

        const response = await fetch(
            `${config.baseUrl}${path}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: `Basic ${Buffer.from(
                        `${config.apiKey}:${config.secretKey}`
                    ).toString("base64")}`,
                    "X-Signature": signature,
                },
                body: bodyString,
            }
        );

        const data = await response.json();

        if (response.ok) {
            const status = mapProviderStatus(data.status);
            return {
                success: true,
                status,
                providerTransactionId:
                    data.id || providerTransactionId,
                message: data.message,
                rawResponse: data,
            };
        }

        return {
            success: false,
            status: "PENDING",
            message:
                data.message || "Status check failed",
            rawResponse: data,
        };
    } catch (error: any) {
        return {
            success: false,
            status: "PENDING",
            message: `Network error: ${error.message}`,
        };
    }
}

/**
 * Map provider status to our internal status.
 */
function mapProviderStatus(
    providerStatus: string
): DisbursementStatus {
    const statusMap: Record<string, DisbursementStatus> = {
        success: "SUCCESS",
        completed: "SUCCESS",
        paid: "SUCCESS",
        pending: "PENDING",
        processing: "PROCESSING",
        failed: "FAILED",
        rejected: "REJECTED",
        cancelled: "REJECTED",
        expired: "FAILED",
    };
    return (
        statusMap[providerStatus?.toLowerCase()] || "PENDING"
    );
}

/**
 * Verify webhook signature from provider.
 *
 * IMPORTANT: Implement based on actual provider webhook format.
 */
export function verifyWebhookSignature(
    payload: string,
    signature: string
): boolean {
    if (isDevelopment) {
        // In dev mode, accept all webhooks
        return true;
    }

    const expected = crypto
        .createHmac("sha512", config.secretKey)
        .update(payload)
        .digest("hex");

    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature, "utf8"),
            Buffer.from(expected, "utf8")
        );
    } catch {
        return false;
    }
}

/**
 * Get provider configuration status.
 */
export function getProviderStatus(): {
    configured: boolean;
    mode: string;
    baseUrl: string;
} {
    return {
        configured: !isDevelopment,
        mode: isDevelopment ? "development" : "production",
        baseUrl: config.baseUrl,
    };
}
