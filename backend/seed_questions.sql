INSERT INTO questions (id, "moduleId", question, answer, "isFAQ", "createdAt")
VALUES
  ('q-seed-1','db69bb05-26e2-4dbc-af8b-a05c268aa4bb','How do I reset my password?','Use the Forgot Password link and check your email for a reset code.', false, NOW()),
  ('q-seed-2','db69bb05-26e2-4dbc-af8b-a05c268aa4bb','Where are training videos stored?','All videos are stored on S3 and listed under the Videos tab.', false, NOW())
ON CONFLICT (id) DO NOTHING;
