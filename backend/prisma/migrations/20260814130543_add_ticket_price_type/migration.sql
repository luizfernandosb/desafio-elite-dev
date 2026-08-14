-- CreateEnum
CREATE TYPE "TicketPriceType" AS ENUM ('FULL', 'HALF');

-- AlterTable
ALTER TABLE "SeatHold" ADD COLUMN     "priceType" "TicketPriceType" NOT NULL DEFAULT 'FULL';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "priceType" "TicketPriceType" NOT NULL DEFAULT 'FULL';
