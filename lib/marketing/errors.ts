/**
 * ==========================================
 * MARKETING SERVICE ERRORS
 * ==========================================
 *
 * Consistent error types for all marketing services.
 * Never expose database/internal errors directly to users.
 */

export class MarketingError extends Error {
    public readonly code: string;
    public readonly statusCode: number;

    constructor(code: string, message: string, statusCode: number = 400) {
        super(message);
        this.name = "MarketingError";
        this.code = code;
        this.statusCode = statusCode;
    }
}

// ==========================================
// CAMPAIGN ERRORS
// ==========================================

export class CampaignNotFoundError extends MarketingError {
    constructor(identifier?: string | number) {
        super(
            "CAMPAIGN_NOT_FOUND",
            identifier
                ? `Kampanye "${identifier}" tidak ditemukan.`
                : "Kampanye tidak ditemukan.",
            404
        );
    }
}

export class CampaignNotActiveError extends MarketingError {
    constructor() {
        super(
            "CAMPAIGN_NOT_ACTIVE",
            "Kampanye ini sedang tidak aktif.",
            400
        );
    }
}

// ==========================================
// VOUCHER ERRORS
// ==========================================

export class VoucherNotFoundError extends MarketingError {
    constructor() {
        super("VOUCHER_NOT_FOUND", "Kode voucher tidak ditemukan.", 404);
    }
}

export class VoucherExpiredError extends MarketingError {
    constructor() {
        super("VOUCHER_EXPIRED", "Voucher ini sudah kedaluwarsa.", 400);
    }
}

export class VoucherNotActiveError extends MarketingError {
    constructor() {
        super(
            "VOUCHER_NOT_ACTIVE",
            "Voucher ini sudah tidak aktif.",
            400
        );
    }
}

export class VoucherUsageLimitError extends MarketingError {
    constructor() {
        super(
            "VOUCHER_USAGE_LIMIT",
            "Anda sudah mencapai batas penggunaan voucher ini.",
            400
        );
    }
}

export class VoucherQuotaExceededError extends MarketingError {
    constructor() {
        super(
            "VOUCHER_QUOTA_EXCEEDED",
            "Kuota voucher ini sudah habis.",
            400
        );
    }
}

export class VoucherMinPurchaseError extends MarketingError {
    constructor(minPurchase: number) {
        super(
            "VOUCHER_MIN_PURCHASE",
            `Minimal belanja Rp ${minPurchase.toLocaleString("id-ID")} untuk pakai voucher ini.`,
            400
        );
    }
}

export class VoucherProductNotAllowedError extends MarketingError {
    constructor() {
        super(
            "VOUCHER_PRODUCT_NOT_ALLOWED",
            "Voucher ini tidak berlaku untuk produk yang dipilih.",
            400
        );
    }
}

export class VoucherCategoryNotAllowedError extends MarketingError {
    constructor() {
        super(
            "VOUCHER_CATEGORY_NOT_ALLOWED",
            "Voucher ini tidak berlaku untuk kategori produk yang dipilih.",
            400
        );
    }
}

export class VoucherCampaignMismatchError extends MarketingError {
    constructor() {
        super(
            "VOUCHER_CAMPAIGN_MISMATCH",
            "Voucher ini hanya berlaku dalam kampanye tertentu.",
            400
        );
    }
}

// ==========================================
// DISCOUNT ERRORS
// ==========================================

export class DiscountNotFoundError extends MarketingError {
    constructor() {
        super("DISCOUNT_NOT_FOUND", "Diskon tidak ditemukan.", 404);
    }
}

// ==========================================
// FLASH SALE ERRORS
// ==========================================

export class FlashSaleNotFoundError extends MarketingError {
    constructor() {
        super("FLASH_SALE_NOT_FOUND", "Flash sale tidak ditemukan.", 404);
    }
}

export class FlashSaleNotActiveError extends MarketingError {
    constructor() {
        super(
            "FLASH_SALE_NOT_ACTIVE",
            "Flash sale ini sedang tidak aktif.",
            400
        );
    }
}

export class FlashSaleOutOfStockError extends MarketingError {
    constructor() {
        super(
            "FLASH_SALE_OUT_OF_STOCK",
            "Stok flash sale sudah habis.",
            400
        );
    }
}

export class FlashSalePurchaseLimitError extends MarketingError {
    constructor(limit: number) {
        super(
            "FLASH_SALE_PURCHASE_LIMIT",
            `Anda sudah mencapai batas pembelian flash sale (${limit}x).`,
            400
        );
    }
}

// ==========================================
// PROMOTION ERRORS
// ==========================================

export class PromotionNotFoundError extends MarketingError {
    constructor() {
        super("PROMOTION_NOT_FOUND", "Promosi tidak ditemukan.", 404);
    }
}
