import { ModuleService } from '../moduleService.js'
import { videoDownloader } from './videoDownloader.js'
import { audioProcessor } from './audioProcessor.js'
import { transcribeAudio } from './transcriber.js'
import { generateVideoSteps } from './stepGenerator.js'
import { stepSaver } from './stepSaver.js'

export const aiPipeline = {
  async processModule(moduleId: string) {
    console.log('▶ AIPipeline start', { moduleId })
    const mod = await ModuleService.getModuleById(moduleId)
    if (!mod.success || !mod.module) throw new Error('Module not found')
    if (!mod.module.s3Key || !mod.module.stepsKey) throw new Error('Missing s3Key/stepsKey')

    try {
      await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 5, 'Starting AI processing...')

      // 1) download MP4 from S3 to a tmp path
      const localMp4 = await videoDownloader.fromS3(mod.module.s3Key)
      console.log('⬇️  downloaded', localMp4)
      await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 15, 'Video downloaded, extracting audio...')

      // 2) extract WAV with ffmpeg
      const wavPath = await audioProcessor.extract(localMp4)
      console.log('🎵 audio', wavPath)
      await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 35, 'Audio extracted, transcribing...')

      // 3) transcribe
      const transcript = await transcribeAudio(wavPath, moduleId)
      await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 55, 'Transcription complete, generating steps...')

      // 4) generate steps
      const steps = await generateVideoSteps(
        transcript.text, 
        transcript.segments, 
        { duration: 0 }, // Mock duration since we don't have video metadata
        moduleId
      )
      await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 75, 'Steps generated, saving to S3...')

      // 5) save steps JSON to S3 at stepsKey
      await stepSaver.saveToS3(mod.module.stepsKey, {
        moduleId,
        title: mod.module.title ?? 'Training',
        transcript: transcript.text,
        segments: transcript.segments,
        steps: steps.steps,
      })

      await ModuleService.updateModuleStatus(moduleId, 'READY', 100, 'AI processing complete!')
      console.log('✅ AIPipeline done', { moduleId, steps: steps.steps?.length || 0 })
    } catch (e: any) {
      console.error('❌ AIPipeline failed', { moduleId, error: e?.message })
      await ModuleService.updateModuleStatus(moduleId, 'FAILED', 0, `Processing failed: ${e?.message ?? String(e)}`)
      throw e
    }
  },
}

// Keep the old function for backward compatibility
export async function generateStepsFromVideo(videoUrl: string, moduleId?: string) {
  if (!moduleId) {
    throw new Error('Module ID is required for S3-first processing')
  }
  return aiPipeline.processModule(moduleId)
}
