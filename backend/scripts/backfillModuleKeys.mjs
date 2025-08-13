// scripts/backfillModuleKeys.mjs
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('Backfilling s3Key and stepsKey where NULL/empty…')

  const res1 = await prisma.$executeRawUnsafe(`
    UPDATE public.modules
    SET "s3Key" = 'videos/' || id || '.mp4'
    WHERE "s3Key" IS NULL OR "s3Key" = ''
  `)

  const res2 = await prisma.$executeRawUnsafe(`
    UPDATE public.modules
    SET "stepsKey" = 'training/' || id || '.json'
    WHERE "stepsKey" IS NULL OR "stepsKey" = ''
  `)

  console.log('Updated rows:', { s3Key: res1, stepsKey: res2 })

  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      SUM(CASE WHEN "s3Key"   IS NULL OR "s3Key"   = '' THEN 1 ELSE 0 END) AS null_s3key,
      SUM(CASE WHEN "stepsKey" IS NULL OR "stepsKey" = '' THEN 1 ELSE 0 END) AS null_stepskey
    FROM public.modules
  `)

  console.log('Remaining NULLs:', rows?.[0])
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
