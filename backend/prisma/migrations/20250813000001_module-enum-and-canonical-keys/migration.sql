-- Migration: module-enum-and-canonical-keys
-- Created at: 2025-08-13 00:00:01.000000Z
-- Description: Safe migration to convert status to enum and add canonical S3 keys

-- === 1) Enum type ===
DO $$ BEGIN
  CREATE TYPE "ModuleStatus" AS ENUM ('UPLOADED','PROCESSING','READY','FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- === 2) Add temp enum column ===
ALTER TABLE "public"."modules"
  ADD COLUMN IF NOT EXISTS "status_new" "ModuleStatus" NOT NULL DEFAULT 'UPLOADED';

-- === 3) Try to copy from latest entry in module_statuses (if table exists) ===
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='module_statuses'
  ) THEN
    WITH latest AS (
      SELECT ms."moduleId",
             ms."status",
             ms."progress",
             ms."createdAt",
             ROW_NUMBER() OVER (PARTITION BY ms."moduleId" ORDER BY ms."createdAt" DESC) AS rn
      FROM "public"."module_statuses" ms
    )
    UPDATE "public"."modules" m
    SET
      "status_new" = CASE LOWER(l.status)
        WHEN 'uploaded'   THEN 'UPLOADED'::"ModuleStatus"
        WHEN 'processing' THEN 'PROCESSING'::"ModuleStatus"
        WHEN 'ready'      THEN 'READY'::"ModuleStatus"
        WHEN 'failed'     THEN 'FAILED'::"ModuleStatus"
        ELSE 'UPLOADED'::"ModuleStatus"
      END,
      "progress" = COALESCE(l."progress", m."progress")
    FROM latest l
    WHERE l.rn = 1 AND l."moduleId" = m."id";
  END IF;
END $$;

-- === 4) For any remaining rows, copy/normalize from text column modules.status if it exists ===
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='modules' AND column_name='status'
  ) THEN
    UPDATE "public"."modules"
    SET "status_new" = CASE LOWER(COALESCE("status",'uploaded'))
      WHEN 'uploaded'   THEN 'UPLOADED'::"ModuleStatus"
      WHEN 'processing' THEN 'PROCESSING'::"ModuleStatus"
      WHEN 'ready'      THEN 'READY'::"ModuleStatus"
      WHEN 'failed'     THEN 'FAILED'::"ModuleStatus"
      ELSE 'UPLOADED'::"ModuleStatus"
    END
    WHERE "id" IN (
      SELECT "id" FROM "public"."modules"
      WHERE "status_new" IS DISTINCT FROM 'UPLOADED'::"ModuleStatus" IS NOT TRUE  -- optional noop
    );
  END IF;
END $$;

-- === 5) Add canonical keys and backfill if NULL ===
ALTER TABLE "public"."modules"
  ADD COLUMN IF NOT EXISTS "s3Key"   TEXT,
  ADD COLUMN IF NOT EXISTS "stepsKey" TEXT;

UPDATE "public"."modules"
SET "s3Key" = COALESCE("s3Key", 'videos/' || "id" || '.mp4');

UPDATE "public"."modules"
SET "stepsKey" = COALESCE("stepsKey", 'training/' || "id" || '.json');

-- Make them NOT NULL now that they're filled
ALTER TABLE "public"."modules" ALTER COLUMN "s3Key" SET NOT NULL;
ALTER TABLE "public"."modules" ALTER COLUMN "stepsKey" SET NOT NULL;

-- === 6) Drop old text column and swap temp into final ===
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='modules' AND column_name='status'
  ) THEN
    ALTER TABLE "public"."modules" DROP COLUMN "status";
  END IF;
END $$;

ALTER TABLE "public"."modules" RENAME COLUMN "status_new" TO "status";

-- === 7) Archive and drop module_statuses (optional) ===
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='module_statuses'
  ) THEN
    -- Archive
    CREATE TABLE IF NOT EXISTS "public"."module_statuses_archive" AS
      SELECT * FROM "public"."module_statuses";
    -- Drop FK first if present
    ALTER TABLE IF EXISTS "public"."module_statuses" DROP CONSTRAINT IF EXISTS "module_statuses_moduleId_fkey";
    -- Drop table
    DROP TABLE IF EXISTS "public"."module_statuses";
  END IF;
END $$;

-- === 8) (Optional) Helpful index for lookups by user
-- CREATE INDEX IF NOT EXISTS modules_userid_idx ON "public"."modules" ("userId");
