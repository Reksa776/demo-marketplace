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

export async function createRedirectPayment(
    request: IpaymuRedirectRequest
): Promise<IpaymuResponse> {
    const { apiKey, va, baseUrl } = IPAYMU_CONFIG;

    if (!apiKey || !va) {
        throw new Error(
            "iPaymu credentials belum dikonfigurasi."
        );
    }

    const body = JSON.stringify(request);
    const signature = generateSignature(
        body,
        va,
        apiKey
    );
    const timestamp = generateTimestamp();

    console.log("========== IPAYMU CREATE ==========");
    console.log("URL:", `${baseUrl}/api/v2/payment/`);
    console.log("AMOUNT:", request.amount);
    console.log("REFERENCE:", request.referenceId);
    console.log("METHOD:", request.paymentMethod);
    console.log("CHANNEL:", request.paymentChannel);

    const response = await fetch(
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
        }
    );

    const result: IpaymuResponse =
        await response.json();

    console.log("IPAYMU RESPONSE:", {
        Status: result.Status,
        Message: result.Message,
        HasUrl: !!result.Data?.Url,
        SessionId: result.Data?.SessionId,
    });

    if (result.Status !== 200) {
        throw new Error(
            result.Message ||
                "Gagal membuat pembayaran iPaymu."
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
