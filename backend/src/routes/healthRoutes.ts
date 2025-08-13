import express from 'express'
import prisma from '../services/prismaService.js'
import { isS3Configured, validateS3Config } from '../services/s3Uploader.js'

const router = express.Router()

// Dedicated health check endpoint for Docker healthcheck and monitoring
router.get('/health', async (_req, res) => {
  const healthStatus: Record<string, string> = {}
  let overallStatus = 200
  
  try {
    console.log('[TEST] 🔍 Running health check...')
    
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
      console.log('[TEST] 📊 Database: OK')
    } catch (dbError: any) {
      healthStatus.postgres = `❌ Failed: ${dbError.message}`
      overallStatus = 500
      console.error('[TEST] 📊 Database: FAILED', dbError.message)
    }

    // Cloud storage configuration
    try {
      const storageValid = isS3Configured()
      if (storageValid) {
        healthStatus.storage = '✅ Configuration Valid'
        console.log('[TEST] 📦 Storage: Configuration OK')
      } else {
        healthStatus.storage = '⚠️ Configuration Missing'
        console.warn('[TEST] 📦 Storage: Configuration incomplete')
      }
    } catch (s3Error: any) {
      healthStatus.storage = `❌ Error: ${s3Error.message}`
      console.error('[TEST] 📦 Storage: ERROR', s3Error.message)
    }

    // QStash Queue (Optional - for async job processing)
    try {
      if (process.env.QSTASH_TOKEN) {
        healthStatus.qstash = '✅ Configured'
        console.log('[TEST] 📡 QStash: Configured')
      } else {
        healthStatus.qstash = '⚠️ Not Configured'
        console.log('[TEST] 📡 QStash: Not configured (optional)')
      }
    } catch (qstashError: any) {
      healthStatus.qstash = `❌ Error: ${qstashError.message}`
      console.error('[TEST] 📡 QStash: ERROR', qstashError.message)
    }

    // Check environment variables
    const requiredEnvVars = ['DATABASE_URL', 'CLERK_SECRET_KEY']
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])
    
    if (missingEnvVars.length > 0) {
      healthStatus.environment = `❌ Missing: ${missingEnvVars.join(', ')}`
      overallStatus = 500
      console.error('[TEST] 🔧 Environment: Missing vars', missingEnvVars)
    } else {
      healthStatus.environment = '✅ Required vars present'
      console.log('[TEST] 🔧 Environment: OK')
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

    console.log(`[TEST] ✅ Health check completed with status: ${overallStatus}`)
    return res.status(overallStatus).json(response)

  } catch (error: any) {
    console.error('[TEST] ❌ Health check failed:', error.message)
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