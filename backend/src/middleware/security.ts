import rateLimit from 'express-rate-limit'
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'

// shared options
const COMMON = {
  standardHeaders: true,
  legacyHeaders: false,

  // IMPORTANT: tell express-rate-limit we intentionally trust the proxy
  trustProxy: true,

  // ⚠️ IMPORTANT: Remove custom keyGenerator to let express-rate-limit handle IPv6 safely
  // The default keyGenerator will work correctly with trustProxy: true

  // don't count health / preflight
  skip: (req: any) => req.method === 'OPTIONS' || req.path === '/api/health',
}

/**
 * Rate limiting configurations for different endpoint types
 * Note: Generous limits for development/testing, can be tightened for production
 */
export const rateLimiters = {
  general: rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, ...COMMON }),
  upload:  rateLimit({ windowMs:  5 * 60 * 1000, max:   30, ...COMMON }),
  aiProcessing: rateLimit({ windowMs: 60 * 1000, max: 15, ...COMMON }),
}

/**
 * Common validation schemas
 */
export const validationSchemas = {
  // UUID validation
  uuid: z.string().uuid('Invalid UUID format'),
  
  // File validation
  fileUpload: z.object({
    filename: z.string()
      .min(1, 'Filename is required')
      .max(255, 'Filename too long')
      // Allow more filename characters including spaces and common punctuation
      .regex(/^[a-zA-Z0-9\s._\-()]+$/, 'Invalid filename characters'),
    contentType: z.string()
      .startsWith('video/', 'Only video files are allowed'),
    title: z.string().optional(), // Optional title for module
    fileSize: z.number()
      .min(1000, 'File too small (minimum 1KB)')
      .max(500 * 1024 * 1024, 'File too large (maximum 500MB)')
      .optional() // Optional fileSize for validation
  }),

  // Module creation
  moduleCreate: z.object({
    title: z.string()
      .min(1, 'Title is required')
      .max(200, 'Title too long')
      .trim(),
    s3Key: z.string()
      .min(1, 'S3 key is required')
      .regex(/^videos\/[a-zA-Z0-9._-]+\.mp4$/, 'Invalid S3 key format')
  }),

  // Step generation
  stepGeneration: z.object({
    moduleId: z.string().uuid('Invalid module ID'),
    options: z.object({
      maxSteps: z.number().min(1).max(20).optional(),
      language: z.string().min(2).max(10).optional()
    }).optional()
  }),

  // QA request
  qaRequest: z.object({
    moduleId: z.string().uuid('Invalid module ID'),
    stepId: z.string().optional(),
    question: z.string()
      .min(1, 'Question is required')
      .max(1000, 'Question too long')
      .trim()
  })
}

/**
 * Input validation middleware factory
 */
export function validateInput<T>(schema: z.ZodSchema<T>, source: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = source === 'body' ? req.body : 
                  source === 'params' ? req.params : 
                  req.query

      const result = schema.safeParse(data)
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        })
      }

      // Add validated data to request
      if (source === 'body') {
        req.body = result.data
      } else if (source === 'params') {
        req.params = result.data as any
      } else {
        req.query = result.data as any
      }

      next()
    } catch (error) {
      console.error('Validation middleware error:', error)
      res.status(500).json({
        success: false,
        error: 'Internal validation error'
      })
    }
  }
}

/**
 * File size validation middleware
 */
export function validateFileSize(maxSizeBytes: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.file && req.file.size > maxSizeBytes) {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        message: `File size ${req.file.size} bytes exceeds maximum ${maxSizeBytes} bytes`
      })
    }
    next()
  }
}

/**
 * Content type validation middleware
 */
export function validateContentType(allowedTypes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.file && !allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type',
        message: `File type ${req.file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`
      })
    }
    next()
  }
}

/**
 * Request sanitization middleware
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Sanitize common XSS patterns
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        .trim()
    }
    if (typeof value === 'object' && value !== null) {
      const sanitized: any = {}
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val)
      }
      return sanitized
    }
    return value
  }

  if (req.body) {
    req.body = sanitizeValue(req.body)
  }
  if (req.query) {
    req.query = sanitizeValue(req.query)
  }
  if (req.params) {
    req.params = sanitizeValue(req.params)
  }

  next()
}

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // CORS is now handled by the main CORS shim at the top of the server

  next()
}
