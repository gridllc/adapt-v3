import { PrismaClient } from '@prisma/client'

// Prisma setup
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error']
})

// Debug Prisma environment
console.log('🔍 Prisma Environment Check:', {
  DATABASE_URL_exists: !!process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV
})

// QStash is used for async job processing instead of Redis
console.log('🔧 QStash Configuration:', {
  QSTASH_TOKEN_exists: !!process.env.QSTASH_TOKEN,
  QSTASH_ENDPOINT: process.env.QSTASH_ENDPOINT || 'https://qstash.upstash.io/v1/publish',
  NODE_ENV: process.env.NODE_ENV
})
