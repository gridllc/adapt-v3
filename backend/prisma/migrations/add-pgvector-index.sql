-- Add pgvector index for better vector search performance
-- This should be run manually after the migration

-- Enable pgvector extension if not already enabled
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

-- Create index for vector similarity search
-- This will dramatically improve search performance for large datasets
CREATE INDEX IF NOT EXISTS question_embedding_vector_idx ON "QuestionVector"
USING ivfflat ("embedding" vector_cosine_ops)
WITH (lists = 100);

-- Optional: Create additional indexes for common queries
CREATE INDEX IF NOT EXISTS question_module_id_idx ON "Question" ("moduleId");
CREATE INDEX IF NOT EXISTS question_reuse_count_idx ON "Question" ("reuseCount" DESC);
CREATE INDEX IF NOT EXISTS question_created_at_idx ON "Question" ("createdAt" DESC);

-- Add comment for documentation
COMMENT ON INDEX question_embedding_vector_idx IS 'pgvector index for fast similarity search on question embeddings';
