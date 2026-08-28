-- AddRefundSystem
-- Migration: Add REFUND_PENDING to Order.status enum and create Refund table

-- 1. Add REFUND_PENDING to Order.status enum
ALTER TABLE `Order`
  MODIFY COLUMN `status` enum('PENDING','PAID','PROCESSING','SHIPPED','COMPLETED','CANCELLED','REFUND_PENDING') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING';

-- 2. Create Refund table
CREATE TABLE `Refund` (
  `id` int NOT NULL AUTO_INCREMENT,
  `orderId` int NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `reason` text,
  `status` enum('PENDING','PROCESSING','COMPLETED','FAILED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `requestedBy` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `processedBy` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `providerRef` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Refund_orderId_key` (`orderId`),
  KEY `Refund_status_idx` (`status`),
  KEY `Refund_createdAt_idx` (`createdAt`),
  CONSTRAINT `Refund_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
