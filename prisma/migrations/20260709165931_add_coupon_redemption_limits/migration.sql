-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "allowFreeOrders" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxRedemptions" INTEGER,
ADD COLUMN     "perUserLimit" INTEGER,
ADD COLUMN     "usedCount" INTEGER NOT NULL DEFAULT 0;

