-- Ensure pgvector exists (no-op if already present)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create/normalize the question_vectors table and column names
DO $$
BEGIN
  -- Create table if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'question_vectors'
  ) THEN
    CREATE TABLE public.question_vectors (
      question_id TEXT PRIMARY KEY,
      embedding   vector(1536) NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  END IF;

  -- If an older column name exists (camelCase), normalize it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'question_vectors' AND column_name = 'questionId'
  ) THEN
    ALTER TABLE public.question_vectors RENAME COLUMN "questionId" TO question_id;
  END IF;
END $$;

-- Add the FK only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'question_vectors_question_id_fkey'
  ) THEN
    ALTER TABLE public.question_vectors
      ADD CONSTRAINT question_vectors_question_id_fkey
      FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create a vector index if one doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'question_vectors_embedding_idx'
      AND n.nspname = 'public'
  ) THEN
    -- If hnsw isn't available on your Postgres, swap to ivfflat
    CREATE INDEX question_vectors_embedding_idx
      ON public.question_vectors USING hnsw (embedding vector_cosine_ops);
  END IF;
END $$;
