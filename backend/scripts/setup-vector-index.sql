-- Setup script for pgvector index
-- Run this manually after deploying to production

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Ensure QuestionVector table exists with correct structure (camelCase columns)
CREATE TABLE IF NOT EXISTS "QuestionVector" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "questionId" UUID NOT NULL REFERENCES "Question"("id") ON DELETE CASCADE,
  "embedding" vector(1536) NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "modelName" TEXT DEFAULT 'openai-embedding-3-small'
);

-- Create unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuestionVector_questionId_key') THEN
    ALTER TABLE "QuestionVector" ADD CONSTRAINT "QuestionVector_questionId_key" UNIQUE ("questionId");
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists, ignore
    NULL;
END $$;

-- Create the vector index for fast similarity search
-- This is critical for performance with large datasets
CREATE INDEX IF NOT EXISTS question_embedding_vector_idx ON "QuestionVector"
USING ivfflat ("embedding" vector_cosine_ops)
WITH (lists = 100);

-- Create additional performance indexes
CREATE INDEX IF NOT EXISTS question_module_id_idx ON "Question" ("moduleId");
CREATE INDEX IF NOT EXISTS question_reuse_count_idx ON "Question" ("reuseCount" DESC);
CREATE INDEX IF NOT EXISTS question_created_at_idx ON "Question" ("createdAt" DESC);

-- Verify the indexes were created
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('QuestionVector', 'Question')
ORDER BY tablename, indexname;
