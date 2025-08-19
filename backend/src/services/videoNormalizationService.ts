// backend/src/services/videoNormalizationService.ts
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

/**
 * Video normalization service for converting uploads to browser-compatible format
 * This ensures all videos can play in modern browsers with mobile-friendly sizes
 */
export class VideoNormalizationService {
  /**
   * Check if a video needs normalization
   */
  static async needsNormalization(buffer: Buffer): Promise<boolean> {
    try {
      // For now, always normalize to ensure consistency
      // In the future, we could check video metadata here
      return true
    } catch (error) {
      console.error('❌ Error checking normalization needs:', error)
      return true // Default to normalizing if check fails
    }
  }

  /**
   * Normalize video buffer to H.264 + AAC with resolution cap
   */
  static async normalizeVideoBuffer(
    buffer: Buffer, 
    filename: string, 
    options: {
      preset?: 'ultrafast' | 'veryfast' | 'fast' | 'medium'
      crf?: number
      audioBitrate?: string
      maxHeight?: number
    } = {}
  ): Promise<Buffer> {
    // Declare variables in function scope for cleanup
    let inputPath = ''
    let outputPath = ''
    
    try {
      const {
        preset = process.env.NODE_ENV === 'production' ? 'veryfast' : 'ultrafast',
        crf = 23,
        audioBitrate = '128k',
        maxHeight = 720 // Cap at 720p for mobile-friendliness
      } = options

      // Create temporary input file
      const tempDir = path.join(process.cwd(), 'temp')
      await fs.mkdir(tempDir, { recursive: true })
      
      inputPath = path.join(tempDir, `input_${Date.now()}.mp4`)
      outputPath = path.join(tempDir, `output_${Date.now()}.mp4`)
      
      // Write buffer to temp file
      await fs.writeFile(inputPath, buffer)
      
      console.log('🎬 Normalizing video with FFmpeg:', {
        inputPath,
        outputPath,
        preset,
        crf,
        maxHeight,
        filename
      })

      // FFmpeg command with resolution cap and mobile optimization
      const ffmpegArgs = [
        '-y', // Overwrite output
        '-i', inputPath,
        '-vf', `scale=-2:${maxHeight}`, // Scale to max height, maintain aspect ratio
        '-c:v', 'libx264', // H.264 video codec
        '-preset', preset, // Environment-aware preset
        '-crf', crf.toString(), // Quality setting
        '-c:a', 'aac', // AAC audio codec
        '-b:a', audioBitrate, // Audio bitrate
        '-movflags', '+faststart', // Optimize for streaming
        '-f', 'mp4', // Force MP4 container
        outputPath
      ]

      const command = `ffmpeg ${ffmpegArgs.join(' ')}`
      console.log('🔧 FFmpeg command:', command)

      // Execute FFmpeg
      const { stdout, stderr } = await execAsync(command, { timeout: 300000 }) // 5 minute timeout
      
      if (stderr && !stderr.includes('frame=')) {
        console.warn('⚠️ FFmpeg stderr output (may contain warnings):', stderr)
      }

      // Read normalized video
      const normalizedBuffer = await fs.readFile(outputPath)
      
      // Clean up temp files
      try {
        await fs.unlink(inputPath)
        await fs.unlink(outputPath)
      } catch (cleanupError) {
        console.warn('⚠️ Failed to clean up temp files:', cleanupError)
      }

      console.log('✅ Video normalization completed successfully', {
        originalSize: buffer.length,
        normalizedSize: normalizedBuffer.length,
        compressionRatio: ((1 - normalizedBuffer.length / buffer.length) * 100).toFixed(1) + '%'
      })

      return normalizedBuffer

    } catch (error: any) {
      console.error('❌ Video normalization failed:', {
        filename,
        error: error?.message || error,
        stack: error?.stack
      })
      
      // Clean up temp files on error
      try {
        if (inputPath) await fs.unlink(inputPath).catch(() => {})
        if (outputPath) await fs.unlink(outputPath).catch(() => {})
      } catch (cleanupError) {
        console.warn('⚠️ Failed to clean up temp files after error:', cleanupError)
      }
      
      throw new Error(`Video normalization failed: ${error?.message || error}`)
    }
  }

