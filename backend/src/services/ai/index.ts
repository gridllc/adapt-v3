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

// Training types for AI contextual responses
export type {
  TrainingContext,
  UserProgress,
  LearningSession,
  Question,
  PerformanceMetrics,
  ModuleMetadata,
  StepGuidance,
  ContentRecommendation,
  AIAnswer,
  ChatContext,
  ChatMessage,
  UserPreferences
} from '../../types/training.js'

// Core pipeline
export { startProcessing, generateStepsFromVideo } from './aiPipeline.js'

// Individual services - updated for S3-first approach
export { videoDownloader, s3DownloadToTemp, inferS3KeyForModule } from './videoDownloader.js'
export { audioProcessor, extractAudioWavForModule, cleanupTemp } from './audioProcessor.js'
export { stepSaver } from './stepSaver.js'
export { transcribeAudio } from './transcriber.js'
export { generateVideoSteps } from './stepGenerator.js'
// Removed old exports: saveVideoAnalysis, cleanupTempFiles, uploadToS3, parseTranscriptToSteps, createStepsFromSegments, extractKeyFrames, cleanupKeyFrames

// AI Response Generator for contextual responses
export { aiResponseGenerator } from '../aiResponseGenerator.js'

// Main service interface
export { aiService } from '../aiService.js'
