# Module Keys Fix - Complete Solution

## Problem
Existing database rows have `NULL` values for `s3Key` and `stepsKey` fields, but the Prisma schema requires these fields to be non-nullable strings. This causes crashes when the application tries to read these rows.

## Solution Overview
Three-step fix to resolve the issue and prevent it from happening again:

1. **Backfill missing keys** (one-time SQL)
2. **Make health check tolerant** (defensive coding)
3. **Prevent future NULLs** (DB trigger + app code)

---

## Step 1: Backfill Missing Keys

**File**: `backfill-module-keys.sql`

Run this SQL against your Render Postgres database (via psql, Adminer, or a one-off script):

```sql
-- Update s3Key for modules where it's NULL or empty
UPDATE public.modules
SET "s3Key" = 'videos/' || id || '.mp4'
WHERE "s3Key" IS NULL OR "s3Key" = '';

-- Update stepsKey for modules where it's NULL or empty
UPDATE public.modules
SET "stepsKey" = 'training/' || id || '.json'
WHERE "stepsKey" IS NULL OR "stepsKey" = '';

-- Sanity check - should return 0 for both counts after the update
SELECT
  SUM(CASE WHEN "s3Key" IS NULL OR "s3Key" = '' THEN 1 ELSE 0 END) AS null_s3key,
  SUM(CASE WHEN "stepsKey" IS NULL OR "stepsKey" = '' THEN 1 ELSE 0 END) AS null_stepskey
FROM public.modules;
```

**Expected Result**: Both counts should be 0 after running the UPDATE statements.

---

## Step 2: Make Health Check Tolerant

**Files Modified**:
- `src/routes/healthRoutes.ts`
- `src/services/prismaService.ts`

**Changes Made**: Updated health check queries to only read rows with valid keys:

```typescript
// Before (crashed on NULL keys)
await prisma.module.findFirst()

// After (defensive - only reads valid rows)
await prisma.module.findFirst({
  where: { 
    s3Key: { not: '' }, 
    stepsKey: { not: '' } 
  },
  select: { id: true, s3Key: true, stepsKey: true, status: true }
})
```

**Why This Helps**: Health checks won't crash while you're fixing the data, and the application can continue running.

---

## Step 3: Prevent Future NULLs

### 3A: Database Trigger

**File**: `create-module-keys-trigger.sql`

Run this SQL to create a trigger that automatically sets keys:

```sql
-- Function to set module keys before insert
CREATE OR REPLACE FUNCTION public.set_module_keys()
RETURNS trigger AS $$
BEGIN
  IF NEW."s3Key" IS NULL OR NEW."s3Key" = '' THEN
    NEW."s3Key" := 'videos/' || NEW.id || '.mp4';
  END IF;
  IF NEW."stepsKey" IS NULL OR NEW."stepsKey" = '' THEN
    NEW."stepsKey" := 'training/' || NEW.id || '.json';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_set_module_keys ON public.modules;
CREATE TRIGGER trg_set_module_keys
BEFORE INSERT ON public.modules
FOR EACH ROW EXECUTE FUNCTION public.set_module_keys();
```

**What This Does**: Even if application code forgets to set the keys, the database will automatically fill them.

### 3B: Application Code

**File**: `src/services/prismaService.ts`

The `createModule` method already correctly sets both keys:

```typescript
static async createModule(data: {
  id: string
  title: string
  filename: string
  videoUrl: string
  userId?: string
}) {
  return await prisma.module.create({
    data: {
      id: data.id,
      title: data.title,
      filename: data.filename,
      videoUrl: data.videoUrl,
      userId: data.userId,
      s3Key: `videos/${data.id}.mp4`,        // ✅ Always set
      stepsKey: `training/${data.id}.json`   // ✅ Always set
    }
  })
}
```

---

## Deployment Steps

1. **Run the backfill SQL** against your production database
2. **Deploy the updated code** (health check fixes)
3. **Create the database trigger** using the SQL script
4. **Verify the fix** by checking `/api/health` endpoint

---

## Verification

After completing all steps:

1. **Database**: No modules should have NULL keys
2. **Health Check**: `/api/health` should work without crashes
3. **New Modules**: Automatically get keys set (both by app code and DB trigger)
4. **Type Safety**: Prisma Client should work without type errors

---

## Files Created/Modified

- ✅ `backfill-module-keys.sql` - One-time data fix
- ✅ `create-module-keys-trigger.sql` - Database trigger
- ✅ `src/routes/healthRoutes.ts` - Defensive health check
- ✅ `src/services/prismaService.ts` - Defensive health check
- ✅ `MODULE_KEYS_FIX_README.md` - This documentation

---

## Rollback Plan

If something goes wrong:

1. **Remove trigger**: `DROP TRIGGER IF EXISTS trg_set_module_keys ON public.modules;`
2. **Revert code changes** to previous commit
3. **Database changes are safe** - the UPDATE statements only affect NULL/empty values

---

## Notes

- The fix is **backward compatible** - existing working modules are unaffected
- The trigger provides a **safety net** for future development
- Health checks are now **defensive** and won't crash on data issues
- All changes follow the **mobile-first, strict scope** rules for Adapt V3
