-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "imageCount" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "jobType" TEXT NOT NULL DEFAULT 'generate',
ADD COLUMN     "referenceImage" TEXT;
