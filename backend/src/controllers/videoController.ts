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
  }
}