import { exec } from 'child_process'
import path from 'path'
import fs from 'fs/promises'

export interface KeyFrame {
  path: string
  timestamp: number
  filename: string
}

/**
 * Extracts key frames from video at regular intervals
 */
export async function extractKeyFrames(
  videoPath: string, 
  duration: number, 
  intervalSeconds: number = 10,
  moduleId?: string
): Promise<KeyFrame[]> {
  try {
    console.log(`🖼️ [KeyFrameExtractor] Module ${moduleId || 'unknown'}: Extracting key frames...`)
    
    const tempDir = path.dirname(videoPath)
    const baseFilename = path.basename(videoPath, path.extname(videoPath))
    const framesDir = path.join(tempDir, `${baseFilename}_frames`)
    
    // Create frames directory
    await fs.mkdir(framesDir, { recursive: true })
    
    // Calculate frame extraction points
    const frameCount = Math.ceil(duration / intervalSeconds)
    const timestamps = Array.from({ length: frameCount }, (_, i) => i * intervalSeconds)
    
    console.log(`📊 [KeyFrameExtractor] Module ${moduleId || 'unknown'}: Extracting ${frameCount} frames at ${intervalSeconds}s intervals`)
    
    const keyFrames: KeyFrame[] = []
    
    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i]
      const filename = `frame_${String(i + 1).padStart(3, '0')}_${timestamp}s.jpg`
      const outputPath = path.join(framesDir, filename)
      
      // Extract frame at specific timestamp
      await extractFrameAtTimestamp(videoPath, outputPath, timestamp, moduleId)
      
      keyFrames.push({
        path: outputPath,
        timestamp,
        filename
      })
    }
    
    console.log(`✅ [KeyFrameExtractor] Module ${moduleId || 'unknown'}: Extracted ${keyFrames.length} key frames`)
    return keyFrames
    
  } catch (error) {
    console.error(`❌ [KeyFrameExtractor] Module ${moduleId || 'unknown'}: Failed to extract key frames:`, error)
    throw new Error(`Module ${moduleId || 'unknown'}: Failed to extract key frames: ` + (error instanceof Error ? error.message : 'Unknown error'))
  }
}

/**
 * Extracts a single frame at a specific timestamp
 */
async function extractFrameAtTimestamp(
  videoPath: string, 
  outputPath: string, 
  timestamp: number,
  moduleId?: string
): Promise<string> {
  const command = `ffmpeg -i "${videoPath}" -ss ${timestamp} -vframes 1 -q:v 2 "${outputPath}" -y`
  
  console.log(`🔧 [KeyFrameExtractor] Module ${moduleId || 'unknown'}: Running FFmpeg command: ${command}`)
  
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        // Check for common FFmpeg not found patterns
        if (stderr.includes('ffmpeg: not found') || stderr.includes('command not found')) {
          return reject(new Error('FFmpeg not installed or not in PATH'))
        }
        console.error(`❌ [KeyFrameExtractor] Module ${moduleId || 'unknown'}: Failed to extract frame at ${timestamp}s:`, stderr)
        return reject(new Error(`Module ${moduleId || 'unknown'}: Failed to extract frame at ${timestamp}s: ${stderr}`))
      }
      resolve(outputPath)
    })
  })
}

/**
 * Cleanup key frame files
 */
export async function cleanupKeyFrames(keyFrames: KeyFrame[], moduleId?: string): Promise<void> {
  try {
    console.log(`🧹 [KeyFrameExtractor] Module ${moduleId || 'unknown'}: Cleaning up key frames...`)
    
    const cleanupPromises = keyFrames.map(async (frame) => {
      try {
        await fs.unlink(frame.path)
        console.log(`🗑️ [KeyFrameExtractor] Module ${moduleId || 'unknown'}: Deleted:`, frame.filename)
      } catch (error) {
        console.warn(`⚠️ [KeyFrameExtractor] Module ${moduleId || 'unknown'}: Failed to delete:`, frame.filename, error)
      }
    })
    
    await Promise.all(cleanupPromises)
    
    // Try to remove the frames directory
    if (keyFrames.length > 0) {
      const framesDir = path.dirname(keyFrames[0].path)
      try {
        await fs.rm(framesDir, { recursive: true, force: true })
        console.log(`🗑️ [KeyFrameExtractor] Module ${moduleId || 'unknown'}: Removed frames directory:`, framesDir)
      } catch (error) {
        console.warn(`⚠️ [KeyFrameExtractor] Module ${moduleId || 'unknown'}: Failed to remove frames directory:`, error)
      }
    }
    
    console.log(`✅ [KeyFrameExtractor] Module ${moduleId || 'unknown'}: Key frame cleanup completed`)
  } catch (error) {
    console.error(`❌ [KeyFrameExtractor] Module ${moduleId || 'unknown'}: Key frame cleanup failed:`, error)
    // Don't throw - cleanup failures shouldn't break the main flow
  }
}
