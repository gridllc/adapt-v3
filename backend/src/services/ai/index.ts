// Shared types (centralized to reduce circular dependencies)
export type {
  Step,
  ParsedStep,
  TranscriptionResult,
  VideoAnalysisResult,
  VideoProcessingResult,
  KeyFrame,
  VideoMetadata
} from './types.js'

// Core pipeline
export { aiPipeline, generateStepsFromVideo } from './aiPipeline.js'
export { startProcessing } from './pipeline.js'

// Individual services - updated for S3-first approach
export { videoDownloader, s3DownloadToTemp, inferS3KeyForModule } from './videoDownloader.js'
export { audioProcessor, extractAudioWavForModule, cleanupTemp } from './audioProcessor.js'
export { stepSaver } from './stepSaver.js'
export { transcribeAudio } from './transcriber.js'
export { generateVideoSteps } from './stepGenerator.js'

// Main service interface
export { aiService } from '../aiService.js'
