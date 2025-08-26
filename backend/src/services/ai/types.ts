/**
 * Shared types for AI services
 * This file centralizes common interfaces to reduce circular dependencies
 */

/**
 * Basic step structure used across multiple modules
 */
export interface Step {
  id: string
  text: string
  title?: string  // Add title field for frontend compatibility
  startTime: number
  endTime: number
  aliases?: string[]
  notes?: string
}

/**
 * Parsed transcript step (used by transcriptParser.ts)
 */
export interface ParsedStep {
  text: string
  startTime: number
  endTime: number
}

/**
 * Transcription result from Whisper
 */
export interface TranscriptionResult {
  text: string
  segments: Array<{
    start: number
    end: number
    text: string
  }>
}

/**
 * AI analysis result from stepGenerator.ts
 */
export interface VideoAnalysisResult {
  title: string
  description: string
  steps: Step[]
  totalDuration: number
}

/**
 * Final video processing result from aiPipeline.ts
 */
export interface VideoProcessingResult {
  title: string
  description: string
  transcript: string
  segments: Array<{ start: number; end: number; text: string }>
  steps: Step[]
  totalDuration: number
}

/**
 * Key frame extracted from video
 */
export interface KeyFrame {
  path: string
  timestamp: number
  filename: string
}

/**
 * Video metadata extracted by audioProcessor.ts
 */
export interface VideoMetadata {
  duration: number
}
