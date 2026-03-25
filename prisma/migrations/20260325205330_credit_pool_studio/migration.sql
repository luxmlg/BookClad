-- AlterEnum
ALTER TYPE "Tier" ADD VALUE 'STUDIO';

-- AlterTable
ALTER TABLE "Generation" ALTER COLUMN "model" SET DEFAULT 'quick';

-- CreateTable
CREATE TABLE "CreditPool" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "originalAmount" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditPool_userId_priority_createdAt_idx" ON "CreditPool"("userId", "priority", "createdAt");

-- AddForeignKey
ALTER TABLE "CreditPool" ADD CONSTRAINT "CreditPool_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
