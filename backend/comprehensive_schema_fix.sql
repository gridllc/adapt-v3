-- Complete production schema fix for Adapt V3
-- Fixes: question_vectors (pgvector), feedbacks, ai_interactions tables
-- Handles column type conversions and missing tables

BEGIN;

-- 1) Ensure pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Fix question_vectors table
DO $$
BEGIN
  -- Drop any conflicting indexes first
  DROP INDEX IF EXISTS public.question_vectors_embedding_idx;
  DROP INDEX IF EXISTS public.question_embedding_vector_idx;

  -- Remove existing FK if it exists
  ALTER TABLE IF EXISTS public.question_vectors
    DROP CONSTRAINT IF EXISTS question_vectors_question_id_fkey;
  ALTER TABLE IF EXISTS public.question_vectors
    DROP CONSTRAINT IF EXISTS question_vectors_questionId_fkey;

  -- Handle existing table with wrong column type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='question_vectors'
      AND column_name='embedding' AND udt_name <> 'vector'
  ) THEN
    -- Rename old table for safety (data will be lost but user approved)
    ALTER TABLE public.question_vectors
      RENAME TO question_vectors_old;

    -- Create new table with correct structure
    CREATE TABLE public.question_vectors (
      question_id TEXT PRIMARY KEY,
      embedding vector(1536) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      model_name TEXT DEFAULT 'openai-embedding-3-small'
    );

    -- Drop old table
    DROP TABLE IF EXISTS question_vectors_old;
  END IF;

  -- Create table if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='question_vectors'
  ) THEN
    CREATE TABLE public.question_vectors (
      question_id TEXT PRIMARY KEY,
      embedding vector(1536) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      model_name TEXT DEFAULT 'openai-embedding-3-small'
    );
  END IF;
END$$;

-- 3) Ensure feedbacks table exists
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "moduleId" TEXT NOT NULL,
  type TEXT NOT NULL,
  action TEXT NOT NULL,
  context TEXT,
  "sessionId" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4) Ensure ai_interactions table exists
CREATE TABLE IF NOT EXISTS public.ai_interactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "moduleId" TEXT NOT NULL,
  "userMessage" TEXT NOT NULL,
  "aiResponse" TEXT NOT NULL,
  source TEXT,
  context JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "sourceModel" TEXT,
  "usedMemory" BOOLEAN NOT NULL DEFAULT false
);

-- 5) Add foreign key constraints
DO $$
BEGIN
  -- feedbacks -> modules
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'feedbacks_moduleId_fkey'
  ) THEN
    ALTER TABLE public.feedbacks
      ADD CONSTRAINT feedbacks_moduleId_fkey
      FOREIGN KEY ("moduleId") REFERENCES public.modules(id) ON DELETE CASCADE;
  END IF;
END$$;

-- 6) Add indexes for performance
CREATE INDEX IF NOT EXISTS feedbacks_moduleId_idx ON public.feedbacks ("moduleId");
CREATE INDEX IF NOT EXISTS feedbacks_createdAt_idx ON public.feedbacks ("createdAt");
CREATE INDEX IF NOT EXISTS ai_interactions_moduleId_idx ON public.ai_interactions ("moduleId");
CREATE INDEX IF NOT EXISTS ai_interactions_createdAt_idx ON public.ai_interactions ("createdAt");

-- 7) Add foreign key for question_vectors
ALTER TABLE public.question_vectors
  ADD CONSTRAINT question_vectors_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;

-- 8) Create vector index for question_vectors
CREATE INDEX IF NOT EXISTS question_vectors_embedding_idx
  ON public.question_vectors USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 9) Create compatibility view for camelCase access
CREATE OR REPLACE VIEW "QuestionVector" AS
SELECT
  qv.question_id AS "questionId",
  qs.module_id   AS "moduleId",
  qv.embedding   AS embedding,
  qv.created_at  AS "createdAt",
  qv.model_name  AS "modelName"
FROM public.question_vectors qv
JOIN public.questions       qs ON qs.id = qv.question_id;

COMMIT;

-- Verify the fix
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('question_vectors', 'feedbacks', 'ai_interactions')
ORDER BY tablename, indexname;
