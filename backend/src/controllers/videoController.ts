import path from 'path'
import { Request, Response } from 'express'
import fs from 'fs'
import { fileURLToPath } from 'url'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const videoController = {
  async serveVideo(req: Request, res: Response) {
    try {
      const { filename } = req.params
      
      // Security: Prevent directory traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' })
      }
      
      const uploadsDir = path.resolve(__dirname, '../uploads')
      const filePath = path.join(uploadsDir, filename)

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Video not found' })
      }

      // Get file stats for Content-Length
      const stat = fs.statSync(filePath)
      const fileSize = stat.size

      // Set proper headers for video streaming
      res.setHeader('Content-Type', 'video/mp4')
      res.setHeader('Content-Length', fileSize.toString())
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Cache-Control', 'public, max-age=3600') // Cache for 1 hour

      // Handle range requests for video seeking
      const range = req.headers.range
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
        const chunksize = (end - start) + 1
        
        const file = fs.createReadStream(filePath, { start, end })
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        }
        res.writeHead(206, head)
        file.pipe(res)
      } else {
        // Serve entire file
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        }
        res.writeHead(200, head)
        fs.createReadStream(filePath).pipe(res)
      }
    } catch (error) {
      console.error('Video serving error:', error)
      res.status(500).json({ error: 'Failed to serve video' })
    }
  },
  async getSignedS3Url(req: Request, res: Response) {
    try {
      const { filename } = req.params
      
      // Always ensure filename has .mp4 extension
      const videoFilename = filename.endsWith('.mp4') ? filename : `${filename}.mp4`
      
      console.log(`🎬 Video URL request for: ${videoFilename}`)
      console.log(`🔍 Original filename: ${filename}`)
      console.log(`🔍 Video filename with extension: ${videoFilename}`)
      
      // Check if video file exists using the correct path
      const videoPath = path.join('C:/Users/pgrif/AI_Projects/adapt-v3/backend/uploads', videoFilename)
      console.log(`📁 Checking video path: ${videoPath}`)
      
      if (!fs.existsSync(videoPath)) {
        console.log(`❌ Video file not found: ${videoPath}`)
        return res.status(404).json({ 
          success: false, 
          error: 'Video file not found',
          requestedFile: videoFilename,
          checkedPath: videoPath
        })
      }
      
      // Return URL with .mp4 extension
      const videoUrl = `http://localhost:${process.env.PORT || 8000}/uploads/${videoFilename}`
      console.log(`✅ Video URL generated: ${videoUrl}`)
      
      res.json({
        success: true,
        url: videoUrl
      })
    } catch (error) {
      console.error('❌ Error getting video URL:', error)
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get video URL' 
      })
    }
  }
}