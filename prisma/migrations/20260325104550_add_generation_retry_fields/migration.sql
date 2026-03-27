-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'RETRYING';

-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "retryReason" TEXT;
