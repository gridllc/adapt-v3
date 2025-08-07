-- Setup script for pgvector index
-- Run this manually after deploying to production

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the vector index for fast similarity search
-- This is critical for performance with large datasets
CREATE INDEX IF NOT EXISTS question_embedding_vector_idx ON question_vectors
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create additional performance indexes
CREATE INDEX IF NOT EXISTS question_module_id_idx ON questions (module_id);
CREATE INDEX IF NOT EXISTS question_reuse_count_idx ON questions (reuse_count DESC);
CREATE INDEX IF NOT EXISTS question_created_at_idx ON questions (created_at DESC);

-- Verify the indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('question_vectors', 'questions')
ORDER BY tablename, indexname;
