-- CreateTable
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "generationId" TEXT,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "candidatesTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(10,6),
    "success" BOOLEAN NOT NULL,
    "durationMs" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "errorCode" TEXT,
    "errorType" TEXT,
    "errorMessage" TEXT,
    "errorDetails" JSONB,
    "responseMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiUsage_userId_idx" ON "ApiUsage"("userId");

-- CreateIndex
CREATE INDEX "ApiUsage_generationId_idx" ON "ApiUsage"("generationId");

-- CreateIndex
CREATE INDEX "ApiUsage_type_idx" ON "ApiUsage"("type");

-- CreateIndex
CREATE INDEX "ApiUsage_createdAt_idx" ON "ApiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "ApiUsage_success_idx" ON "ApiUsage"("success");

-- AddForeignKey
ALTER TABLE "ApiUsage" ADD CONSTRAINT "ApiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiUsage" ADD CONSTRAINT "ApiUsage_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
