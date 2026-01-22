-- CreateEnum
CREATE TYPE "public"."ProductType" AS ENUM ('CANDLE');

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "scentProfile" TEXT[],
ADD COLUMN     "type" "public"."ProductType" NOT NULL DEFAULT 'CANDLE';
