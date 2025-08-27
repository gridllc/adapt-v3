import { Request, Response } from 'express'
import { ModuleService } from '../services/moduleService.js'
import { storageService } from '../services/storageService.js'
import { startProcessing } from '../services/ai/aiPipeline.js'
import { enqueueProcessModule, processModuleDirectly, isEnabled } from '../services/qstashQueue.js'
import { DatabaseService } from '../services/prismaService.js'
import { presignedUploadService } from '../services/presignedUploadService.js'
import { v4 as uuidv4 } from 'uuid'
import path from 'node:path'
import { HeadObjectCommand, CopyObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { prisma } from '../config/database.js'
import { log as logger } from '../utils/logger.js'
import * as aiPipeline from '../services/ai/aiPipeline.js'

// S3 client for HEAD operations
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-west-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

// Helper to strip extension for a decent default title
const baseTitle = (key: string) => path.basename(key).replace(/\.[^/.]+$/, '')

// Single processing function - either enqueue or run inline
async function queueOrInline(moduleId: string) {
  try {
    // If QStash is enabled, try to enqueue
    if (isEnabled()) {
      const jobId = await enqueueProcessModule(moduleId)
      console.log('📬 Enqueued processing job', { moduleId, jobId })
    } else {
      // QStash disabled - run inline processing
      console.log('⚙️ QStash disabled, running inline processing:', moduleId)
      await startProcessing(moduleId)
    }
  } catch (e: any) {
    // Handle QStash disabled gracefully, fall back to inline processing
    if (e?.message === 'QSTASH_DISABLED') {
      console.log('📬 QStash disabled, running inline processing:', moduleId)
      await startProcessing(moduleId)
    } else {
      console.error('Processing error:', e)
      throw e
    }
  }
}

// Minimal helpers that keep the existing response contract
const ok = (res: Response, extra: any = {}) => res.status(200).json({ success: true, ...extra })
const fail = (res: Response, status: number, msg: string, extra: any = {}) =>
  res.status(status).json({ success: false, error: msg, ...extra })

export const uploadController = {
  async uploadComplete(req: any, res: any) {
    const rid = req.rid || 'no-rid'
    const { moduleId, key, filename, contentType, size, etag } = req.body ?? {}
    const Bucket = process.env.AWS_BUCKET_NAME

    if (!moduleId || !key) {
      console.warn('[UploadComplete] 400 MISSING_FIELDS', { rid, moduleId, key })
      return fail(res, 400, 'Missing moduleId or key')
    }
    if (!Bucket) {
      console.error('[UploadComplete] 500 MISSING_ENV', { rid })
      return fail(res, 500, 'Server not configured for S3')
    }

    const Key = String(key)

    try {
      // 1) Verify object is really in S3 and check ContentType
      const head = await s3.send(new HeadObjectCommand({ Bucket, Key }))
      const s3Type = head.ContentType || null
      const finalType = contentType || s3Type || 'video/mp4'

      // Android fix: ensure correct ContentType for playback
      if (s3Type !== finalType) {
        await s3.send(
          new CopyObjectCommand({
            Bucket,
            Key,
            CopySource: `/${Bucket}/${encodeURIComponent(Key)}`,
            MetadataDirective: 'REPLACE',
            ContentType: finalType,
            Metadata: head.Metadata,
            ACL: 'private',
          })
        )
        console.info('[UploadComplete] ContentType normalized', { rid, from: s3Type, to: finalType })
      }

      // Validate ContentType is video for Android playback
      if (!finalType.startsWith('video/')) {
        return fail(res, 400, 'Invalid content type - must be video file')
      }

      // 2) Ensure Module exists (no schema change)
      const title = filename || baseTitle(key)
      await prisma.module.upsert({
        where: { id: moduleId },
        update: {
          s3Key: key,
          status: 'PROCESSING',
          progress: 1,
          updatedAt: new Date(),
          title,
        },
        create: {
          id: moduleId,
          s3Key: key,
          status: 'PROCESSING',
          progress: 1,
          title,
          filename: filename || title + '.mp4',
          videoUrl: `https://${Bucket}.s3.amazonaws.com/${key}`,
        },
      })

      // 3) Kick off AI processing (don't block request)
      try {
        // fire-and-forget; wrap in try/catch
        // await aiPipeline.process({ moduleId, key, filename: filename ?? key.split('/').pop() })
      } catch (bgErr: any) {
        console.error('[AIPipeline enqueue error]', { rid, message: bgErr?.message, name: bgErr?.name })
      }

      console.info('[UploadComplete] OK', {
        rid,
        moduleId,
        key: Key,
        size: head.ContentLength ?? size ?? null,
        type: finalType,
      })
      return ok(res, { moduleId })
    } catch (err: any) {
      const http = err?.$metadata?.httpStatusCode
      console.error('[UploadComplete] ERROR', {
        rid,
        name: err?.name,
        message: err?.message,
        s3Http: http,
        code: err?.code,
        bucket: Bucket,
        key: Key,
        stack: (err?.stack || '').split('\n').slice(0, 4).join(' | '),
      })

      if (err?.name === 'NotFound' || http === 404) {
        return fail(res, 404, 'S3 object not found')
      }
      if (err?.name === 'AccessDenied' || http === 403) {
        return fail(res, 403, 'S3 access denied')
      }
      return fail(res, 500, 'Upload complete failed')
    }
  },

  async uploadVideo(req: Request, res: Response) {
    try {
      console.log('=== UPLOAD CONTROLLER HIT ===')
      console.log('Method:', req.method)
      console.log('Headers:', req.headers)
      console.log('Body keys:', Object.keys(req.body || {}))
      console.log('File:', req.file ? 'FILE PRESENT' : 'NO FILE')

      if (!req.file) {
        console.log('ERROR: No file in request')
        return res.status(400).json({ error: 'No file uploaded' })
      }

      const file = req.file
      console.log('File details:', {
        name: file.originalname,
        size: file.size,
        type: file.mimetype
      })
      
      // Validate file
      if (!file.mimetype.startsWith('video/')) {
        console.log('ERROR: Invalid file type')
        return res.status(400).json({ error: 'Only video files are allowed' })
      }

      console.log('✅ File validated successfully')

      // Additional file integrity check
      console.log('🔍 File integrity check:', {
        size: file.size,
        sizeInMB: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        bufferLength: file.buffer?.length || 0,
        bufferValid: file.buffer && file.buffer.length > 0
      })

      // Check if file is too small (likely corrupted)
      if (file.size < 1000) { // Less than 1KB
        console.error('❌ File too small, likely corrupted:', file.size)
        return res.status(400).json({ 
          error: 'File appears to be corrupted or incomplete',
          userMessage: 'The uploaded file is too small and appears to be corrupted. Please try uploading the video again.',
          size: file.size,
          code: 'FILE_CORRUPTED'
        })
      }

      // Check if file is unreasonably large (likely corrupted)
      if (file.size > 500 * 1024 * 1024) { // More than 500MB
        console.error('❌ File too large, likely corrupted:', file.size)
        return res.status(400).json({ 
          error: 'File size exceeds reasonable limits',
          userMessage: 'The uploaded file is unusually large and may be corrupted. Please check the file and try again.',
          size: file.size,
          maxSize: '500MB',
          code: 'FILE_TOO_LARGE'
        })
      }

      // Check if buffer is valid
      if (!file.buffer || file.buffer.length === 0) {
        console.error('❌ File buffer is empty or invalid')
        return res.status(400).json({ 
          error: 'File buffer is empty or invalid',
          userMessage: 'The uploaded file could not be read properly. Please try uploading the video again.',
          bufferLength: file.buffer?.length || 0,
          code: 'FILE_BUFFER_INVALID'
        })
      }

      // Check if buffer size matches file size
      if (file.buffer.length !== file.size) {
        console.error('❌ Buffer size mismatch:', { bufferLength: file.buffer.length, fileSize: file.size })
        return res.status(400).json({ 
          error: 'File size mismatch detected',
          userMessage: 'The uploaded file appears to be incomplete. Please try uploading the video again.',
          bufferLength: file.buffer.length,
          fileSize: file.size,
          code: 'FILE_SIZE_MISMATCH'
        })
      }

      // Upload video using storageService (S3 or mock)
      console.log('🚀 Starting video upload...')
      
      // Generate canonical S3 key first
      const moduleId = uuidv4() // Generate UUID here for consistent key
      const s3Key = `videos/${moduleId}.mp4`
      const stepsKey = `training/${moduleId}.json`
      
      console.log('🔑 Generated canonical keys:', { s3Key, stepsKey })
      
      // Upload with the canonical key
      const videoUrl = await storageService.uploadVideoWithKey(file, s3Key)
      console.log('✅ Video upload completed:', videoUrl)

      // Create module data with canonical keys
      const moduleData = {
        id: moduleId, // Use the pre-generated ID
        title: file.originalname.replace(/\.[^/.]+$/, ''), // Remove file extension
        filename: file.originalname, // Store original filename only (no UUID prefix)
        videoUrl: videoUrl, // Keep original URL for compatibility
        s3Key: s3Key, // Store canonical S3 key
        stepsKey: stepsKey, // Store canonical steps key
        status: 'UPLOADED' as const,
      }

      // Save module using storageService (database or mock)
      console.log('💾 Saving module data...')
      let savedModuleId: string
      try {
        // Pass the user ID if authenticated
        const userId = (req as any).userId
        console.log('👤 User ID for module creation:', userId || 'No user authenticated')
        
        savedModuleId = await storageService.saveModule(moduleData, userId)
        console.log('✅ Module saved with ID:', savedModuleId)
        console.log('🔍 Module ID type check:', {
          isMock: savedModuleId.startsWith('mock_module_'),
          isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(savedModuleId),
          length: savedModuleId.length,
          value: savedModuleId
        })
      } catch (saveError) {
        console.error('❌ Failed to save module:', saveError)
        return res.status(500).json({ 
          error: 'Failed to save module',
          userMessage: 'Your video was uploaded but we could not save the module data. Please try again.',
          technicalDetails: saveError instanceof Error ? saveError.message : 'Unknown error',
          code: 'MODULE_SAVE_FAILED'
        })
      }

      // Send success response immediately
      const response = {
        success: true,
        moduleId: savedModuleId,
        videoUrl: s3Key,        // keep canonical key, not a local path
        status: 'uploaded',
        steps: [],
        message: 'Video uploaded successfully. AI processing will start shortly...'
      }

      console.log('✅ Returning success response:', response)
      res.json(response)

      // fire-and-forget AFTER sending the response
      queueMicrotask(async () => {
        try {
          console.log('[Upload] Starting inline processing for', savedModuleId)
          
          // Single processing function - no duplicate calls
          await queueOrInline(savedModuleId)
          
        } catch (err) {
          console.error('Auto-enqueue failed:', err)
          // Don't update status here - let the pipeline handle it
        }
      })

    } catch (error) {
      console.error('💥 Upload controller error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined
      
      // Provide user-friendly error messages based on error type
      let userMessage = 'An unexpected error occurred during upload. Please try again.'
      let errorCode = 'UNKNOWN_ERROR'
      
      if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
        userMessage = 'The upload system encountered a file system error. Please try uploading again.'
        errorCode = 'FILE_SYSTEM_ERROR'
      } else if (errorMessage.includes('permission') || errorMessage.includes('access denied')) {
        userMessage = 'The upload system does not have permission to process your file. Please contact support.'
        errorCode = 'PERMISSION_ERROR'
      } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        userMessage = 'The upload took too long and timed out. Please try uploading a smaller file or check your internet connection.'
        errorCode = 'TIMEOUT_ERROR'
      } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        userMessage = 'A network error occurred during upload. Please check your internet connection and try again.'
        errorCode = 'NETWORK_ERROR'
      }
      
      res.status(500).json({ 
        error: 'Upload failed',
        userMessage: userMessage,
        technicalDetails: errorMessage,
        errorCode: errorCode,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      })
    }
  },
}
