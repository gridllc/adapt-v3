-- Ensure pgvector exists (no-op if present)
CREATE EXTENSION IF NOT EXISTS vector;

-- Base table (idempotent)
CREATE TABLE IF NOT EXISTS public.question_vectors (
  question_id TEXT PRIMARY KEY,
  embedding   vector(1536) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Vector index (ivfflat is broadly supported; swap to hnsw if you've enabled it)
CREATE INDEX IF NOT EXISTS question_vectors_embedding_idx
  ON public.question_vectors USING ivfflat (embedding vector_cosine_ops);

-- Speed up module filters used by the view
CREATE INDEX IF NOT EXISTS idx_questions_module_id ON public.questions (module_id);

-- Compatibility VIEW that your raw SQL expects: "QuestionVector"
-- Exposes camelCase columns expected by the app
CREATE OR REPLACE VIEW "QuestionVector" AS
SELECT
  qv.question_id AS "questionId",
  qs.module_id   AS "moduleId",
  qv.embedding   AS embedding,
  qv.created_at  AS "createdAt"
FROM public.question_vectors qv
JOIN public.questions       qs ON qs.id = qv.question_id;
