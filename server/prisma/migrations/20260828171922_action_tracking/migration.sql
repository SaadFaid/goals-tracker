-- AlterTable
ALTER TABLE "Action" ADD COLUMN     "incrementBy" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "lastResetAt" TIMESTAMP(3),
ADD COLUMN     "resetType" TEXT NOT NULL DEFAULT 'monthly';
