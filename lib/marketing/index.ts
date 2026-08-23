/**
 * ==========================================
 * MARKETING SERVICES
 * ==========================================
 *
 * Barrel export for all marketing services.
 *
 * Usage:
 *   import { ... } from "@/lib/marketing";
 */

// Error definitions
export {
    MarketingError,
    CampaignNotFoundError,
    CampaignNotActiveError,
    VoucherNotFoundError,
    VoucherExpiredError,
    VoucherNotActiveError,
    VoucherUsageLimitError,
    VoucherQuotaExceededError,
    VoucherMinPurchaseError,
    VoucherProductNotAllowedError,
    VoucherCategoryNotAllowedError,
    VoucherCampaignMismatchError,
    DiscountNotFoundError,
    FlashSaleNotFoundError,
    FlashSaleNotActiveError,
    FlashSaleOutOfStockError,
    FlashSalePurchaseLimitError,
    PromotionNotFoundError,
} from "./errors";

// Campaign service
export {
    createCampaign,
    getCampaignById,
    getCampaignBySlug,
    listCampaigns,
    updateCampaign,
    cancelCampaign,
    deleteCampaign,
    getActiveCampaigns,
    getCampaignStatus,
    resolveCampaignForProduct,
    calculateCampaignStatus,
    isCampaignActive,
} from "./campaign";

// Discount service
export {
    createProductDiscount,
    updateProductDiscount,
    deleteProductDiscount,
    getProductDiscount,
    getActiveProductDiscount,
    calculateDiscountedPrice,
} from "./discount";

// Flash Sale service
export {
    createFlashSale,
    updateFlashSale,
    deleteFlashSale,
    getFlashSale,
    getActiveFlashSales,
    getActiveFlashSaleForVariant,
    reserveFlashSaleStock,
    releaseFlashSaleStock,
    recordFlashSalePurchase,
    getUserFlashSalePurchaseCount,
    hasReachedFlashSaleLimit,
} from "./flash-sale";

// Promotion service
export {
    createPromotion,
    updatePromotion,
    deletePromotion,
    getPromotion,
    listPromotions,
    getActivePromotions,
    getHomepagePromotions,
    getCampaignPromotions,
} from "./promotion";

// Pricing engine
export {
    resolveProductPrice,
    resolveCampaignDiscount,
    calculateItemPricing,
    calculateOrderPricing,
    getDisplayPrice,
} from "./pricing";

// Bulk discount service
export {
    createBulkDiscount,
    updateBulkDiscount,
    deleteBulkDiscount,
    getBulkDiscount,
    listBulkDiscounts,
    getActiveBulkDiscounts,
    resolveBulkDiscount,
} from "./bulk-discount";

// Shipping discount service
export {
    createShippingDiscount,
    updateShippingDiscount,
    deleteShippingDiscount,
    getShippingDiscount,
    listShippingDiscounts,
    calculateShippingDiscount,
} from "./shipping-discount";

// Broadcast service
export {
    createBroadcast,
    updateBroadcast,
    deleteBroadcast,
    getBroadcast,
    listBroadcasts,
    getBroadcastAudience,
    sendBroadcast,
    processScheduledBroadcasts,
    VALID_TRANSITIONS,
    validateStatusTransition,
    BROADCAST_TYPE_LABELS,
    BROADCAST_TYPE_DESCRIPTIONS,
} from "./broadcast";

// Batch pricing utility
export {
    resolveBatchPrices,
} from "./batch-pricing";

export type {
    BatchPricingItemInput,
    BatchPricingResult,
} from "./batch-pricing";

// Types
export type {
    CampaignWithRelations,
    CampaignListItem,
} from "./campaign";

export type {
    DiscountCalculationResult,
} from "./discount";

export type {
    FlashSaleWithProduct,
} from "./flash-sale";

export type {
    PromotionWithPlacement,
} from "./promotion";

export type {
    PriceSource,
    ItemPricingResult,
    OrderPricingResult,
    PricingItemInput,
} from "./pricing";
