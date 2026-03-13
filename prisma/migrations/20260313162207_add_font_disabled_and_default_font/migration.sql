-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultFont" TEXT NOT NULL DEFAULT 'Playfair Display';

-- AlterTable
ALTER TABLE "UserFont" ADD COLUMN     "disabled" BOOLEAN NOT NULL DEFAULT false;
