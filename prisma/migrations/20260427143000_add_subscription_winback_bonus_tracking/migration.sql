ALTER TABLE `User`
  ADD COLUMN `subscriptionWinbackBonusPending` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `subscriptionWinbackBonusPendingAt` DATETIME(3) NULL,
  ADD COLUMN `subscriptionWinbackBonusGrantedAt` DATETIME(3) NULL,
  ADD COLUMN `subscriptionWinbackBonusGrantedSourceId` VARCHAR(191) NULL;
