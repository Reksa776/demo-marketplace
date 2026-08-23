-- AlterTable: Add eligibility to Voucher
ALTER TABLE `Voucher` ADD COLUMN `eligibility` ENUM('ALL', 'NEW_USER', 'RETURNING_USER') NOT NULL DEFAULT 'ALL';

-- CreateTable: BulkDiscount
CREATE TABLE `BulkDiscount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `productId` INTEGER NOT NULL,
    `variantId` INTEGER NULL,
    `minQuantity` INTEGER NOT NULL,
    `type` ENUM('PERCENTAGE', 'FIXED') NOT NULL,
    `value` DECIMAL(12, 2) NOT NULL,
    `maxDiscount` DECIMAL(12, 2) NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `BulkDiscount_productId_idx`(`productId`),
    INDEX `BulkDiscount_variantId_idx`(`variantId`),
    INDEX `BulkDiscount_isActive_startAt_endAt_idx`(`isActive`, `startAt`, `endAt`),
    CONSTRAINT `BulkDiscount_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `BulkDiscount_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: ShippingDiscount
CREATE TABLE `ShippingDiscount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `type` ENUM('PERCENTAGE', 'FIXED') NOT NULL,
    `value` DECIMAL(12, 2) NOT NULL,
    `maxDiscount` DECIMAL(12, 2) NULL,
    `minPurchase` DECIMAL(12, 2) NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `ShippingDiscount_code_key`(`code`),
    INDEX `ShippingDiscount_isActive_startAt_endAt_idx`(`isActive`, `startAt`, `endAt`),
    INDEX `ShippingDiscount_code_idx`(`code`)
);

-- CreateTable: Broadcast
CREATE TABLE `Broadcast` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('BEST_SELLER', 'NEW_PRODUCT', 'BUY_AGAIN', 'INACTIVE_BUYER', 'PRICE_DROP', 'CART_REMINDER', 'CHECKOUT_REMINDER', 'THANK_YOU') NOT NULL,
    `channel` ENUM('whatsapp', 'email', 'sms', 'push') NOT NULL,
    `subject` TEXT NULL,
    `message` TEXT NOT NULL,
    `imageUrl` TEXT NULL,
    `link` TEXT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    `scheduledAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `audienceCount` INTEGER NOT NULL DEFAULT 0,
    `sentCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `Broadcast_type_idx`(`type`),
    INDEX `Broadcast_status_idx`(`status`),
    INDEX `Broadcast_createdAt_idx`(`createdAt`)
);
