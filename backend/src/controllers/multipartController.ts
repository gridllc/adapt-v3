import { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import {
  createMultipartUpload,
  getSignedUploadPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
} from '../services/s3Uploader.js'

const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '250', 10)
const PART_SIZE_MB = parseInt(process.env.S3_MULTIPART_PART_SIZE_MB || '8', 10)

function isVideo(mime: string | undefined) {
  return !!mime && mime.startsWith('video/')
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export const multipartController = {
  async startUpload(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || 'anonymous'
      const { filename, contentType, size } = req.body as { filename?: string; contentType?: string; size?: number }
      if (!filename || !isVideo(contentType) || typeof size !== 'number') {
        return res.status(400).json({ success: false, error: 'Invalid request' })
      }
      if (size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        return res.status(413).json({ success: false, error: `File exceeds ${MAX_FILE_SIZE_MB}MB` })
      }
      const moduleId = uuidv4()
      const key = `videos/${userId}/${moduleId}/${uuidv4()}-${safeName(filename)}`
      const uploadId = await createMultipartUpload(key, contentType!)
      return res.json({ success: true, uploadId, key, partSizeBytes: PART_SIZE_MB * 1024 * 1024 })
    } catch (error: any) {
      console.error('startUpload error:', error)
      return res.status(500).json({ success: false, error: error.message || 'Failed to start upload' })
    }
  },

  async signPart(req: Request, res: Response) {
    try {
      const { key, uploadId, partNumber } = req.body as { key?: string; uploadId?: string; partNumber?: number }
      if (!key || !uploadId || !partNumber) return res.status(400).json({ success: false, error: 'Missing fields' })
      const url = await getSignedUploadPartUrl(key, uploadId, Number(partNumber))
      return res.json({ success: true, url, expiresIn: 600 })
    } catch (error: any) {
      console.error('signPart error:', error)
      return res.status(500).json({ success: false, error: error.message || 'Failed to sign part' })
    }
  },

  async completeUpload(req: Request, res: Response) {
    try {
      const { key, uploadId, parts } = req.body as { key?: string; uploadId?: string; parts?: { partNumber: number; etag: string }[] }
      if (!key || !uploadId || !Array.isArray(parts) || parts.length === 0 || parts.length > 10000) {
        return res.status(400).json({ success: false, error: 'Invalid completion payload' })
      }
      const sdkParts = parts.map(p => ({ PartNumber: p.partNumber, ETag: p.etag }))
      await completeMultipartUpload(key!, uploadId!, sdkParts)
      return res.json({ success: true, key })
    } catch (error: any) {
      console.error('completeUpload error:', error)
      return res.status(500).json({ success: false, error: error.message || 'Failed to complete upload' })
    }
  },

  async abortUpload(req: Request, res: Response) {
    try {
      const { key, uploadId } = req.body as { key?: string; uploadId?: string }
      if (!key || !uploadId) return res.status(400).json({ success: false, error: 'Missing fields' })
      await abortMultipartUpload(key, uploadId)
      return res.json({ success: true })
    } catch (error: any) {
      console.error('abortUpload error:', error)
      return res.status(500).json({ success: false, error: error.message || 'Failed to abort upload' })
    }
  },
}


