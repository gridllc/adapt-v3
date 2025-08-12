/*
  Warnings:

  - You are about to drop the column `description` on the `steps` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `steps` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `steps` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `steps` table. All the data in the column will be lost.

*/

-- Step 1: Add new columns with temporary default values
ALTER TABLE "public"."steps" 
ADD COLUMN "text" TEXT DEFAULT '',
ADD COLUMN "startTime" INTEGER DEFAULT 0,
ADD COLUMN "endTime" INTEGER DEFAULT 15,
ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Migrate existing data from old columns to new columns
UPDATE "public"."steps" 
SET 
  "text" = COALESCE("title", "description", ''),
  "startTime" = COALESCE("timestamp", 0),
  "endTime" = COALESCE("timestamp", 0) + COALESCE("duration", 15),
  "updatedAt" = CURRENT_TIMESTAMP;

-- Step 3: Make new columns required (remove defaults)
ALTER TABLE "public"."steps" 
ALTER COLUMN "text" SET NOT NULL,
ALTER COLUMN "startTime" SET NOT NULL,
ALTER COLUMN "endTime" SET NOT NULL,
ALTER COLUMN "updatedAt" SET NOT NULL;

-- Step 4: Drop old columns
ALTER TABLE "public"."steps" 
DROP COLUMN "description",
DROP COLUMN "duration",
DROP COLUMN "timestamp",
DROP COLUMN "title";
