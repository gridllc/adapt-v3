// backend/src/types/training.ts
// Training context types for AI-powered contextual responses

export interface Step {
  id: string
  title: string
  description: string
  start: number
  end: number
  aliases?: string[]
  notes?: string
  isManual?: boolean
  originalText?: string
  aiRewrite?: string
  stepText?: string
}

export interface TrainingContext {
  currentStep: Step | null
  allSteps: Step[]
  videoTime: number
  moduleId: string
  userId?: string
  userProgress?: UserProgress
  learningHistory?: LearningSession[]
  moduleMetadata?: ModuleMetadata
}

export interface UserProgress {
  completedSteps: string[]
  currentStepIndex: number
  timeSpent: number
  questionsAsked: number
  performanceScore: number
  lastActiveStep?: string
  learningPace: 'slow' | 'normal' | 'fast'
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced'
}

export interface LearningSession {
  id: string
  moduleId: string
  userId: string
  startTime: Date
  endTime?: Date
  stepsCompleted: string[]
  questionsAsked: Question[]
  performanceMetrics: PerformanceMetrics
}

export interface Question {
  id: string
  text: string
  timestamp: number
  stepId?: string
  answer?: string
  difficulty: 'easy' | 'medium' | 'hard'
  category: 'concept' | 'procedure' | 'troubleshooting' | 'general'
}

export interface PerformanceMetrics {
  accuracy: number // 0-100
  speed: number // steps per minute
  comprehension: number // 0-100
  retention: number // 0-100
  confidence: number // 0-100
}

export interface ModuleMetadata {
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedDuration: number // minutes
  prerequisites: string[]
  learningObjectives: string[]
  targetAudience: string[]
}

export interface StepGuidance {
  stepId: string
  guidance: string
  hints: string[]
  commonMistakes: string[]
  tips: string[]
  relatedConcepts: string[]
  difficultyAdjustment?: 'simplify' | 'maintain' | 'challenge'
}

export interface ContentRecommendation {
  type: 'step' | 'concept' | 'practice' | 'review'
  priority: 'high' | 'medium' | 'low'
  reason: string
  content: string
  estimatedTime: number
}

export interface AIAnswer {
  answer: string
  confidence: number
  sources: string[]
  relatedSteps: string[]
  followUpQuestions: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading'
}

export interface ChatContext {
  message: string
  moduleId: string
  userId?: string
  currentStep?: Step
  conversationHistory: ChatMessage[]
  userPreferences?: UserPreferences
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  stepId?: string
  metadata?: Record<string, any>
}

export interface UserPreferences {
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading'
  explanationDepth: 'simple' | 'detailed' | 'comprehensive'
  language: string
  accessibility: {
    useSimpleLanguage: boolean
    includeExamples: boolean
    provideStepByStep: boolean
  }
}
