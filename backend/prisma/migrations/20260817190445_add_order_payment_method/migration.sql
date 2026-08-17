-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('FAKE', 'STRIPE');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'FAKE';
