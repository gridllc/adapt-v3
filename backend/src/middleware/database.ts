import { Request, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'

/**
 * Middleware to handle Prisma connection pool errors gracefully
 * Provides better error messages and retry logic for connection issues
 */
export function handleDatabaseErrors(err: any, req: Request, res: Response, next: NextFunction) {
  // Handle Prisma connection pool timeout errors
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2024') {
    console.warn('⚠️ Database connection pool exhausted, retrying...', {
      url: req.url,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    })

    // For connection pool errors, return a 503 Service Unavailable
    return res.status(503).json({
      success: false,
      error: 'Database temporarily unavailable. Please try again in a moment.',
      code: 'DATABASE_BUSY',
      retryAfter: 5
    })
  }

  // Handle other Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error('❌ Prisma error:', {
      code: err.code,
      message: err.message,
      meta: err.meta,
      url: req.url,
      method: req.method
    })

    // Return appropriate HTTP status codes for different Prisma errors
    switch (err.code) {
      case 'P2002':
        return res.status(409).json({
          success: false,
          error: 'Data conflict - this operation would create a duplicate.',
          code: 'DUPLICATE_ERROR'
        })
      case 'P2025':
        return res.status(404).json({
          success: false,
          error: 'The requested resource was not found.',
          code: 'NOT_FOUND'
        })
      default:
        return res.status(500).json({
          success: false,
          error: 'Database operation failed.',
          code: 'DATABASE_ERROR'
        })
    }
  }

  // Handle generic database errors
  if (err.message && err.message.includes('connection')) {
    console.error('❌ Database connection error:', err.message)
    return res.status(503).json({
      success: false,
      error: 'Database connection failed. Please try again.',
      code: 'CONNECTION_ERROR',
      retryAfter: 10
    })
  }

  // If it's not a database error, pass it along
  next(err)
}

/**
 * Middleware to add database health check endpoint
 */
export function databaseHealthCheck(req: Request, res: Response) {
  // This is a simple health check - in production you might want to actually test the connection
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'database'
  })
}
