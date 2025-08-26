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

// AI Service Result Types
export type AIResult =
  | { ok: true; text: string; tokens?: number; model: string; meta?: Record<string, any> }
  | { ok: false; code: 'LLM_UNAVAILABLE' | 'TIMEOUT' | 'RATE_LIMIT' | 'BAD_PROMPT' | 'PLACEHOLDER_TEXT'; detail?: string };

export type AIQuestionContext = {
  currentStep?: any;
  allSteps: any[];
  videoTime: number;
  moduleId: string;
  userId?: string;
};

// Fallback Response Types
export type FallbackResponse = {
  ok: true;
  source: 'RULES_STEP_LOOKUP' | 'FALLBACK_KEYWORD' | 'FALLBACK_CACHE' | 'FALLBACK_EMPTY' | 'FALLBACK_PLACEHOLDER';
  answer: string;
  meta?: Record<string, any>;
  fallback?: { reason: string; detail?: string };
};

export type AIAnswerResponse = {
  ok: true;
  source: 'AI' | 'RULES_STEP_LOOKUP' | 'FALLBACK_KEYWORD' | 'FALLBACK_CACHE' | 'FALLBACK_EMPTY' | 'FALLBACK_PLACEHOLDER';
  answer: string;
  meta?: Record<string, any>;
  fallback?: { reason: string; detail?: string };
};
