import Redis from 'ioredis'

// Redis configuration for Railway
const redisConfig = {
  host: process.env.REDIS_HOST, // e.g. metro.proxy.rlwy.net
  port: Number(process.env.REDIS_PORT), // e.g. 40569
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
}

// Create Redis client
const redis = new Redis(redisConfig)

// Connection event handlers
redis.on('connect', () => {
  console.log('✅ Redis connected successfully')
})

redis.on('ready', () => {
  console.log('✅ Redis is ready to accept commands')
})

redis.on('error', (error) => {
  console.error('❌ Redis connection error:', error)
})

redis.on('close', () => {
  console.log('⚠️ Redis connection closed')
})

redis.on('reconnecting', () => {
  console.log('🔄 Redis reconnecting...')
})

// Test Redis connection
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    await redis.ping()
    console.log('✅ Redis ping successful')
    return true
  } catch (error) {
    console.error('❌ Redis ping failed:', error)
    return false
  }
}

export default redis 