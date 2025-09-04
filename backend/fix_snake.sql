DO $$
BEGIN
  -- QUESTIONS
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='moduleId') THEN
    ALTER TABLE questions RENAME COLUMN "moduleId" TO module_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='isFAQ') THEN
    ALTER TABLE questions RENAME COLUMN "isFAQ" TO is_faq;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='createdAt') THEN
    ALTER TABLE questions RENAME COLUMN "createdAt" TO created_at;
  END IF;

  -- QUESTION_VECTORS
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='question_vectors' AND column_name='questionId') THEN
    ALTER TABLE question_vectors RENAME COLUMN "questionId" TO question_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='question_vectors' AND column_name='createdAt') THEN
    ALTER TABLE question_vectors RENAME COLUMN "createdAt" TO created_at;
  END IF;

  -- STEPS
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='steps' AND column_name='moduleId') THEN
    ALTER TABLE steps RENAME COLUMN "moduleId" TO module_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='steps' AND column_name='startTime') THEN
    ALTER TABLE steps RENAME COLUMN "startTime" TO start_time;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='steps' AND column_name='endTime') THEN
    ALTER TABLE steps RENAME COLUMN "endTime" TO end_time;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='steps' AND column_name='aiConfidence') THEN
    ALTER TABLE steps RENAME COLUMN "aiConfidence" TO ai_confidence;
  END IF;

  -- MODULES (usually already snake, but keep for safety)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='modules' AND column_name='videoUrl') THEN
    ALTER TABLE modules RENAME COLUMN "videoUrl" TO video_url;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='modules' AND column_name='s3Key') THEN
    ALTER TABLE modules RENAME COLUMN "s3Key" TO s3_key;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='modules' AND column_name='createdAt') THEN
    ALTER TABLE modules RENAME COLUMN "createdAt" TO created_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='modules' AND column_name='updatedAt') THEN
    ALTER TABLE modules RENAME COLUMN "updatedAt" TO updated_at;
  END IF;
END $$;
