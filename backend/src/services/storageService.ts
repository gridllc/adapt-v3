import { uploadToS3, deleteFromS3, getPresignedUrl, getPublicS3Url, isS3Configured } from './s3Uploader.js'
import { DatabaseService } from './prismaService.js'
import { v4 as uuidv4 } from 'uuid'
import { log } from '../utils/logger.js'

// UUID generator for unique module IDs
function generateId(): string {
  return uuidv4()
}

export const storageService = {
  /**
   * Upload video file to S3 and return module info
   */
  async uploadVideo(file: any): Promise<{ moduleId: string; videoUrl: string }> {
    try {
      const moduleId = generateId()
      const filename = `${moduleId}.mp4`
      
      log.test(`📁 Upload started: ${file.originalname}`)
      log.test(`📁 File size: ${file.size} bytes`)
      log.test(`📁 File mimetype: ${file.mimetype}`)
      log.test(`📁 Module ID: ${moduleId}`)
      
      // Validate file type
      if (!file.mimetype.startsWith('video/')) {
        throw new Error('Only video files are allowed')
      }
      
      // Upload to S3
      let videoUrl: string
      
      if (isS3Configured()) {
        log.test(`📁 Uploading to S3: ${filename}`)
        videoUrl = await uploadToS3(file.buffer, filename, file.mimetype)
        log.test(`📁 Video URL: ${videoUrl}`)
      } else {
        log.warn('⚠️ S3 not configured - using fallback local storage')
        // Fallback to local storage for development
        const fs = await import('fs')
        const path = await import('path')
        const { fileURLToPath } = await import('url')
        
        const __filename = fileURLToPath(import.meta.url)
        const __dirname = path.dirname(__filename)
        const uploadsDir = path.join(__dirname, '../../uploads')
        
        // Ensure uploads directory exists
        await fs.promises.mkdir(uploadsDir, { recursive: true })
        
        // Save locally
        const filePath = path.join(uploadsDir, filename)
        await fs.promises.writeFile(filePath, file.buffer)
        
        videoUrl = `http://localhost:8000/uploads/${filename}`
        console.log(`[TEST] 📁 Local fallback URL: ${videoUrl}`)
      }
      
      // Normalize video URL to use consistent base URL
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8000'
      const normalizedVideoUrl = `${baseUrl}/uploads/${filename}`
      
      console.log(`[TEST] 📁 Normalized video URL: ${normalizedVideoUrl}`)
      
      console.log(`[TEST] ✅ Video upload completed successfully`)
      
      // Save filename to database for cleanup operations
      try {
        await DatabaseService.updateModule(moduleId, { 
          videoUrl, 
          filename 
        })
        console.log(`[TEST] ✅ Filename saved to database: ${filename}`)
      } catch (dbError) {
        console.error('[TEST] ❌ Failed to save filename to database:', dbError)
        // Don't fail the upload, but log the error
      }
      
      return {
        moduleId,
        videoUrl: normalizedVideoUrl
      }
    } catch (error) {
      console.error('[TEST] ❌ Error uploading video:', error)
      throw new Error(`Failed to upload video: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  },

  /**
   * Get module from database
   */
  async getModule(moduleId: string): Promise<any> {
    try {
      return await DatabaseService.getModule(moduleId)
    } catch (error) {
      console.error('[TEST] ❌ Error loading module from database:', error)
      return null
    }
  },

  /**
   * Get all modules from database
   */
  async getAllModules(): Promise<any[]> {
    try {
      return await DatabaseService.getAllModules()
    } catch (error) {
      console.error('[TEST] ❌ Error loading modules from database:', error)
      return []
    }
  },

  /**
   * Delete module from database and S3
   */
  async deleteModule(moduleId: string): Promise<boolean> {
    try {
      console.log(`[TEST] 🗑️ Deleting module: ${moduleId}`)
      
      // Get module info first
      const module = await DatabaseService.getModule(moduleId)
      if (!module) {
        console.log(`[TEST] ⚠️ Module not found: ${moduleId}`)
        return false
      }
      
      // Delete from database
      await DatabaseService.deleteModule(moduleId)
      console.log(`[TEST] ✅ Module deleted from database: ${moduleId}`)
      
      // Delete video file from S3 if configured
      if (isS3Configured() && module.filename) {
        const deleted = await deleteFromS3(module.filename)
        if (deleted) {
          console.log(`[TEST] ✅ Video deleted from S3: ${module.filename}`)
        } else {
          console.warn(`[TEST] ⚠️ Failed to delete video from S3: ${module.filename}`)
        }
      } else if (module.filename) {
        // Fallback: try to delete local file
        try {
          const fs = await import('fs')
          const path = await import('path')
          const { fileURLToPath } = await import('url')
          
          const __filename = fileURLToPath(import.meta.url)
          const __dirname = path.dirname(__filename)
          const uploadsDir = path.join(__dirname, '../../uploads')
          const filePath = path.join(uploadsDir, module.filename)
          
          if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath)
            console.log(`[TEST] ✅ Local video file deleted: ${module.filename}`)
          }
        } catch (localError) {
          console.warn(`[TEST] ⚠️ Failed to delete local video file: ${module.filename}`)
        }
      }
      
      console.log(`[TEST] ✅ Module deletion completed: ${moduleId}`)
      return true
    } catch (error) {
      console.error('[TEST] ❌ Delete module error:', error)
      return false
    }
  }
}

/**
 * Get signed S3 URL for file access
 */
export async function getSignedS3Url(filename: string): Promise<string> {
  try {
    if (isS3Configured()) {
      // Use S3 presigned URL
      return await getPresignedUrl(filename)
    } else {
      // Fallback to local URL
      return `http://localhost:8000/uploads/${filename}`
    }
  } catch (error) {
    console.error('[TEST] ❌ Failed to get signed URL:', error)
    // Fallback to public S3 URL if available
    if (isS3Configured()) {
      return getPublicS3Url(filename)
    }
    // Final fallback to local URL
    return `http://localhost:8000/uploads/${filename}`
  }
} 