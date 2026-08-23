/**
 * ==========================================
 * NOTIFICATION TYPES
 * ==========================================
 *
 * Provider-agnostic notification types.
 * Phase 1 foundation.
 */

export type NotificationChannel =
    | "whatsapp"
    | "email"
    | "sms"
    | "push";

export type NotificationType =
    | "ORDER_STATUS_CHANGED";

export type NotificationStatus =
    | "QUEUED"
    | "PROCESSING"
    | "SENT"
    | "FAILED";

/**
 * Event yang dihasilkan ketika
 * order status berubah.
 */
export type OrderStatusChangedEvent = {
    orderId: number;
    orderNumber: string;
    userId: string | null;
    recipientPhone: string;
    previousStatus: string;
    newStatus: string;
    total: number;
    items: Array<{
        productName: string;
        variantName: string;
        quantity: number;
        price: number;
    }>;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    shippingCourier?: string | null;
    timestamp: Date;
};

/**
 * Data yang dibutuhkan oleh
 * NotificationProvider untuk
 * mengirim notification.
 */
export type SendNotificationPayload = {
    notificationId: number;
    channel: NotificationChannel;
    notificationType: NotificationType;
    recipient: string;
    orderId: number;
    orderNumber: string;
    previousStatus: string;
    newStatus: string;
    total: number;
    items: Array<{
        productName: string;
        variantName: string;
        quantity: number;
        price: number;
    }>;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    shippingCourier?: string | null;
};

/**
 * Response dari NotificationProvider
 * setelah mengirim notification.
 */
export type SendNotificationResult = {
    success: boolean;
    providerMessageId?: string;
    errorCode?: string;
    errorMessage?: string;
};

/**
 * Notification record di database.
 */
export type NotificationRecord = {
    id: number;
    orderId: number | null;
    userId: string | null;
    channel: string;
    notificationType: string;
    recipient: string;
    idempotencyKey: string;
    providerMessageId: string | null;
    payload: string | null;
    status: NotificationStatus;
    errorCode: string | null;
    errorMessage: string | null;
    retryCount: number;
    maxRetries: number;
    createdAt: Date;
    updatedAt: Date;
};
