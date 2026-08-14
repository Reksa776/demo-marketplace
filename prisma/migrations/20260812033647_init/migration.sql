/*
  Warnings:

  - You are about to drop the column `completedAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `paymentReference` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `shippedAt` on the `Order` table. All the data in the column will be lost.
  - The values [BANK_TRANSFER,E_WALLET] on the enum `Order_paymentMethod` will be removed. If these variants are still used in the database, this will fail.

*/
-- DropIndex
DROP INDEX `Order_paymentReference_key` ON `Order`;

-- AlterTable
ALTER TABLE `Order` DROP COLUMN `completedAt`,
    DROP COLUMN `paymentReference`,
    DROP COLUMN `shippedAt`,
    MODIFY `paymentMethod` ENUM('COD', 'MITRANS') NOT NULL DEFAULT 'COD';
