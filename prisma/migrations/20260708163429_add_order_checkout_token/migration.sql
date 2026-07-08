-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "checkoutToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_checkoutToken_key" ON "Order"("checkoutToken");

