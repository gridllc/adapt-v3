import 'dotenv/config'
import { DatabaseService } from './src/services/prismaService.js'
import { redisClient } from './src/config/database.js'

async function testConnections() {
  console.log('🔍 Testing Database Connections...')
  console.log('')
  
  // Test PostgreSQL
  console.log('📊 Testing PostgreSQL connection...')
  try {
    const dbHealth = await DatabaseService.healthCheck()
    console.log(`✅ PostgreSQL: ${dbHealth ? 'CONNECTED' : 'FAILED'}`)
  } catch (error) {
    console.log(`❌ PostgreSQL: FAILED - ${error.message}`)
  }
  
  console.log('')
  
  // Test Redis
  console.log('🔴 Testing Redis connection...')
  try {
    if (redisClient) {
      await redisClient.ping()
      console.log('✅ Redis: CONNECTED')
    } else {
      console.log('⚠️ Redis: DISABLED')
    }
  } catch (error) {
    console.log(`❌ Redis: FAILED - ${error.message}`)
  }
  
  console.log('')
  console.log('🔍 Environment Variables:')
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`)
  console.log(`   REDIS_URL: ${process.env.REDIS_URL ? 'SET' : 'NOT SET'}`)
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`)
}

testConnections()
  .then(() => {
    console.log('✅ Connection test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Connection test failed:', error)
    process.exit(1)
  }) 