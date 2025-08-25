import express from 'express'
import prisma from '../services/prismaService.js'
import { isS3Configured, validateS3Config } from '../services/s3Uploader.js'

const router = express.Router()

// ✅ SIMPLIFIED health check - no database queries to prevent timeouts
router.get('/health', (_req, res) => {
  try {
    // Simple, fast health check that won't cause SIGTERM
    const response = {
      ok: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      memory: {
        heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      pid: process.pid,
      version: '1.0.0'
    }

    // Only log occasionally to reduce noise
    if (Math.round(process.uptime()) % 300 === 0) { // Every 5 minutes
      console.log(`✅ Health check OK - Uptime: ${response.uptime}s, Memory: ${response.memory.heapUsedMB}MB`)
    }
    
    return res.status(200).json(response)

  } catch (error: any) {
    console.error('❌ Health check failed:', error.message)
    return res.status(500).json({
      ok: false,
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    })
  }
})

// ✅ Detailed health check (separate endpoint for debugging)
router.get('/health/detailed', async (_req, res) => {
  const healthStatus: Record<string, string> = {}
  let overallStatus = 200
  
  try {
    console.log('[DETAILED] 🔍 Running detailed health check...')
    
    // Test Database Connection
    try {
      // Only read rows with valid keys to avoid NULL constraint errors
      const probe = await prisma.module.findFirst({
        where: { 
          s3Key: { not: '' }, 
          stepsKey: { not: '' } 
        },
        select: { id: true, s3Key: true, stepsKey: true, status: true }
      })
      healthStatus.postgres = '✅ Connected'
      console.log('[DETAILED] 📊 Database: OK')
    } catch (dbError: any) {
      healthStatus.postgres = `❌ Failed: ${dbError.message}`
      overallStatus = 500
      console.error('[DETAILED] 📊 Database: FAILED', dbError.message)
    }

    // Cloud storage configuration
    try {
      const storageValid = isS3Configured()
      if (storageValid) {
        healthStatus.storage = '✅ Configuration Valid'
        console.log('[DETAILED] 📦 Storage: Configuration OK')
      } else {
        healthStatus.storage = '⚠️ Configuration Missing'
        console.warn('[DETAILED] 📦 Storage: Configuration incomplete')
      }
    } catch (s3Error: any) {
      healthStatus.storage = `❌ Error: ${s3Error.message}`
      console.error('[DETAILED] 📦 Storage: ERROR', s3Error.message)
    }

    // Check environment variables
    const requiredEnvVars = ['DATABASE_URL', 'CLERK_SECRET_KEY']
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])
    
    if (missingEnvVars.length > 0) {
      healthStatus.environment = `❌ Missing: ${missingEnvVars.join(', ')}`
      overallStatus = 500
      console.error('[DETAILED] 🔧 Environment: Missing vars', missingEnvVars)
    } else {
      healthStatus.environment = '✅ Required vars present'
      console.log('[DETAILED] 🔧 Environment: OK')
    }

    // Response
    const response = {
      status: overallStatus === 200 ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: healthStatus,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    }

    console.log(`[DETAILED] ✅ Health check completed with status: ${overallStatus}`)
    return res.status(overallStatus).json(response)

  } catch (error: any) {
    console.error('[DETAILED] ❌ Health check failed:', error.message)
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: error.message
    })
  }
})

// CORS configuration endpoint for debugging
router.get('/cors', (_req, res) => {
  const allowedOrigins = [
    // Development origins
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174', 
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5177',
    'http://localhost:5178',
    'http://localhost:5179',
    'http://localhost:5180',
    'http://localhost:5181',
    'http://localhost:5182',
    'http://localhost:5183',
    'http://localhost:5184',
    'http://localhost:5185',
    // Production origins
    'https://adapt-v3-sepia.vercel.app',
    'https://adapt-v3.vercel.app',
    'https://adaptord.com',
    'https://www.adaptord.com'
  ]

  // Add FRONTEND_URL from environment if specified
  if (process.env.FRONTEND_URL) {
    const envOrigins = process.env.FRONTEND_URL
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    
    // Add environment origins to the list
    allowedOrigins.push(...envOrigins)
  }

  // Remove duplicates
  const uniqueOrigins = [...new Set(allowedOrigins)]

  res.json({
    cors: {
      allowedOrigins: uniqueOrigins,
      environmentOrigins: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(s => s.trim()) : [],
      credentials: false,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      timestamp: new Date().toISOString()
    }
  })
})

export default router