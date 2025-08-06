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
      await prisma.module.findFirst()
      healthStatus.postgres = '✅ Connected'
      console.log('[TEST] 📊 Database: OK')
    } catch (dbError: any) {
      healthStatus.postgres = `❌ Failed: ${dbError.message}`
      overallStatus = 500
      console.error('[TEST] 📊 Database: FAILED', dbError.message)
    }

    // Test S3 Configuration
    try {
      const s3Valid = isS3Configured()
      if (s3Valid) {
        healthStatus.s3 = '✅ Configuration Valid'
        console.log('[TEST] 📦 S3: Configuration OK')
      } else {
        healthStatus.s3 = '⚠️ Configuration Missing'
        console.warn('[TEST] 📦 S3: Configuration incomplete')
      }
    } catch (s3Error: any) {
      healthStatus.s3 = `❌ Error: ${s3Error.message}`
      console.error('[TEST] 📦 S3: ERROR', s3Error.message)
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

export default router