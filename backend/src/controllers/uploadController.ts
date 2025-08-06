import { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { storageService } from '../services/storageService.js'
import { enqueueProcessVideoJob, perfLogger } from '../services/qstashQueue.js'
import { createBasicSteps } from '../services/createBasicSteps.js'
import { DatabaseService } from '../services/prismaService.js'
import { ModuleService } from '../services/moduleService.js'
import { UserService } from '../services/userService.js'

// Type-safe interface for multer requests  
interface MulterRequest extends Request {
  file: any
}

// Configure upload directory
const uploadDir = path.resolve(__dirname, '../../uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Configure multer with disk storage for better file handling
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const moduleId = uuidv4()
    const extension = path.extname(file.originalname)
    const filename = `${moduleId}${extension}`
    cb(null, filename)
  }
})

const upload = multer({ 
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
    fieldSize: 200 * 1024 * 1024  // Also increase field size for large files
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true)
    } else {
      cb(new Error('Only video files are allowed'))
    }
  }
})

export const uploadController = {
  async uploadVideo(req: Request, res: Response) {
    console.log('🔁 Upload handler triggered')
    
    try {
      // Type-safe file access
      const typedReq = req as MulterRequest
      
      if (!typedReq.file) {
        console.error('❌ No file uploaded')
        return res.status(400).json({ error: 'No file uploaded' })
      }

      console.log('[TEST] 📁 Upload started:', typedReq.file.originalname)
      console.log('[TEST] 📁 File size:', typedReq.file.size, 'bytes')
      console.log('[TEST] 📁 File mimetype:', typedReq.file.mimetype)

      const file = typedReq.file
      const originalname = file.originalname
      const moduleId = path.parse(file.filename).name // Extract moduleId from filename

      // Validate file
      if (!file.mimetype.startsWith('video/')) {
        return res.status(400).json({ error: 'Only video files are allowed' })
      }

      perfLogger.startUpload(file.originalname)

      console.log('[TEST] 📁 Processing with storage service...')
      // Upload to storage and get the video URL
      const { videoUrl } = await storageService.uploadVideo(file)
      console.log('[TEST] 📁 Module ID:', moduleId)
      console.log('[TEST] 📁 Video URL:', videoUrl)

      perfLogger.logUploadComplete(moduleId)

      // Create initial module entry in database
      const title = originalname.replace(/\.[^/.]+$/, '')
      
      // Get user ID if authenticated (optional for now)
      const userId = await UserService.getUserIdFromRequest(req)
      
      try {
        await DatabaseService.createModule({
          id: moduleId,
          title,
          filename: file.filename,
          videoUrl,
          userId: userId || undefined
        })
        
        // Update status to processing
        await ModuleService.updateModuleStatus(moduleId, 'processing', 0, 'Upload complete, starting AI processing...')
        console.log('✅ Module entry created in database with processing status')
        
        // Log activity
        await DatabaseService.createActivityLog({
          userId: userId || undefined,
          action: 'CREATE_MODULE',
          targetId: moduleId,
          metadata: { 
            title,
            filename: file.filename,
            videoUrl 
          }
        })
      } catch (error) {
        console.error('❌ Failed to create module in database:', error)
        return res.status(500).json({ error: 'Failed to save module data' })
      }

      // Create basic step files immediately
      console.log('📝 Creating basic step files...')
      try {
        await createBasicSteps(moduleId, originalname)
        console.log('✅ Basic step files created')
      } catch (error) {
        console.error('❌ Failed to create basic step files:', error)
        console.warn(`⚠️ CRITICAL: Basic steps fallback failed for ${moduleId} - module may 404 until AI completes`)
        // Continue anyway - the background processing will handle this
      }

      // Queue AI processing job (async - don't wait!)
      console.log('🚀 Queuing AI processing job...')
      try {
        await enqueueProcessVideoJob({
          moduleId,
          videoUrl
        })
        console.log('✅ AI processing job queued successfully')
      } catch (error) {
        console.error('❌ Failed to queue AI processing job:', error)
        // Don't fail the upload, but log the error
        console.warn('⚠️ Upload succeeded but AI processing may be delayed')
      }

      console.log('✅ Upload completed successfully')
      return res.status(200).json({
        success: true,
        moduleId,
        message: 'Video uploaded successfully. AI processing has been queued.',
        videoUrl
      })

    } catch (error) {
      console.error('❌ Upload error:', error)
      
      // Clean up file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }
      
      return res.status(500).json({ 
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Export the middleware array for direct use
export const handleUpload = [
  upload.single('file') as any,
  uploadController.uploadVideo
] 