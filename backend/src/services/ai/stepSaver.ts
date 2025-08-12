import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { Step, VideoAnalysisResult } from './stepGenerator.js'

/**
 * Saves video analysis results to JSON files
 */
export async function saveVideoAnalysis(
  analysis: VideoAnalysisResult,
  outputDir: string = 'data',
  moduleId?: string
): Promise<{ stepsPath: string; analysisPath: string }> {
  try {
    console.log(`💾 [StepSaver] Module ${moduleId || 'unknown'}: Saving video analysis...`)
    
    // TODO: Optionally replace with S3 upload in production
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true })
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const baseFilename = `video-analysis-${moduleId || 'temp'}-${timestamp}-${uuidv4().slice(0, 8)}`
    
    // Save steps to separate file
    const stepsPath = path.join(outputDir, `${baseFilename}-steps.json`)
    await fs.writeFile(stepsPath, JSON.stringify(analysis.steps, null, 2))
    console.log(`✅ [StepSaver] Module ${moduleId || 'unknown'}: Steps saved to:`, stepsPath)
    
    // Save full analysis
    const analysisPath = path.join(outputDir, `${baseFilename}-full.json`)
    await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2))
    console.log(`✅ [StepSaver] Module ${moduleId || 'unknown'}: Full analysis saved to:`, analysisPath)
    
    return { stepsPath, analysisPath }
  } catch (error) {
    console.error(`❌ [StepSaver] Module ${moduleId || 'unknown'}: Failed to save analysis:`, error)
    throw new Error(`Module ${moduleId || 'unknown'}: Failed to save analysis: ` + (error instanceof Error ? error.message : 'Unknown error'))
  }
}



/**
 * Cleanup temporary files
 */
export async function cleanupTempFiles(filePaths: string[]): Promise<void> {
  try {
    console.log('🧹 [StepSaver] Cleaning up temporary files...')
    
    const cleanupPromises = filePaths
      .filter(Boolean)
      .map(async (filePath) => {
        try {
          await fs.unlink(filePath)
          console.log('🗑️ [StepSaver] Deleted:', filePath)
        } catch (error) {
          console.warn('⚠️ [StepSaver] Failed to delete:', filePath, error)
        }
      })
    
    await Promise.all(cleanupPromises)
    console.log('✅ [StepSaver] Cleanup completed')
  } catch (error) {
    console.error('❌ [StepSaver] Cleanup failed:', error)
    // Don't throw - cleanup failures shouldn't break the main flow
  }
}

// Future enhancement: optionally save to S3 instead of local disk
export async function uploadToS3(
  analysis: VideoAnalysisResult,
  bucket: string,
  keyPrefix: string,
  moduleId?: string
): Promise<{ stepsUrl: string; analysisUrl: string }> {
  // TODO: Implement S3 upload for production use
  // This would replace local file saves in production environments
  const label = `Module ${moduleId || 'unknown'}`
  console.log(`☁️ [StepSaver] ${label}: S3 upload not yet implemented - using local storage`)
  throw new Error(`${label}: S3 upload not yet implemented - use local storage for now`)
}
