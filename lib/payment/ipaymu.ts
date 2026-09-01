/**
 * ==========================================
 * iPaymu Payment Provider
 * ==========================================
 *
 * API v2 integration for customer payment.
 * Uses Redirect Payment method.
 *
 * Signature format (from official iPaymu
 * Go/Node.js/PHP/Python libraries):
 *
 *   bodyHash = SHA256(body)
 *   stringToSign = "POST:" + VA + ":" +
 *     lowercase(bodyHash) + ":" + apiKey
 *   signature = HMAC-SHA256(stringToSign, apiKey)
 *
 * Headers required:
 *   va: Virtual Account number
 *   signature: Generated signature
 *   timestamp: YYYYMMDDHHmmss
 *
 * Production: https://my.ipaymu.com
 * Sandbox: https://sandbox.ipaymu.com
 */

import crypto from "crypto";

/* ==========================================
 * CONFIGURATION
 * ========================================== */

export const IPAYMU_CONFIG = {
    apiKey: process.env.IPAYMU_API_KEY || "",
    va: process.env.IPAYMU_VA || "",
    baseUrl:
        process.env.IPAYMU_URL ||
        (process.env.IPAYMU_IS_PRODUCTION === "true"
            ? "https://my.ipaymu.com"
            : "https://sandbox.ipaymu.com"),
};

/* ==========================================
 * SIGNATURE GENERATION
 * ==========================================
 *
 * Matches official iPaymu library behavior:
 * 1. SHA256 hash of the JSON body
 * 2. Build string: "POST:<VA>:<lowercase_hash>:<apiKey>"
 * 3. HMAC-SHA256 with apiKey as secret key
 */

export function generateSignature(
    body: string,
    va: string,
    apiKey: string
): string {
    const bodyHash = crypto
        .createHash("sha256")
        .update(body)
        .digest("hex");

    const stringToSign = `POST:${va}:${bodyHash.toLowerCase()}:${apiKey}`;

    return crypto
        .createHmac("sha256", apiKey)
        .update(stringToSign)
        .digest("hex");
}

