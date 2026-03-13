-- CreateTable
CREATE TABLE "UserAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFont" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFont_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAsset_projectId_idx" ON "UserAsset"("projectId");

-- CreateIndex
CREATE INDEX "UserAsset_userId_idx" ON "UserAsset"("userId");

-- CreateIndex
CREATE INDEX "UserFont_userId_idx" ON "UserFont"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFont_userId_family_key" ON "UserFont"("userId", "family");

-- AddForeignKey
ALTER TABLE "UserAsset" ADD CONSTRAINT "UserAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CoverProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAsset" ADD CONSTRAINT "UserAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFont" ADD CONSTRAINT "UserFont_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
