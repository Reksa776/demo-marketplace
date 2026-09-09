-- F18: persist the exact original spin per order so repayment can
-- re-reserve the SAME spin (orderId on SpinWheelSpin is cleared on
-- cancel, so it cannot be used to recover the identity).

ALTER TABLE `order`
  ADD COLUMN `originalSpinWheelSpinId` INT NULL,
  ADD INDEX `order_originalSpinWheelSpinId_idx` (`originalSpinWheelSpinId`),
  ADD CONSTRAINT `order_originalSpinWheelSpinId_fkey`
    FOREIGN KEY (`originalSpinWheelSpinId`) REFERENCES `spinwheelspin` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;