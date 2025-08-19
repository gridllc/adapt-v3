import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from '../../utils/structuredLogger.js'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

/**
 * Video processing service for normalizing uploads to browser-compatible format
 */
export class VideoProcessor {
  /**
   * Normalize video to MP4 (H.264 + AAC) for browser compatibility
   * This ensures all videos can play in modern browsers
   */
  static async normalizeVideo(inputPath: string, outputPath: string): Promise<string> {
    try {
      // Check if input file exists
      await fs.access(inputPath)
      
      // Create output directory if it doesn't exist
      const outputDir = path.dirname(outputPath)
      await fs.mkdir(outputDir, { recursive: true })
      
      // FFmpeg command to create browser-compatible MP4
      const cmd = `ffmpeg -y -i "${inputPath}" -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k -movflags +faststart "${outputPath}"`
      
      logger.info('🎬 Normalizing video for browser compatibility', { 
        inputPath, 
        outputPath,
        command: cmd 
      })
      
      const { stdout, stderr } = await execAsync(cmd)
      
      if (stderr && !stderr.includes('frame=')) {
        logger.warn('FFmpeg stderr output (may contain warnings):', { stderr })
      }
      
      // Verify output file was created and has size > 0
      const outputStats = await fs.stat(outputPath)
      if (outputStats.size === 0) {
        throw new Error('Normalized video file is empty')
      }
      
      logger.info('✅ Video normalization completed successfully', { 
        inputSize: (await fs.stat(inputPath)).size,
        outputSize: outputStats.size,
        outputPath 
      })
      
      return outputPath
      
    } catch (error: any) {
      logger.error('❌ Video normalization failed', { 
        inputPath, 
        outputPath, 
        error: error?.message || error,
        stack: error?.stack 
      })
      throw new Error(`Video normalization failed: ${error?.message || error}`)
    }
  }

  /**
   * Extract audio from video for transcription
   * Uses MP3 format for better compatibility with transcription services
   */
  static async extractAudio(videoPath: string, audioPath: string): Promise<string> {
    try {
      // Check if input file exists
      await fs.access(videoPath)
      
      // Create output directory if it doesn't exist
      const outputDir = path.dirname(audioPath)
      await fs.mkdir(outputDir, { recursive: true })
      
      // FFmpeg command to extract audio as MP3
      const cmd = `ffmpeg -y -i "${videoPath}" -vn -c:a mp3 -b:a 128k "${audioPath}"`
      
      logger.info('🎵 Extracting audio for transcription', { 
        videoPath, 
        audioPath 
      })
      
      const { stdout, stderr } = await execAsync(cmd)
      
      if (stderr && !stderr.includes('frame=')) {
        logger.warn('FFmpeg stderr output (may contain warnings):', { stderr })
      }
      
      // Verify output file was created and has size > 0
      const outputStats = await fs.stat(audioPath)
      if (outputStats.size === 0) {
        throw new Error('Extracted audio file is empty')
      }
      
      logger.info('✅ Audio extraction completed successfully', { 
        videoSize: (await fs.stat(videoPath)).size,
        audioSize: outputStats.size,
        audioPath 
      })
      
      return audioPath
      
    } catch (error: any) {
      logger.error('❌ Audio extraction failed', { 
        videoPath, 
        audioPath, 
        error: error?.message || error,
        stack: error?.stack 
      })
      throw new Error(`Audio extraction failed: ${error?.message || error}`)
    }
  }

  /**
   * Get video metadata (duration, codec, etc.)
   */
  static async getVideoMetadata(videoPath: string): Promise<{
    duration: number
    videoCodec: string
    audioCodec: string
    width: number
    height: number
    bitrate: number
  }> {
    try {
      const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`
      
      const { stdout } = await execAsync(cmd)
      const metadata = JSON.parse(stdout)
      
      const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video')
      const audioStream = metadata.streams.find((s: any) => s.codec_type === 'audio')
      
      return {
        duration: parseFloat(metadata.format.duration) || 0,
        videoCodec: videoStream?.codec_name || 'unknown',
        audioCodec: audioStream?.codec_name || 'unknown',
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        bitrate: parseInt(metadata.format.bit_rate) || 0
      }
      
    } catch (error: any) {
      logger.error('❌ Failed to get video metadata', { 
        videoPath, 
        error: error?.message || error 
      })
      throw new Error(`Failed to get video metadata: ${error?.message || error}`)
    }
  }

  /**
   * Clean up temporary files
   */
  static async cleanupTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath)
        logger.info('🧹 Cleaned up temporary file', { filePath })
      } catch (error: any) {
        logger.warn('⚠️ Failed to clean up temporary file', { 
          filePath, 
          error: error?.message || error 
        })
      }
    }
  }
}
