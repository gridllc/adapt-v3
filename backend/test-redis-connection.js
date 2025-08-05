import 'dotenv/config'
import { createClient } from 'redis'

console.log('🔍 Redis Connection Debug Test')
console.log('================================')

// Log environment variables
console.log('Environment Variables:')
console.log(`  USE_REDIS: ${process.env.USE_REDIS}`)
console.log(`  REDIS_URL: ${process.env.REDIS_URL ? 'SET' : 'NOT SET'}`)
console.log(`  NODE_ENV: ${process.env.NODE_ENV}`)

if (process.env.REDIS_URL) {
  console.log(`  REDIS_URL preview: ${process.env.REDIS_URL.substring(0, 50)}...`)
  
  // Test URL parsing
  try {
    const originalUrl = process.env.REDIS_URL
    const convertedUrl = originalUrl.replace('tls://', 'rediss://')
    
    console.log('\n🔧 URL Conversion:')
    console.log(`  Original: ${originalUrl.substring(0, 30)}...`)
    console.log(`  Converted: ${convertedUrl.substring(0, 30)}...`)
    
    const parsed = new URL(convertedUrl)
    console.log('\n📊 Parsed URL Components:')
    console.log(`  Protocol: ${parsed.protocol}`)
    console.log(`  Hostname: ${parsed.hostname}`)
    console.log(`  Port: ${parsed.port}`)
    console.log(`  Username: ${parsed.username}`)
    console.log(`  Password: ${parsed.password ? 'SET' : 'NOT SET'}`)
    
  } catch (error) {
    console.error('❌ URL parsing failed:', error.message)
  }
}

console.log('\n🔧 Testing Redis Connection...')

if (process.env.USE_REDIS === 'true' && process.env.REDIS_URL) {
  const redisUrl = process.env.REDIS_URL.replace('tls://', 'rediss://')
  
  const redisClient = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 10000, // 10 seconds
      lazyConnect: true
    }
  })

  redisClient.on('error', (err) => {
    console.error('❌ Redis error:', err.message)
  })

  redisClient.on('connect', () => {
    console.log('✅ Redis connected')
  })

  redisClient.on('ready', () => {
    console.log('✅ Redis ready')
  })

  redisClient.on('close', () => {
    console.log('⚠️ Redis connection closed')
  })

  redisClient.on('reconnecting', () => {
    console.log('🔄 Redis reconnecting...')
  })

  try {
    console.log('\n🔄 Attempting to connect...')
    await redisClient.connect()
    
    console.log('\n🔄 Testing ping...')
    const pong = await redisClient.ping()
    console.log(`✅ Ping response: ${pong}`)
    
    console.log('\n🔄 Testing basic operations...')
    await redisClient.set('test-key', 'test-value')
    const value = await redisClient.get('test-key')
    console.log(`✅ Test value retrieved: ${value}`)
    
    await redisClient.del('test-key')
    console.log('✅ Test cleanup completed')
    
    await redisClient.quit()
    console.log('✅ Redis connection test completed successfully')
    
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message)
    console.error('   Error type:', error.constructor.name)
    console.error('   Error code:', error.code)
    console.error('   Error stack:', error.stack)
  }
} else {
  console.log('⚠️ Redis not enabled or REDIS_URL not set')
  console.log('   USE_REDIS:', process.env.USE_REDIS)
  console.log('   REDIS_URL exists:', !!process.env.REDIS_URL)
} 