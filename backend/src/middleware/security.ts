import rateLimit from 'express-rate-limit'
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'

/**
 * Rate limiting configurations for different endpoint types
 * Note: Generous limits for development/testing, can be tightened for production
 */
export const rateLimiters = {
  // General API rate limiting (generous for development)
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 200 : 1000, // 200 prod, 1000 dev
    message: {
      error: 'Too many requests',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Upload rate limiting (much more generous for testing)
  upload: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'production' ? 20 : 100, // 20 prod, 100 dev (testing friendly)
    message: {
      error: 'Upload limit exceeded',
      message: 'Too many uploads from this IP, please try again later.',
      retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // AI processing rate limiting (generous for development)
  aiProcessing: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'production' ? 10 : 50, // 10 prod, 50 dev
    message: {
      error: 'AI processing limit exceeded',
      message: 'Too many AI processing requests from this IP, please try again later.',
      retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per 15 minutes
    message: {
      error: 'Too many authentication attempts',
      message: 'Too many authentication attempts from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
  })
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
  
  // Set CORS headers appropriately
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:8000',
    'http://localhost:10000'
  ].filter(Boolean)

  const origin = req.headers.origin
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }

  next()
}
