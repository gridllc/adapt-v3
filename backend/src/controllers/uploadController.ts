import { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import { storageService } from '../services/storageService.js'
import { enqueueProcessVideoJob, perfLogger } from '../services/qstashQueue.js'
import { createBasicSteps } from '../services/createBasicSteps.js'
import { DatabaseService } from '../services/prismaService.js'
import { ModuleService } from '../services/moduleService.js'
import { UserService } from '../services/userService.js'
import { logBlockedEvent } from '../utils/logBlockedEvent.js'
import { getMaxUploadsPerUser } from '../config/env.js'
import type { MulterFile } from '../types/express.d.ts'

// Type-safe interface for multer requests  
interface MulterRequest extends Request {
  file: MulterFile
}

interface UploadResult {
  moduleId: string
  videoUrl: string
  title: string
}

// 🎯 Core upload logic - single source of truth
export async function handleUpload(file: MulterFile, userId?: string, providedModuleId?: string): Promise<UploadResult> {
  if (!file) throw new Error('No file provided')
  if (!file.mimetype.startsWith('video/')) throw new Error('Only video files are allowed')

  // 🔐 Upload cap per user (friends & family beta)
  if (userId) {
    const maxUploads = getMaxUploadsPerUser()
    const uploadCount = await DatabaseService.getModuleCountByUser(userId)
    
    if (uploadCount >= maxUploads) {
      // Log the blocked event
      await logBlockedEvent({
        ip: 'unknown', // We don't have access to IP in this context
        userId,
        reason: `Upload limit exceeded (${uploadCount}/${maxUploads})`
      })
      
      throw new Error(`Upload limit reached. Max ${maxUploads} videos allowed during beta testing.`)
    }
    
    console.log(`📊 User ${userId} has ${uploadCount}/${maxUploads} uploads`)
  }

  const moduleId = providedModuleId || uuidv4()
  const originalname = file.originalname
  const title = originalname.replace(/\.[^/.]+$/, '')

  console.log('📦 Starting upload for:', originalname)
  perfLogger.startUpload(originalname)

  const { videoUrl } = await storageService.uploadVideo(file)

  perfLogger.logUploadComplete(moduleId)
  console.log('✅ Video stored at:', videoUrl)

  try {
    await DatabaseService.createModule({
      id: moduleId,
      title,
      filename: file.originalname,
      videoUrl,
      userId: userId || undefined,
    })

    await ModuleService.updateModuleStatus(moduleId, 'processing', 0, 'Upload complete, starting AI processing...')

    await DatabaseService.createActivityLog({
      userId: userId || undefined,
      action: 'CREATE_MODULE',
      targetId: moduleId,
      metadata: {
        title,
        filename: file.originalname,
        videoUrl,
      },
    })
  } catch (err) {
    console.error('❌ Failed to save metadata, cleaning up S3...')
    // Optional: await storageService.deleteVideo(videoUrl)
    throw new Error('Failed to save module metadata')
  }

  try {
    await createBasicSteps(moduleId, originalname)
    console.log('✅ Basic fallback steps created')
  } catch (err) {
    console.warn(`⚠️ Basic steps failed for ${moduleId} — will rely on AI`)
  }

  try {
    await enqueueProcessVideoJob({ moduleId, videoUrl })
    console.log('🚀 Queued AI processing')
  } catch (err) {
    console.warn('⚠️ Upload succeeded but AI processing was not queued')
  }

  return { moduleId, videoUrl, title }
}

export const uploadController = {
  async uploadVideo(req: Request, res: Response) {
    console.log('🔁 Express upload handler triggered')
    
    try {
      // Type-safe file access
      const typedReq = req as MulterRequest
      
      if (!typedReq.file) {
        console.error('❌ No file uploaded')
        return res.status(400).json({ 
          type: 'VALIDATION_ERROR',
          message: 'No file uploaded' 
        })
      }

      console.log('[TEST] 📁 Upload started:', typedReq.file.originalname)
      console.log('[TEST] 📁 File size:', typedReq.file.size, 'bytes')
      console.log('[TEST] 📁 File mimetype:', typedReq.file.mimetype)

      // Get user ID if authenticated
      const userId = await UserService.getUserIdFromRequest(req)
      
      // Use core upload logic
      const { moduleId, videoUrl, title } = await handleUpload(typedReq.file, userId || undefined)
      
      return res.status(200).json({
        success: true,
        moduleId,
        title,
        videoUrl,
        redirectUrl: `/training/${moduleId}`,
        message: 'Video uploaded successfully. AI processing has been queued.'
      })

    } catch (error) {
      console.error('❌ Upload error:', error)
      
      // Clean up file on error
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }
      
      // 🎯 Return typed error for smart frontend retries
      const errorType = error instanceof Error && error.message.includes('Only video files are allowed') 
        ? 'VALIDATION_ERROR' 
        : 'SERVER_ERROR'
      
      return res.status(500).json({ 
        type: errorType,
        message: error instanceof Error ? error.message : 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// 🎯 Updated upload function for new route system - uses core logic
export const uploadVideo = async (file: MulterFile, userId?: string) => {
  return handleUpload(file, userId)
} 