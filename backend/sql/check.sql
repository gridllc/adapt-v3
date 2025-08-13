SELECT
  SUM(CASE WHEN "s3Key"   IS NULL OR "s3Key"   = '' THEN 1 ELSE 0 END) AS null_s3key,
  SUM(CASE WHEN "stepsKey" IS NULL OR "stepsKey" = '' THEN 1 ELSE 0 END) AS null_stepskey
FROM public.modules;
