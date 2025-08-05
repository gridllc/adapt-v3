import { PrismaClient } from '@prisma/client'
import { createClient } from 'redis'

// Prisma setup
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error']
})

// Redis setup - NO LOCALHOST FALLBACK
let redisClient: any = null

// Debug environment variables
console.log('🔍 Redis Environment Check:', {
  USE_REDIS: process.env.USE_REDIS,
  REDIS_URL_exists: !!process.env.REDIS_URL,
  REDIS_URL_preview: process.env.REDIS_URL ? process.env.REDIS_URL.substring(0, 30) + '...' : 'NOT SET',
  NODE_ENV: process.env.NODE_ENV
})

if (process.env.USE_REDIS === 'true' && process.env.REDIS_URL) {
  console.log('🔧 Setting up Redis with URL:', process.env.REDIS_URL?.substring(0, 20) + '...')

  redisClient = createClient({
    url: process.env.REDIS_URL
  })

  redisClient.on('error', (err: Error) => {
    console.error('❌ Redis connection error:', err)
  })

  redisClient.on('connect', () => {
    console.log('✅ Connected to Redis')
  })

  redisClient.connect().catch((err: Error) => {
    console.error('❌ Redis connection failed:', err)
    console.log('⚠️ Falling back to mock queue')
  })
} else {
  console.log('⚠️ Redis disabled - using mock queue', {
    USE_REDIS: process.env.USE_REDIS,
    REDIS_URL_exists: !!process.env.REDIS_URL
  })
}

export { redisClient }