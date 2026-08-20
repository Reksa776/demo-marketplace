/*
  Warnings:

  - You are about to alter the column `tiktokPixelId` on the `StoreSetting` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.

*/
-- AlterTable
ALTER TABLE `StoreSetting` MODIFY `tiktokPixelId` VARCHAR(100) NULL;
