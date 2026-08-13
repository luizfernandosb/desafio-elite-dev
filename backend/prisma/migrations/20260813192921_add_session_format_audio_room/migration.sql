-- CreateEnum
CREATE TYPE "EventFormat" AS ENUM ('TWO_D', 'THREE_D');

-- CreateEnum
CREATE TYPE "EventAudio" AS ENUM ('DUBBED', 'SUBTITLED');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('STANDARD', 'VIP');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "audio" "EventAudio" NOT NULL DEFAULT 'DUBBED',
ADD COLUMN     "format" "EventFormat" NOT NULL DEFAULT 'TWO_D',
ADD COLUMN     "roomType" "RoomType" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "vipSurchargePercent" INTEGER;
