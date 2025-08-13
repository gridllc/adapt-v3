-- Manual migration to add canonical S3 key fields
-- Run this manually in your database

-- Add new columns
ALTER TABLE modules ADD COLUMN IF NOT EXISTS s3_key TEXT;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS steps_key TEXT;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Create the enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "ModuleStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add the status column with the new enum type
ALTER TABLE modules ADD COLUMN IF NOT EXISTS status_new "ModuleStatus" DEFAULT 'UPLOADED';

-- Update existing records to have proper status
UPDATE modules SET status_new = 
  CASE 
    WHEN status = 'processing' THEN 'PROCESSING'::"ModuleStatus"
    WHEN status = 'ready' THEN 'READY'::"ModuleStatus"
    WHEN status = 'failed' THEN 'FAILED'::"ModuleStatus"
    ELSE 'UPLOADED'::"ModuleStatus"
  END
WHERE status_new IS NULL;

-- Drop the old status column and rename the new one
ALTER TABLE modules DROP COLUMN status;
ALTER TABLE modules RENAME COLUMN status_new TO status;

-- Set default values for existing records
UPDATE modules SET 
  s3_key = CONCAT('videos/', id, '.mp4'),
  steps_key = CONCAT('training/', id, '.json')
WHERE s3_key IS NULL OR steps_key IS NULL;

-- Make the new columns required
ALTER TABLE modules ALTER COLUMN s3_key SET NOT NULL;
ALTER TABLE modules ALTER COLUMN steps_key SET NOT NULL;
ALTER TABLE modules ALTER COLUMN status SET NOT NULL;
