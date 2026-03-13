-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "attributeSnapshot" JSONB,
ADD COLUMN     "parentImageId" TEXT,
ADD COLUMN     "textLayerSnapshot" JSONB;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_parentImageId_fkey" FOREIGN KEY ("parentImageId") REFERENCES "GeneratedImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
