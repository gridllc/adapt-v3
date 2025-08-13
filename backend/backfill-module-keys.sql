-- Backfill missing s3Key and stepsKey for existing modules
-- Run this against your Render Postgres database

-- Update s3Key for modules where it's NULL or empty
UPDATE public.modules
SET "s3Key" = 'videos/' || id || '.mp4'
WHERE "s3Key" IS NULL OR "s3Key" = '';

-- Update stepsKey for modules where it's NULL or empty
UPDATE public.modules
SET "stepsKey" = 'training/' || id || '.json'
WHERE "stepsKey" IS NULL OR "stepsKey" = '';

-- Sanity check - should return 0 for both counts after the update
SELECT
  SUM(CASE WHEN "s3Key" IS NULL OR "s3Key" = '' THEN 1 ELSE 0 END) AS null_s3key,
  SUM(CASE WHEN "stepsKey" IS NULL OR "stepsKey" = '' THEN 1 ELSE 0 END) AS null_stepskey
FROM public.modules;
