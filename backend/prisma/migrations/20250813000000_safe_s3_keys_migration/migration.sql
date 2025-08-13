-- Migration: safe_s3_keys_migration
-- Created at: 2025-08-13 00:00:00.000000Z
-- Description: Safe migration to add canonical S3 keys and convert status to enum

-- Safe migration to add canonical S3 keys and convert status to enum
-- This preserves all existing data

-- 1) Create the enum type
CREATE TYPE "ModuleStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'FAILED');

-- 2) Add new columns (nullable initially)
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "s3Key" TEXT;
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "stepsKey" TEXT;
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "lastError" TEXT;

-- 3) Add temporary enum column with default
ALTER TABLE "modules" ADD COLUMN "status_new" "ModuleStatus" NOT NULL DEFAULT 'UPLOADED';

-- 4) Copy/normalize text values into the enum (preserve existing data)
UPDATE "modules"
SET "status_new" = CASE LOWER(COALESCE(status, 'processing'))
  WHEN 'uploaded'   THEN 'UPLOADED'::"ModuleStatus"
  WHEN 'processing' THEN 'PROCESSING'::"ModuleStatus"
  WHEN 'ready'      THEN 'READY'::"ModuleStatus"
  WHEN 'completed'  THEN 'READY'::"ModuleStatus"  -- Map 'completed' to 'READY'
  WHEN 'failed'     THEN 'FAILED'::"ModuleStatus"
  WHEN 'error'      THEN 'FAILED'::"ModuleStatus"  -- Map 'error' to 'FAILED'
  ELSE 'UPLOADED'::"ModuleStatus"
END;

-- 5) Set default values for existing records (generate canonical keys)
UPDATE "modules" SET 
  "s3Key" = CONCAT('videos/', id, '.mp4'),
  "stepsKey" = CONCAT('training/', id, '.json')
WHERE "s3Key" IS NULL OR "stepsKey" IS NULL;

-- 6) Make the new columns required
ALTER TABLE "modules" ALTER COLUMN "s3Key" SET NOT NULL;
ALTER TABLE "modules" ALTER COLUMN "stepsKey" SET NOT NULL;

-- 7) Drop old text column (after successful copy)
ALTER TABLE "modules" DROP COLUMN "status";

-- 8) Rename temp column to final name
ALTER TABLE "modules" RENAME COLUMN "status_new" TO "status";

-- 9) Archive the module_statuses table before dropping (safety)
CREATE TABLE IF NOT EXISTS "module_statuses_archive" AS TABLE "module_statuses";

-- 10) Drop the old lookup table (only after successful migration)
DROP TABLE IF EXISTS "module_statuses";

-- 11) Add foreign key constraints for the new fields
-- (These will be handled by Prisma in the next migration)
