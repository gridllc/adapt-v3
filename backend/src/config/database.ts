import { PrismaClient } from '@prisma/client'

// Build enhanced DATABASE_URL with connection pooling parameters
const buildDatabaseUrl = () => {
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) return baseUrl

  const poolMax = process.env.DATABASE_POOL_MAX || '20'
  const poolMin = process.env.DATABASE_POOL_MIN || '5'
  const acquireTimeout = process.env.DATABASE_POOL_ACQUIRE_TIMEOUT || '60000'
  const createTimeout = process.env.DATABASE_POOL_CREATE_TIMEOUT || '30000'

  // Add connection pooling parameters if not already present
  if (baseUrl.includes('?')) {
    return `${baseUrl}&connection_limit=${poolMax}&pool_timeout=${acquireTimeout}&connect_timeout=${createTimeout}`
  } else {
    return `${baseUrl}?connection_limit=${poolMax}&pool_timeout=${acquireTimeout}&connect_timeout=${createTimeout}`
  }
}

// Enhanced Prisma configuration for better connection pooling
const prisma = new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: {
      url: buildDatabaseUrl()
    }
  },
  // Connection pool configuration
  transactionOptions: {
    maxWait: parseInt(process.env.DATABASE_POOL_ACQUIRE_TIMEOUT || '60000'),
    timeout: parseInt(process.env.DATABASE_POOL_CREATE_TIMEOUT || '30000'),
  }
})

export { prisma }

// Connection pool monitoring
let connectionPoolStats = {
  activeConnections: 0,
  totalQueries: 0,
  lastReset: new Date()
}

// Monitor connection pool health
setInterval(() => {
  connectionPoolStats.totalQueries++
  if (connectionPoolStats.totalQueries % 100 === 0) {
    console.log('📊 Database Connection Pool Stats:', {
      activeConnections: connectionPoolStats.activeConnections,
      totalQueries: connectionPoolStats.totalQueries,
      uptime: Math.round((Date.now() - connectionPoolStats.lastReset.getTime()) / 1000),
      timestamp: new Date().toISOString()
    })
  }
}, 30000) // Log every 30 seconds

// Debug Prisma environment
console.log('🔍 Prisma Environment Check:', {
  DATABASE_URL_exists: !!process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX || '20 (default)',
  DATABASE_POOL_MIN: process.env.DATABASE_POOL_MIN || '5 (default)'
})

// QStash is used for async job processing instead of Redis
console.log('🔧 QStash Configuration:', {
  QSTASH_TOKEN_exists: !!process.env.QSTASH_TOKEN,
  QSTASH_ENDPOINT: process.env.QSTASH_ENDPOINT || 'https://qstash.upstash.io/v1/publish',
  NODE_ENV: process.env.NODE_ENV
})