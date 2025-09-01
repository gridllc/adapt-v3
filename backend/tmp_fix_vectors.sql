-- tmp_fix_vectors.sql
BEGIN;

-- 1) Ensure pgvector is available
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Ensure base table exists (snake_case)
CREATE TABLE IF NOT EXISTS public.question_vectors (
  question_id TEXT PRIMARY KEY,
  embedding vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) If a camelCase column exists, rename it to snake_case
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='question_vectors' AND column_name='questionId'
  ) THEN
    EXECUTE 'ALTER TABLE public.question_vectors RENAME COLUMN "questionId" TO question_id';
  END IF;
END$$;

-- 4) If "embedding" exists but is NOT pgvector, recreate it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='question_vectors'
      AND column_name='embedding' AND udt_name <> 'vector'
  ) THEN
    -- Drop any index that references the old column
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public' AND indexname='question_vectors_embedding_idx'
    ) THEN
      EXECUTE 'DROP INDEX public.question_vectors_embedding_idx';
    END IF;

    -- Recreate embedding as pgvector
    EXECUTE 'ALTER TABLE public.question_vectors DROP COLUMN embedding';
    EXECUTE 'ALTER TABLE public.question_vectors ADD COLUMN embedding vector(1536) NOT NULL';
  END IF;
END$$;

-- 5) Recreate IVF index on embedding (cosine)
DROP INDEX IF EXISTS public.question_vectors_embedding_idx;
CREATE INDEX question_vectors_embedding_idx
  ON public.question_vectors USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

COMMIT;
