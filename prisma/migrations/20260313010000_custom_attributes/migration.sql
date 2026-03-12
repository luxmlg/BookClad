-- Add attributes column with default, backfill from existing columns, then drop old columns

-- Step 1: Add attributes column with a default
ALTER TABLE "CoverProject" ADD COLUMN "attributes" JSONB NOT NULL DEFAULT '{}';

-- Step 2: Backfill attributes from existing genre/mood/style columns
UPDATE "CoverProject" SET "attributes" = jsonb_build_object(
  'genre', "genre",
  'mood', to_jsonb("mood"),
  'style', "style"
);

-- Step 3: Drop old columns
ALTER TABLE "CoverProject" DROP COLUMN "genre";
ALTER TABLE "CoverProject" DROP COLUMN "mood";
ALTER TABLE "CoverProject" DROP COLUMN "style";

-- Step 4: Remove the default (column is required but no default in schema)
ALTER TABLE "CoverProject" ALTER COLUMN "attributes" DROP DEFAULT;

-- Step 5: Create AttributeConfig table
CREATE TABLE "AttributeConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributeConfig_pkey" PRIMARY KEY ("id")
);

-- Step 6: Create StylePreset table
CREATE TABLE "StylePreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "promptTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StylePreset_pkey" PRIMARY KEY ("id")
);

-- Step 7: Create indexes and unique constraints
CREATE UNIQUE INDEX "AttributeConfig_userId_key" ON "AttributeConfig"("userId");
CREATE INDEX "StylePreset_userId_idx" ON "StylePreset"("userId");

-- Step 8: Add foreign keys
ALTER TABLE "AttributeConfig" ADD CONSTRAINT "AttributeConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StylePreset" ADD CONSTRAINT "StylePreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