export function generateTimestamp(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${y}${m}${d}${hh}${mm}${ss}`;
}

/* ==========================================
 * LEGACY SIGNATURE (for tests using old API)
 * ==========================================
 *
 * Kept for backward compatibility with tests
 * that compute the old outgoing signature.
 */
export function computeLegacyWebhookSignature(
    apiKey: string,
    timestamp: string,
    externalId: string,
    rawBody: string
): string {
    const payload = `${timestamp}:${externalId}:${rawBody}`;
    return crypto
        .createHmac("sha256", apiKey)
        .update(payload)
        .digest("hex");
}

/* ==========================================
 * PRODUCT DISPLAY NAME
 * ==========================================
 *
 * Safely format product + variant name.
 * If variantName is empty/null/undefined,
 * return only productName.
 *
 * Prevents trailing " - " which changes the
 * JSON body hash and causes iPaymu 401.
 */

export function formatProductName(
    productName: string,
    variantName?: string | null
): string {
    const trimmedName = productName.trim();
    const trimmedVariant = (variantName ?? "").trim();
    return trimmedVariant
        ? `${trimmedName} - ${trimmedVariant}`
        : trimmedName;
}

/* ==========================================
 * TYPES
 * ========================================== */

export type IpaymuPaymentMethod =
    | "va"
    | "banktransfer"
    | "cstore"
    | "cod"
    | "qris";

export type IpaymuPaymentChannel =
    | "bca"
    | "bni"
    | "mandiri"
    | "bri"
    | "bsi"
    | "permata"
    | "cimb"
    | "danamon"
    | "bmi"
    | "qris";

export type IpaymuCartItem = {
    product: string;
    qty: number;
    price: number;
    description?: string;
    weight?: number;
    length?: number;
    width?: number;
    height?: number;
};

export type IpaymuRedirectRequest = {
    product: string[];
    qty: string[];
    price: string[];
    amount: number;
    buyerName: string;
    buyerEmail: string;
    buyerPhone: string;
    paymentMethod: IpaymuPaymentMethod;
    paymentChannel: IpaymuPaymentChannel;
    notifyUrl: string;
    returnUrl?: string;
    cancelUrl?: string;
    referenceId?: string;
    /**
     * iPaymu requires description as a string
     * array, one entry per product item.
     */
    description?: string[];
    expired?: number;
};

export type IpaymuResponse = {
    Status: number;
    Data: {
        SessionId?: string;
        Url?: string;
    } | null;
    Message: string;
};

/* ==========================================
 * PAYMENT CREATION (Redirect)
 * ==========================================
 *
 * Endpoint: POST /api/v2/payment/
 *
 * Creates a hosted payment page. Customer
 * is redirected to Data.Url to complete
 * payment.
 */

/* ==========================================
 * REQUEST TIMEOUT (30 seconds)
 * ==========================================
 *
 * Production iPaymu API typically responds
 * within 5-10 seconds. 30s covers slow
 * network without hanging indefinitely.
 */
const IPAYMU_REQUEST_TIMEOUT_MS = 30_000;

export async function createRedirectPayment(
    request: IpaymuRedirectRequest
): Promise<IpaymuResponse> {
    const { apiKey, va, baseUrl } = IPAYMU_CONFIG;

    if (!apiKey || !va) {
        throw new Error(
            "iPaymu credentials belum dikonfigurasi."
        );
    }

    // ==========================================
    // VALIDATE AMOUNT (server-authoritative)
    // ==========================================
    if (
        !Number.isFinite(request.amount) ||
        request.amount <= 0
    ) {
        throw new Error(
            `iPaymu amount tidak valid: ${request.amount}`
        );
    }

    // ==========================================
    // VALIDATE PRODUCT ARRAYS
    // ==========================================
    if (
        !Array.isArray(request.product) ||
        request.product.length === 0
    ) {
        throw new Error("iPaymu product list kosong.");
    }

    if (
        request.product.length !== request.qty.length ||
        request.product.length !== request.price.length
    ) {
        throw new Error(
            "iPaymu product/qty/price array length mismatch."
        );
    }

    const body = JSON.stringify(request);
    const bodyHash = crypto
        .createHash("sha256")
        .update(body)
        .digest("hex");
    const signature = generateSignature(
        body,
        va,
        apiKey
    );
    const timestamp = generateTimestamp();

    // ==========================================
    // SECURITY: Never log API key or full signature
    // ==========================================
    if (process.env.NODE_ENV !== "production") {
        console.log("[iPaymu] CREATE PAYMENT:", {
            url: `${baseUrl}/api/v2/payment/`,
            amount: request.amount,
            referenceId: request.referenceId,
            method: request.paymentMethod,
            channel: request.paymentChannel,
            productCount: request.product.length,
            bodyHash: bodyHash.substring(0, 8) + "...",
            timestamp,
        });
    }

    // ==========================================
    // FETCH WITH TIMEOUT
    // ==========================================
    let response: Response;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            IPAYMU_REQUEST_TIMEOUT_MS
        );

        response = await fetch(
            `${baseUrl}/api/v2/payment/`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    va,
                    signature,
                    timestamp,
                    Accept: "application/json",
                },
                body,
                signal: controller.signal,
            }
        );

        clearTimeout(timeoutId);
    } catch (fetchError: any) {
        if (
            fetchError.name === "AbortError"
        ) {
            throw new Error(
                "iPaymu request timeout. Pembayaran tidak dapat dibuat saat ini."
            );
        }

        if (
            fetchError.cause?.code ===
                "ENOTFOUND" ||
            fetchError.message?.includes(
                "fetch failed"
            )
        ) {
            throw new Error(
                "iPaymu server tidak dapat dijangkau. Periksa koneksi internet."
            );
        }

        throw new Error(
            `iPaymu connection error: ${fetchError.message}`
        );
    }

    // ==========================================
    // PARSE RESPONSE
    // ==========================================
    let result: IpaymuResponse;

    try {
        result = await response.json();
    } catch {
        throw new Error(
            `iPaymu returned invalid JSON (HTTP ${response.status})`
        );
    }

    // ==========================================
    // SECURITY: Log safe fields only
    // ==========================================
    if (process.env.NODE_ENV !== "production") {
        console.log("[iPaymu] RESPONSE:", {
            status: result.Status,
            message: result.Message,
            hasUrl: !!result.Data?.Url,
            sessionId: result.Data?.SessionId,
        });
    }

    // ==========================================
    // VALIDATE RESPONSE
    // ==========================================
    if (result.Status !== 200) {
        // Don't expose raw error details in production
        const message =
            process.env.NODE_ENV === "production"
                ? "Gagal membuat pembayaran iPaymu."
                : result.Message ||
                  "Gagal membuat pembayaran iPaymu.";
        throw new Error(message);
    }

    if (!result.Data?.Url) {
        throw new Error(
            "iPaymu returned success but no payment URL."
        );
    }

    return result;
}

/* ==========================================
 * WEBHOOK SIGNATURE VERIFICATION
 * ==========================================
 *
 * iPaymu webhook notification is sent as
 * POST to the notifyUrl.
 *
 * The notification contains payment status
 * information. For security, we verify:
 *
 * 1. The amount matches the order total
 * 2. The signature in the callback (if present)
 *
 * NOTE: iPaymu v2 webhook notification body
 * format (based on official docs and sample
 * code):
 *
 * {
 *   "Status": 200,
 *   "SessionId": "ses_xxx",
 *   "ReferenceId": "ORDER_NUMBER",
 *   "PaymentMethod": "va",
 *   "PaymentChannel": "bca",
 *   "VirtualAccount": "1179000899",
 *   "Amount": "150000",
 *   "Fee": "0",
 *   "SenderBank": "bca",
 *   "SenderAccount": "1234567890",
 *   "BuyerName": "John Doe",
 *   "BuyerEmail": "john@example.com",
 *   "BuyerPhone": "081234567890",
 *   "Status": 200,
 *   "Message": "Payment success"
 * }
 *
 * Status mapping:
 * - Status 200 = Payment successful (berhasil)
 * - Status = pending status
 * - Other = failed/expired
 *
 * NOTE: The exact webhook payload varies.
 * We handle multiple possible formats.
 */

export type IpaymuNotification = {
    Status?: number | string;
    SessionId?: string;
    TransactionId?: string;
    ReferenceId?: string;
    PaymentMethod?: string;
    PaymentChannel?: string;
    VirtualAccount?: string;
    Amount?: string | number;
    Fee?: string | number;
    SenderBank?: string;
    SenderAccount?: string;
    BuyerName?: string;
    BuyerEmail?: string;
    BuyerPhone?: string;
    Message?: string;
    PaymentId?: string;
    payment_id?: string;
    trx_id?: string;
    status?: string;
    code?: string;
    /**
     * iPaymu webhook snake_case fields
     * (real sandbox payload)
     */
    reference_id?: string;
    sid?: string;
    status_code?: string | number;
    sub_total?: string | number;
    amount?: string | number;
    fee?: string | number;
    total?: string | number;
    settlement_status?: string;
    transaction_status_code?: string | number;
    via?: string;
    channel?: string;
    payment_no?: string;
    paid_off?: number;
    created_at?: string;
    expired_at?: string;
    paid_at?: string;
    buyer_name?: string;
    buyer_email?: string;
    buyer_phone?: string;
};

/**
 * Determine if the iPaymu notification indicates
 * a successful payment.
 *
 * iPaymu Status codes:
 * - 200 = Success (berhasil)
 * - Other codes = pending/failed/expired
 *
 * We also handle string-based status formats
 * that some iPaymu webhook versions may use.
 */
export function isSuccessNotification(
    notification: IpaymuNotification
): boolean {
    // Numeric status 200 = success
    if (notification.Status === 200) {
        return true;
    }

    // String status "berhasil" = success
    if (
        typeof notification.status === "string" &&
        notification.status.toLowerCase() ===
            "berhasil"
    ) {
        return true;
    }

    return false;
}

export function isPendingNotification(
    notification: IpaymuNotification
): boolean {
    if (
        typeof notification.Status === "number" &&
        notification.Status >= 100 &&
        notification.Status < 200
    ) {
        return true;
    }

    if (
        typeof notification.status === "string" &&
        notification.status.toLowerCase() ===
            "pending"
    ) {
        return true;
    }

    return false;
}

export function isFailedNotification(
    notification: IpaymuNotification
): boolean {
    if (
        typeof notification.Status === "number" &&
        notification.Status >= 400
    ) {
        return true;
    }

    if (
        typeof notification.status === "string" &&
        (notification.status.toLowerCase() ===
            "gagal" ||
            notification.status.toLowerCase() ===
                "failed" ||
            notification.status.toLowerCase() ===
                "expired")
    ) {
        return true;
    }

    return false;
}

/**
 * Verify the notification amount matches the
 * expected order amount.
 */
export function verifyNotificationAmount(
    notification: IpaymuNotification,
    expectedAmount: number
): boolean {
    /*
     * iPaymu webhook sends:
     * - sub_total = product total (matches order.total)
     * - amount/total = product total + fee (does NOT match)
     *
     * We compare sub_total against order.total to avoid
     * fee mismatch rejecting valid payments.
     */
    const notificationAmount = Number(
        notification.sub_total ?? notification.Amount
    );

    if (
        !Number.isFinite(notificationAmount) ||
        notificationAmount !== expectedAmount
    ) {
        return false;
    }

    return true;
}

/* ==========================================
 * CALLBACK SIGNATURE NORMALIZATION
 * ==========================================
 *
 * iPaymu callback signature verification follows
 * these steps (from official docs):
 *
 * 1. Parse form-encoded body into key-value pairs
 * 2. Normalize data types:
 *    - trx_id, status_code, transaction_status_code,
 *      paid_off → Integer
 *    - is_escrow → Boolean
 *    - additional_info → Array ([] if missing)
 *    - All other values → String
 * 3. Remove 'signature' field if present
 * 4. Ensure additional_info exists (add [] if missing)
 * 5. Sort keys alphabetically A-Z (case-sensitive)
 * 6. JSON.stringify the sorted object
 * 7. Escape forward slashes (/ → \/)
 * 8. HMAC-SHA256 with VA Number as secret key
 * 9. Compare with X-Signature header
 */
const INTEGER_KEYS = [
    "trx_id",
    "status_code",
    "transaction_status_code",
    "paid_off",
];

export function normalizeCallbackBody(
    raw: Record<string, string>
): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const key in raw) {
        const val = raw[key];

        if (key === "is_escrow") {
            result[key] = val === "true" || val === "1";
        } else if (INTEGER_KEYS.includes(key)) {
            result[key] = parseInt(val, 10);
        } else if (key === "additional_info") {
            if (val === "[]") {
                result[key] = [];
            } else {
                try {
                    const parsed = JSON.parse(val);
                    result[key] = Array.isArray(parsed) ? parsed : [];
                } catch {
                    result[key] = [];
                }
            }
        } else {
            result[key] = String(val);
        }
    }

    if (!Object.prototype.hasOwnProperty.call(result, "additional_info")) {
        result["additional_info"] = [];
    }

    return result;
}

/**
 * Sort object keys alphabetically (A-Z),
 * matching PHP json_encode behavior.
 */
function phpKsort(
    obj: Record<string, unknown>
): Record<string, unknown> {
    return Object.keys(obj)
        .sort((a, b) => a.localeCompare(b))
        .reduce(
            (sortedObj, key) => {
                sortedObj[key] = obj[key];
                return sortedObj;
            },
            {} as Record<string, unknown>
        );
}

/**
 * Compute the canonical JSON body used for callback
 * signature verification.
 *
 * 1. Normalize types
 * 2. Sort keys A-Z
 * 3. JSON.stringify
 * 4. Escape forward slashes
 */
export function computeCanonicalJson(
    raw: Record<string, string>
): string {
    const normalized = normalizeCallbackBody(raw);
    const sorted = phpKsort(normalized);
    let jsonBody = JSON.stringify(sorted);
    // Escape forward slashes to match PHP json_encode
    jsonBody = jsonBody.replace(/\//g, "\\/");
    return jsonBody;
}

/**
 * Compute the HMAC-SHA256 signature for a callback.
 *
 * Uses the VA Number (not API Key) as the secret.
 *
 * @param jsonBody - The canonical JSON string
 * @param merchantVa - The merchant VA number (secret key)
 * @returns hex-encoded HMAC-SHA256 signature
 */
export function computeWebhookSignature(
    jsonBody: string,
    merchantVa: string
): string {
    return crypto
        .createHmac("sha256", merchantVa)
        .update(jsonBody)
        .digest("hex");
}

/**
 * Verify the incoming iPaymu webhook signature.
 *
 * iPaymu callback signature algorithm (from official docs):
 * 1. Parse form body
 * 2. Normalize data types
 * 3. Sort keys A-Z
 * 4. JSON.stringify
 * 5. Escape slashes
 * 6. HMAC-SHA256(VA, canonicalJson)
 * 7. Compare with X-Signature
 *
 * @param rawBody - The exact raw HTTP body
 * @param receivedSignature - The value from X-Signature header
 * @param merchantVa - The VA Number (secret key for callback signature)
 * @returns true if signature is valid, false otherwise
 *
 * Security:
 * - Uses timingSafeEqual to prevent timing attacks
 * - Returns false on any error (fail-closed)
 */
export function verifyWebhookSignature(
    rawBody: string,
    receivedSignature: string,
    merchantVa: string
): boolean {
    // Fail-closed: no VA = cannot verify = reject
    if (!merchantVa) {
        return false;
    }

    // Fail-closed: missing signature = reject
    if (!receivedSignature) {
        return false;
    }

    try {
        // Parse the form-encoded body
        const params = new URLSearchParams(rawBody);
        const raw: Record<string, string> = {};
        params.forEach((value, key) => {
            raw[key] = value;
        });

        // Compute canonical JSON
        const canonicalJson = computeCanonicalJson(raw);

        // Compute expected signature using VA as secret
        const expectedSignature = computeWebhookSignature(
            canonicalJson,
            merchantVa
        );

        // Safe comparison using timingSafeEqual
        const receivedBuf = Buffer.from(receivedSignature, "utf8");
        const expectedBuf = Buffer.from(expectedSignature, "utf8");

        if (receivedBuf.length !== expectedBuf.length) {
            return false;
        }

        return crypto.timingSafeEqual(receivedBuf, expectedBuf);
    } catch {
        // Any error → fail-closed
        return false;
    }
}

/**
 * ==========================================
 * SERVER-TO-SERVER PAYMENT VERIFICATION
 * ==========================================
 *
 * Defense-in-depth: query iPaymu directly to
 * verify payment status. Use when:
 * 1. Webhook signature fails but payment looks legit
 * 2. First-time payment confirmation needs
 *    authoritative verification
 * 3. Reconciliation checks
 *
 * Endpoint: POST /api/v2/payment/status
 * Auth: Same headers as outgoing (va, signature, timestamp)
 */
export type PaymentStatusResponse = {
    Status: number;
    Data?: {
        Status?: string;
        Amount?: number;
        ReferenceId?: string;
        SessionId?: string;
    };
    Message?: string;
};

export async function verifyPaymentStatus(
    sessionId: string
): Promise<PaymentStatusResponse> {
    const { apiKey, va, baseUrl } = IPAYMU_CONFIG;

    if (!apiKey || !va) {
        throw new Error("iPaymu credentials belum dikonfigurasi.");
    }

    if (!sessionId) {
        throw new Error("SessionId tidak boleh kosong.");
    }

    const body = JSON.stringify({
        sessionId,
    });
    const signature = generateSignature(body, va, apiKey);
    const timestamp = generateTimestamp();

    const controller = new AbortController();
    const timeoutId = setTimeout(
        () => controller.abort(),
        15_000
    );

    try {
        const response = await fetch(
            `${baseUrl}/api/v2/payment/status`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    va,
                    signature,
                    timestamp,
                    Accept: "application/json",
                },
                body,
                signal: controller.signal,
            }
        );

        clearTimeout(timeoutId);

        const result = await response.json();
        return result;
    } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === "AbortError") {
            throw new Error("iPaymu status verification timeout.");
        }
        throw error;
    }
}

/**
 * Determine if a payment status response indicates success.
 */
export function isPaymentConfirmed(
    statusResponse: PaymentStatusResponse
): boolean {
    return (
        statusResponse.Status === 200 &&
        (
            statusResponse.Data?.Status?.toLowerCase() === "paid" ||
            statusResponse.Data?.Status?.toLowerCase() === "settlement"
        )
    );
}

/**
 * Map iPaymu payment method/channel to our
 * internal CheckoutPaymentMethod.
 */
export function mapPaymentMethod(
    method?: string,
    channel?: string
): string {
    if (method === "qris" || channel === "qris") {
        return "QRIS";
    }

    if (method === "va" || method === "banktransfer") {
        return "BANK_TRANSFER";
    }

    if (method === "cstore") {
        return "E_WALLET";
    }

    return "BANK_TRANSFER";
}
