import { PrismaClient } from '@prisma/client'
import { Redis } from '@upstash/redis'

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

// Redis setup - Upstash Redis
let redisClient: Redis | null = null

// Debug environment variables
console.log('🔍 Redis Environment Check:', {
  USE_REDIS: process.env.USE_REDIS,
  UPSTASH_REDIS_REST_URL_exists: !!process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN_exists: !!process.env.UPSTASH_REDIS_REST_TOKEN,
  NODE_ENV: process.env.NODE_ENV
})

if (process.env.USE_REDIS === 'true' && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.log('🔧 Setting up Upstash Redis...')

  try {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })

    console.log('✅ Upstash Redis client created')
  } catch (err) {
    console.error('❌ Redis initialization failed:', err)
    redisClient = null
  }
} else {
  console.log('⚠️ Redis disabled - using mock queue', {
    USE_REDIS: process.env.USE_REDIS,
    UPSTASH_REDIS_REST_URL_exists: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN_exists: !!process.env.UPSTASH_REDIS_REST_TOKEN
  })
}

export { redisClient }