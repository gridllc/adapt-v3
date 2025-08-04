import Redis from 'ioredis'

// Redis configuration for Railway - handle both naming conventions
const redisConfig = {
  host: process.env.REDIS_HOST || process.env.REDISHOST || 'localhost',
  port: Number(process.env.REDIS_PORT || process.env.REDISPORT || '6379'),
  password: process.env.REDIS_PASSWORD || process.env.REDISPASSWORD,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  // Add TLS for Railway Redis
  tls: process.env.NODE_ENV === 'production' ? {} : undefined,
}

// Create Redis client
const redis = new Redis(redisConfig)

// Log Redis configuration (without sensitive data)
console.log('🔧 Redis Configuration:')
console.log(`   Host: ${redisConfig.host}`)
console.log(`   Port: ${redisConfig.port}`)
console.log(`   Password: ${redisConfig.password ? 'SET' : 'NOT SET'}`)
console.log(`   Environment Variables:`)
console.log(`     REDIS_HOST: ${process.env.REDIS_HOST || 'NOT SET'}`)
console.log(`     REDISHOST: ${process.env.REDISHOST || 'NOT SET'}`)
console.log(`     REDIS_PORT: ${process.env.REDIS_PORT || 'NOT SET'}`)
console.log(`     REDISPORT: ${process.env.REDISPORT || 'NOT SET'}`)
console.log(`     REDIS_PASSWORD: ${process.env.REDIS_PASSWORD ? 'SET' : 'NOT SET'}`)
console.log(`     REDISPASSWORD: ${process.env.REDISPASSWORD ? 'SET' : 'NOT SET'}`)

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