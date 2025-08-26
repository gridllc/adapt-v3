import express from 'express'
import prisma from '../services/prismaService.js'
import { isS3Configured, validateS3Config } from '../services/s3Uploader.js'

const router = express.Router()

// Dedicated health check endpoint for Docker healthcheck and monitoring
router.get('/health', async (_req, res) => {
  try {
    console.log('[TEST] 🔍 Running simplified health check...')
    
    // Basic health check - just return status
    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    }

    console.log(`[TEST] ✅ Health check completed`)
    return res.status(200).json(response)

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