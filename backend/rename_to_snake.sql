DO $$
BEGIN
  -- modules
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=''modules'' AND column_name=''createdAt'') THEN
    ALTER TABLE modules RENAME COLUMN "createdAt" TO created_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=''modules'' AND column_name=''updatedAt'') THEN
    ALTER TABLE modules RENAME COLUMN "updatedAt" TO updated_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=''modules'' AND column_name=''videoUrl'') THEN
    ALTER TABLE modules RENAME COLUMN "videoUrl" TO video_url;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=''modules'' AND column_name=''s3Key'') THEN
    ALTER TABLE modules RENAME COLUMN "s3Key" TO s3_key;
  END IF;

  -- questions
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=''questions'' AND column_name=''createdAt'') THEN
    ALTER TABLE questions RENAME COLUMN "createdAt" TO created_at;
  END IF;

  -- steps
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=''steps'' AND column_name=''aiConfidence'') THEN
    ALTER TABLE steps RENAME COLUMN "aiConfidence" TO ai_confidence;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=''steps'' AND column_name=''startTime'') THEN
    ALTER TABLE steps RENAME COLUMN "startTime" TO start_time;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=''steps'' AND column_name=''endTime'') THEN
    ALTER TABLE steps RENAME COLUMN "endTime" TO end_time;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=''steps'' AND column_name=''createdAt'') THEN
    ALTER TABLE steps RENAME COLUMN "createdAt" TO created_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=''steps'' AND column_name=''updatedAt'') THEN
    ALTER TABLE steps RENAME COLUMN "updatedAt" TO updated_at;
  END IF;
END $$;
