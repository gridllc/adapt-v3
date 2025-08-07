-- Add pgvector index for better vector search performance
-- This should be run manually after the migration

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create index for vector similarity search
-- This will dramatically improve search performance for large datasets
CREATE INDEX IF NOT EXISTS question_embedding_vector_idx ON question_vectors
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Optional: Create additional indexes for common queries
CREATE INDEX IF NOT EXISTS question_module_id_idx ON questions (module_id);
CREATE INDEX IF NOT EXISTS question_reuse_count_idx ON questions (reuse_count DESC);
CREATE INDEX IF NOT EXISTS question_created_at_idx ON questions (created_at DESC);

-- Add comment for documentation
COMMENT ON INDEX question_embedding_vector_idx IS 'pgvector index for fast similarity search on question embeddings';
