-- scripts/fix-user-isolation.sql
-- Fix user isolation by assigning existing modules to users

-- First, let's see what we have
SELECT 
  'Users' as table_name,
  COUNT(*) as count
FROM users
UNION ALL
SELECT 
  'Modules' as table_name,
  COUNT(*) as count
FROM modules
UNION ALL
SELECT 
  'Modules with userId' as table_name,
  COUNT(*) as count
FROM modules 
WHERE "userId" IS NOT NULL
UNION ALL
SELECT 
  'Modules without userId' as table_name,
  COUNT(*) as count
FROM modules 
WHERE "userId" IS NULL;

-- Get the first user ID to assign modules to
SELECT id, email, "clerkId" FROM users LIMIT 1;

-- Update all modules without userId to assign them to the first user
-- Replace 'user_1755535472237_qjc2e2tgh' with the actual user ID from above query
UPDATE modules 
SET "userId" = 'user_1755535472237_qjc2e2tgh'
WHERE "userId" IS NULL;

-- Verify the fix
SELECT 
  'After fix - Modules with userId' as status,
  COUNT(*) as count
FROM modules 
WHERE "userId" IS NOT NULL
UNION ALL
SELECT 
  'After fix - Modules without userId' as status,
  COUNT(*) as count
FROM modules 
WHERE "userId" IS NULL;
