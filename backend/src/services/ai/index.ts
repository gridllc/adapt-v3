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
export { generateStepsFromVideo } from './aiPipeline.js'
export { startProcessing } from './pipeline.js'

// Individual services - updated for S3-first approach
export { s3DownloadToTemp, inferS3KeyForModule } from './videoDownloader.js'
export { extractAudioWavForModule, cleanupTemp } from './audioProcessor.js'
export { transcribeAudio } from './transcriber.js'
export { generateVideoSteps } from './stepGenerator.js'
export { saveVideoAnalysis, cleanupTempFiles, uploadToS3 } from './stepSaver.js'
export { parseTranscriptToSteps, createStepsFromSegments } from './transcriptParser.js'
export { extractKeyFrames, cleanupKeyFrames } from './keyFrameExtractor.js'

// Main service interface
export { aiService } from '../aiService.js'
