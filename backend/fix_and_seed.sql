BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='moduleId') THEN
    ALTER TABLE questions RENAME COLUMN "moduleId" TO module_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='isFAQ') THEN
    ALTER TABLE questions RENAME COLUMN "isFAQ" TO is_faq;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS questions (
  id        text PRIMARY KEY,
  module_id text NOT NULL,
  question  text NOT NULL,
  answer    text NOT NULL,
  is_faq    boolean NOT NULL DEFAULT false
);

ALTER TABLE questions
  ALTER COLUMN id TYPE text,
  ALTER COLUMN module_id TYPE text,
  ALTER COLUMN question TYPE text,
  ALTER COLUMN answer TYPE text;

CREATE TABLE IF NOT EXISTS question_vectors (
  "questionId" text PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  embedding    vector(1536)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='question_vectors' AND column_name='question_id') THEN
    ALTER TABLE question_vectors RENAME COLUMN question_id TO "questionId";
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='question_vectors'
      AND column_name='embedding'
      AND data_type='ARRAY'
  ) THEN
    ALTER TABLE question_vectors
      ALTER COLUMN embedding TYPE vector(1536)
      USING (embedding::vector);
  END IF;
END$$;

DROP INDEX IF EXISTS idx_question_vectors_cosine;
CREATE INDEX idx_question_vectors_cosine ON question_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

INSERT INTO questions (id, module_id, question, answer, is_faq) VALUES
  ('q-seed-1','db69bb05-26e2-4dbc-af8b-a05c268aa4bb','How do I reset my password?','Use the Forgot Password link.', false),
  ('q-seed-2','db69bb05-26e2-4dbc-af8b-a05c268aa4bb','Where are training videos stored?','All videos are stored on S3.', false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
