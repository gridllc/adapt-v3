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
   * Delete module from database and cloud storage
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
      
      // Delete video file from cloud storage if configured
      if (isS3Configured() && module.filename) {
        const deleted = await deleteFromS3(module.filename)
        if (deleted) {
          console.log(`[TEST] ✅ Video deleted from cloud storage: ${module.filename}`)
        } else {
          console.warn(`[TEST] ⚠️ Failed to delete video from cloud storage: ${module.filename}`)
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
 * Get signed URL for file access
 */
export async function getSignedS3Url(filename: string): Promise<string> {
  try {
    if (isS3Configured()) {
      // Use cloud storage presigned URL
      return await getPresignedUrl(filename)
    } else {
      // Fallback to local URL
      return `http://localhost:8000/uploads/${filename}`
    }
  } catch (error) {
    console.error('[TEST] ❌ Failed to get signed URL:', error)
    // Fallback to public URL if available
    if (isS3Configured()) {
      return getPublicS3Url(filename)
    }
    // Final fallback to local URL
    return `http://localhost:8000/uploads/${filename}`
  }
} 