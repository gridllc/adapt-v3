import express from 'express'
import { multipartController } from '../controllers/multipartController.js'
import rateLimit from 'express-rate-limit'

const router = express.Router()

// Rate limiting for multipart upload operations
const multipartRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many multipart upload requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// More restrictive rate limiting for initialization (starting new uploads)
const initRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 upload initializations per 5 minutes
  message: {
    success: false,
    error: 'Too many upload initializations, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Apply rate limiting to all multipart routes
router.use(multipartRateLimit)

/**
 * Health check endpoint
 * GET /api/uploads/multipart/health
 */
router.get('/health', multipartController.health.bind(multipartController))

/**
 * Initialize multipart upload
 * POST /api/uploads/multipart/init
 * 
 * Body: {
 *   filename: string,
 *   contentType: string,
 *   fileSize: number,
 *   isMobile?: boolean
 * }
 * 
 * Response: {
 *   success: true,
 *   uploadId: string,
 *   key: string,
 *   partSize: number,
 *   partCount: number,
 *   metrics: object
 * }
 */
router.post('/init', initRateLimit, multipartController.initialize.bind(multipartController))

/**
 * Get signed URL for uploading a part
 * POST /api/uploads/multipart/sign-part
 * 
 * Body: {
 *   key: string,
 *   uploadId: string,
 *   partNumber: number
 * }
 * 
 * Response: {
 *   success: true,
 *   url: string,
 *   partNumber: number
 * }
 */
router.post('/sign-part', multipartController.signPart.bind(multipartController))

/**
 * Complete multipart upload
 * POST /api/uploads/multipart/complete
 * 
 * Body: {
 *   key: string,
 *   uploadId: string,
 *   parts: Array<{partNumber: number, etag: string}>
 * }
 * 
 * Response: {
 *   success: true,
 *   key: string,
 *   etag?: string,
 *   location?: string,
 *   moduleId?: string,
 *   videoUrl?: string
 * }
 */
router.post('/complete', multipartController.complete.bind(multipartController))

/**
 * Abort multipart upload
 * POST /api/uploads/multipart/abort
 * 
 * Body: {
 *   key: string,
 *   uploadId: string
 * }
 * 
 * Response: {
 *   success: true
 * }
 */
router.post('/abort', multipartController.abort.bind(multipartController))

/**
 * Get upload metrics and recommendations
 * POST /api/uploads/multipart/metrics
 * 
 * Body: {
 *   fileSize: number,
 *   isMobile?: boolean
 * }
 * 
 * Response: {
 *   success: true,
 *   metrics: {
 *     fileSize: number,
 *     partSize: number,
 *     partCount: number,
 *     estimatedTime: {min: number, max: number},
 *     isMobile: boolean,
 *     recommendations: object
 *   }
 * }
 */
router.post('/metrics', multipartController.getMetrics.bind(multipartController))

// Error handling middleware
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Multipart route error:', error)
  
  res.status(500).json({
    success: false,
    error: 'Internal server error in multipart upload service'
  })
})

export default router