  /**
   * Normalize video file to H.264 + AAC with resolution cap (file-based version)
   */
  static async normalizeVideoFile(
    inputPath: string,
    outputPath: string,
    options: {
      preset?: 'ultrafast' | 'veryfast' | 'fast' | 'medium'
      crf?: number
      audioBitrate?: string
      maxHeight?: number
    } = {}
  ): Promise<void> {
    try {
      const {
        preset = process.env.NODE_ENV === 'production' ? 'veryfast' : 'ultrafast',
        crf = 23,
        audioBitrate = '128k',
        maxHeight = 720 // Cap at 720p for mobile-friendliness
      } = options

      console.log('🎬 Normalizing video file with FFmpeg:', {
        inputPath,
        outputPath,
        preset,
        crf,
        maxHeight
      })

                          // CRITICAL: Force full re-encode to H.264/AAC (no passthrough)
                    // This ensures iOS/Android compatibility and fixes MEDIA_ELEMENT_ERROR
                    const ffmpegArgs = [
                      '-y', // Overwrite output
                      '-i', inputPath,
                      '-vf', `scale='min(1280,iw)':-2`, // Cap width at 1280, maintain aspect ratio
                      '-c:v', 'libx264', // H.264 video codec
                      '-preset', preset, // Environment-aware preset
                      '-profile:v', 'baseline', // iOS/Android safe profile
                      '-level', '3.0', // Compatibility level
                      '-pix_fmt', 'yuv420p', // iOS/Android safe pixel format
                      '-crf', crf.toString(), // Quality setting
                      '-c:a', 'aac', // AAC audio codec (force re-encode)
                      '-b:a', audioBitrate, // Audio bitrate
                      '-movflags', '+faststart', // Enable streaming in browsers
                      '-f', 'mp4', // Force MP4 container
                      '-avoid_negative_ts', 'make_zero', // Fix timestamp issues
                      '-fflags', '+genpts', // Generate presentation timestamps
                      outputPath
                    ]

      const command = `ffmpeg ${ffmpegArgs.join(' ')}`
      console.log('🔧 FFmpeg command (forced re-encode):', command)

      // Execute FFmpeg with proper error handling
      const { stdout, stderr } = await execAsync(command, { timeout: 300000 }) // 5 minute timeout
      
      // Log FFmpeg output for debugging
      if (stdout) console.log('📹 FFmpeg stdout:', stdout);
      if (stderr) {
        if (stderr.includes('frame=')) {
          console.log('📹 FFmpeg progress:', stderr.split('\n').filter(line => line.includes('frame=')).pop());
        } else {
          console.warn('⚠️ FFmpeg stderr (may contain warnings):', stderr);
        }
      }

                          // CRITICAL: Validate that FFmpeg actually created a valid output file
                    try {
                      const outputStats = await fs.stat(outputPath);
                      if (!outputStats.size || outputStats.size === 0) {
                        throw new Error(`FFmpeg output file is empty (${outputStats.size} bytes)`);
                      }
                      
                      // Verify it's a valid MP4 by checking the file header
                      const outputBuffer = await fs.readFile(outputPath);
                      const mp4Signature = outputBuffer.slice(4, 8).toString();
                      if (mp4Signature !== 'ftyp') {
                        throw new Error(`FFmpeg output is not a valid MP4. Expected 'ftyp', got '${mp4Signature}'`);
                      }
                      
                      // ✅ CRITICAL: Verify codecs with ffprobe
                      console.log('🔍 Verifying video codecs with ffprobe...');
                      const { exec } = await import('child_process');
                      const { promisify } = await import('util');
                      const execAsync = promisify(exec);
                      
                      const { stdout: codecInfo } = await execAsync(`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,codec_type -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`);
                      const { stdout: audioInfo } = await execAsync(`ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,codec_type -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`);
                      
                      console.log('🔍 Codec info:', { video: codecInfo.trim(), audio: audioInfo.trim() });
                      
                      // Verify H.264 video and AAC audio
                      if (!codecInfo.includes('h264')) {
                        throw new Error(`Video codec is not H.264: ${codecInfo.trim()}`);
                      }
                      if (!audioInfo.includes('aac')) {
                        throw new Error(`Audio codec is not AAC: ${audioInfo.trim()}`);
                      }
                      
                      console.log(`🔍 Codec validation passed: H.264 video + AAC audio, ${mp4Signature} signature, ${outputStats.size} bytes`);
                    } catch (validationError: any) {
                      throw new Error(`FFmpeg validation failed: ${validationError.message}`);
                    }

      console.log('✅ Video file normalization completed successfully')

    } catch (error: any) {
      console.error('❌ Video file normalization failed:', {
        inputPath,
        outputPath,
        error: error?.message || error,
        stack: error?.stack
      })
      
      throw new Error(`Video file normalization failed: ${error?.message || error}`)
    }
  }

  /**
   * Get video metadata using FFprobe
   */
  static async getVideoMetadata(buffer: Buffer): Promise<{
    duration: number
    width: number
    height: number
    videoCodec: string
    audioCodec: string
    bitrate: number
  }> {
    try {
      const tempDir = path.join(process.cwd(), 'temp')
      await fs.mkdir(tempDir, { recursive: true })
      
      const tempPath = path.join(tempDir, `metadata_${Date.now()}.mp4`)
      await fs.writeFile(tempPath, buffer)

      const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${tempPath}"`
      const { stdout } = await execAsync(command, { timeout: 30000 })
      
      // Clean up temp file
      await fs.unlink(tempPath).catch(() => {})

      const metadata = JSON.parse(stdout)
      const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video')
      const audioStream = metadata.streams.find((s: any) => s.codec_type === 'audio')

      return {
        duration: parseFloat(metadata.format.duration) || 0,
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        videoCodec: videoStream?.codec_name || 'unknown',
        audioCodec: audioStream?.codec_name || 'unknown',
        bitrate: parseInt(metadata.format.bit_rate) || 0
      }

    } catch (error: any) {
      console.error('❌ Failed to get video metadata:', error)
      throw new Error(`Failed to get video metadata: ${error?.message || error}`)
    }
  }

  /**
   * Check if FFmpeg is available
   */
  static async checkFFmpegAvailability(): Promise<boolean> {
    try {
      await execAsync('ffmpeg -version', { timeout: 5000 })
      return true
    } catch (error) {
      console.error('❌ FFmpeg not available:', error)
      return false
    }
  }
}