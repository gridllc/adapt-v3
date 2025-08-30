CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "QuestionVector" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES "Question"(id) ON DELETE CASCADE,
  embedding   vector(1536) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS questionvector_hnsw_idx
  ON "QuestionVector" USING hnsw (embedding);

CREATE UNIQUE INDEX IF NOT EXISTS questionvector_unique_qid
  ON "QuestionVector"(question_id);
