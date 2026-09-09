-- AddShippingDiscountQuota
-- Migration: Add quota/usage limits to ShippingDiscount (F9) and
--           attribute shipping-discount usage on Order.

-- 1. ShippingDiscount quota fields
ALTER TABLE `shippingdiscount`
  ADD COLUMN `quota` INT NULL,
  ADD COLUMN `usedCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `maxUsagePerUser` INT NULL;

-- 2. Order shipping-discount attribution
ALTER TABLE `order`
  ADD COLUMN `shippingDiscountId` INT NULL,
  ADD COLUMN `shippingDiscountName` VARCHAR(191) NULL,
  ADD COLUMN `shippingDiscountAmount` DECIMAL(12,2) NULL;

ALTER TABLE `order`
  ADD INDEX `order_shippingDiscountId_idx` (`shippingDiscountId`),
  ADD CONSTRAINT `order_shippingDiscountId_fkey`
    FOREIGN KEY (`shippingDiscountId`) REFERENCES `shippingdiscount` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;