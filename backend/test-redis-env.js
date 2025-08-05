import 'dotenv/config'

console.log('🔍 Redis Environment Variables Test:')
console.log('=====================================')
console.log(`USE_REDIS: ${process.env.USE_REDIS}`)
console.log(`REDIS_URL: ${process.env.REDIS_URL ? 'SET' : 'NOT SET'}`)
console.log(`NODE_ENV: ${process.env.NODE_ENV}`)

if (process.env.REDIS_URL) {
  console.log(`REDIS_URL preview: ${process.env.REDIS_URL.substring(0, 30)}...`)
}

console.log('')
console.log('🔧 Expected Configuration:')
console.log('- USE_REDIS should be "true"')
console.log('- REDIS_URL should be set to Railway Redis URL')
console.log('- NODE_ENV should be "production"')

console.log('')
console.log('❌ If you see localhost:6379 errors, it means:')
console.log('1. USE_REDIS is not set to "true"')
console.log('2. REDIS_URL is not set')
console.log('3. Some old Redis code is still running')

console.log('')
console.log('✅ To fix:')
console.log('1. Set USE_REDIS=true in Railway environment variables')
console.log('2. Set REDIS_URL to your Railway Redis URL')
console.log('3. Redeploy the application') 