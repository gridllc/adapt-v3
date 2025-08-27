import { Request, Response } from 'express'
import { ModuleService } from '../services/moduleService.js'
import { HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3, BUCKET } from '../services/presignedUploadService.js'
import { prisma } from '../config/database.js'

export const uploadController = {
  /**
   * Complete upload after S3 presigned upload
   * This is the missing piece that starts the AI pipeline
   */
  async completeUpload(req: Request, res: Response) {
    try {
      const { moduleId, key, filename, contentType, size } = req.body
      
      if (!moduleId || !key) {
        console.log('❌ Complete upload missing required fields:', { moduleId: !!moduleId, key: !!key })
        return res.status(400).json({ 
          ok: false, 
          error: 'moduleId and key required' 
        })
      }

      console.log('[UPLOAD] complete', { moduleId, key, filename, contentType, size })

      try {
        // 1) Verify object actually exists at this exact key
        await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
        console.log('✅ S3 object verified at key:', key)
      } catch (err: any) {
        console.error('❌ S3 object not found at key:', key, err)
        return res.status(500).json({
          ok: false,
          error: 'Failed to complete upload',
          details: err?.Code === 'NotFound' || err?.name === 'NotFound' ? 'Object not found' : err?.message,
        })
      }

      // 2) Update module with the exact S3 key and metadata
      // First update the status
      await ModuleService.updateModuleStatus(moduleId, 'UPLOADED', 100, 'Upload completed')
      
      // Then update the S3 key and other metadata directly with Prisma
      await prisma.module.update({
        where: { id: moduleId },
        data: {
          s3Key: key,
          filename: filename || null,
        }
      })
      console.log('✅ Module updated with S3 key:', key)

      // 3) Generate playback URL for immediate use
      let playbackUrl = ''
      try {
        playbackUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: BUCKET, Key: key }),
          { expiresIn: 60 * 30 } // 30 minutes
        )
        console.log('✅ Generated playback URL')
      } catch (urlError) {
        console.warn('⚠️ Failed to generate playback URL:', urlError)
      }

      // 4) Start the AI pipeline WITH THE SAME KEY
      console.log('[PIPELINE] start', { moduleId, key })
      
      // Import and start processing
      const { startProcessing } = await import('../services/ai/aiPipeline.js')
      await startProcessing(moduleId)

      return res.json({ 
        ok: true, 
        moduleId, 
        playbackUrl,
        message: 'Upload completed and AI processing started'
      })
    } catch (error) {
      console.error('❌ Complete upload failed:', error)
      res.status(500).json({ 
        ok: false, 
        error: 'Failed to complete upload',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}
