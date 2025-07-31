// utils/transcriptFormatter.ts

export type TranscriptSegment = {
  text: string
  startTime: number
  endTime: number
  confidence: number
}

export type WordSegment = {
  text: string
  startTime: number
  endTime: number
  confidence: number
}

export type TrainingStep = {
  id: string
  text: string
  start: number
  end: number
  confidence: number
  duration: number
  wordCount: number
  type: 'introduction' | 'instruction' | 'demonstration' | 'summary' | 'general'
  rewrittenText?: string // Enhanced with GPT rewriting
}

export type StepGroup = {
  title: string
  steps: TrainingStep[]
  totalDuration: number
  averageConfidence: number
}

/**
 * Group words into sentences by punctuation (basic heuristic)
 */
function groupIntoSentences(segments: WordSegment[]): Array<{
  text: string
  startTime: number
  endTime: number
}> {
  const steps: Array<{ text: string; startTime: number; endTime: number }> = []
  let currentText = ''
  let startTime = segments[0]?.startTime || 0

  for (let i = 0; i < segments.length; i++) {
    const word = segments[i]
    currentText += (currentText ? ' ' : '') + word.text

    const isSentenceEnd = /[.!?]$/.test(word.text)
    const isLastWord = i === segments.length - 1

    if (isSentenceEnd || isLastWord) {
      steps.push({
        text: currentText.trim(),
        startTime,
        endTime: word.endTime
      })
      currentText = ''
      startTime = segments[i + 1]?.startTime || word.endTime
    }
  }

  return steps
}

/**
 * Merge consecutive short segments into longer steps
 */
function mergeShortSteps(steps: Array<{ text: string; startTime: number; endTime: number }>, minDuration = 3): Array<{ text: string; startTime: number; endTime: number }> {
  const merged: Array<{ text: string; startTime: number; endTime: number }> = []
  let buffer: Array<{ text: string; startTime: number; endTime: number }> = []

  for (const step of steps) {
    buffer.push(step)
    const duration = buffer[buffer.length - 1].endTime - buffer[0].startTime

    if (duration >= minDuration) {
      const text = buffer.map(s => s.text).join(' ')
      merged.push({
        text,
        startTime: buffer[0].startTime,
        endTime: buffer[buffer.length - 1].endTime
      })
      buffer = []
    }
  }

  // Flush any remaining buffer
  if (buffer.length) {
    const text = buffer.map(s => s.text).join(' ')
    merged.push({
      text,
      startTime: buffer[0].startTime,
      endTime: buffer[buffer.length - 1].endTime
    })
  }

  return merged
}

/**
 * Convert word segments into training steps (alternative approach)
 */
export function generateTrainingStepsFromWords(segments: WordSegment[]): Array<{ text: string; startTime: number; endTime: number }> {
  const sentences = groupIntoSentences(segments)
  const steps = mergeShortSteps(sentences)
  return steps
}

/**
 * Rewrite steps using GPT for clarity and conciseness
 */
export async function rewriteStepsWithGPT(steps: TrainingStep[]): Promise<TrainingStep[]> {
  if (!steps.length) return steps

  try {
    // Import OpenAI dynamically to avoid issues if not configured
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const promptIntro = `You are an AI training assistant. Rewrite the following instructional video steps to be clearer, more concise, and easy to follow for onboarding. Preserve the intent and structure. Return the rewritten steps as a list. Do not add extra commentary.`

    const stepsText = steps.map((step, i) => 
      `\nStep ${i+1} (${step.start}-${step.end}s): ${step.text}`
    ).join('')

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use a more cost-effective model
      messages: [
        { role: 'system', content: promptIntro },
        { role: 'user', content: stepsText }
      ],
      temperature: 0.4
    })

    const rewritten = response.choices[0]?.message?.content?.trim().split('\n') || []

    return steps.map((step, i) => {
      const rewrittenLine = rewritten[i]
      if (rewrittenLine?.trim()) {
        // Strip number if it starts with "Step X:"
        const text = rewrittenLine.includes(':') 
          ? rewrittenLine.split(':', 1)[1]?.trim() || step.text
          : rewrittenLine.trim()
        
        return {
          ...step,
          rewrittenText: text
        }
      }
      return step
    })

  } catch (error) {
    console.error(`❌ GPT rewriting failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return steps // Return original steps if rewriting fails
  }
}

/**
 * Cleans up transcript segments and groups them into logical training steps.
 */
export function formatTranscriptIntoSteps(
  segments: TranscriptSegment[], 
  options: {
    maxWordsPerStep?: number
    minStepDuration?: number
    maxStepDuration?: number
    confidenceThreshold?: number
    useWordLevelSegmentation?: boolean
  } = {}
): TrainingStep[] {
  const {
    maxWordsPerStep = 25,
    minStepDuration = 2,
    maxStepDuration = 30,
    confidenceThreshold = 0.6,
    useWordLevelSegmentation = false
  } = options

  // If using word-level segmentation, convert segments to words first
  if (useWordLevelSegmentation) {
    const wordSegments: WordSegment[] = segments.flatMap(segment => {
      const words = segment.text.split(' ')
      const wordDuration = (segment.endTime - segment.startTime) / words.length
      
      return words.map((word, index) => ({
        text: word,
        startTime: segment.startTime + (index * wordDuration),
        endTime: segment.startTime + ((index + 1) * wordDuration),
        confidence: segment.confidence
      }))
    })

    const basicSteps = generateTrainingStepsFromWords(wordSegments)
    
    return basicSteps.map((step, index) => ({
      id: `step_${index + 1}`,
      text: step.text,
      start: step.startTime,
      end: step.endTime,
      confidence: 0.8, // Default confidence for word-based steps
      duration: step.endTime - step.startTime,
      wordCount: step.text.split(' ').length,
      type: determineStepType(step.text, index)
    }))
  }

  // Original sentence-based approach
  const steps: TrainingStep[] = []
  let currentWords: string[] = []
  let currentStart: number | null = null
  let currentEnd: number | null = null
  let confidences: number[] = []

  for (const segment of segments) {
    // Skip low-confidence segments
    if (segment.confidence < confidenceThreshold) {
      continue
    }

    if (!currentStart) currentStart = segment.startTime
    currentEnd = segment.endTime
    currentWords.push(segment.text)
    confidences.push(segment.confidence)

    const isEndOfSentence = /[.?!]$/.test(segment.text.trim())
    const reachedWordLimit = currentWords.length >= maxWordsPerStep
    const stepDuration = (currentEnd || 0) - (currentStart || 0)
    const shouldCreateStep = isEndOfSentence || reachedWordLimit || stepDuration >= maxStepDuration

    if (shouldCreateStep && currentWords.length > 0) {
      const stepText = currentWords.join(' ').trim()
      const averageConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length
      const duration = (currentEnd || 0) - (currentStart || 0)

      // Only create step if it meets minimum duration and has content
      if (duration >= minStepDuration && stepText.length > 0) {
        const stepType = determineStepType(stepText, steps.length)
        
        steps.push({
          id: `step_${steps.length + 1}`,
          text: stepText,
          start: currentStart || 0,
          end: currentEnd || 0,
          confidence: parseFloat(averageConfidence.toFixed(2)),
          duration,
          wordCount: currentWords.length,
          type: stepType
        })
      }

      // Reset for next step
      currentWords = []
      confidences = []
      currentStart = null
      currentEnd = null
    }
  }

  // Add remaining content as final step
  if (currentWords.length > 0 && currentStart !== null) {
    const stepText = currentWords.join(' ').trim()
    const averageConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length
    const duration = (currentEnd || 0) - (currentStart || 0)

    if (duration >= minStepDuration && stepText.length > 0) {
      const stepType = determineStepType(stepText, steps.length)
      
      steps.push({
        id: `step_${steps.length + 1}`,
        text: stepText,
        start: currentStart,
        end: currentEnd || currentStart + 1,
        confidence: parseFloat(averageConfidence.toFixed(2)),
        duration,
        wordCount: currentWords.length,
        type: stepType
      })
    }
  }

  return steps
}

/**
 * Determine the type of training step based on content and position
 */
function determineStepType(text: string, stepIndex: number): TrainingStep['type'] {
  const lowerText = text.toLowerCase()
  
  // Introduction indicators
  if (stepIndex === 0 || 
      lowerText.includes('welcome') || 
      lowerText.includes('introduction') ||
      lowerText.includes('today we') ||
      lowerText.includes('in this')) {
    return 'introduction'
  }
  
  // Summary indicators
  if (lowerText.includes('summary') || 
      lowerText.includes('conclusion') ||
      lowerText.includes('finally') ||
      lowerText.includes('to summarize')) {
    return 'summary'
  }
  
  // Demonstration indicators
  if (lowerText.includes('demonstrate') || 
      lowerText.includes('show you') ||
      lowerText.includes('watch as') ||
      lowerText.includes('observe')) {
    return 'demonstration'
  }
  
  // Instruction indicators
  if (lowerText.includes('click') || 
      lowerText.includes('press') ||
      lowerText.includes('select') ||
      lowerText.includes('enter') ||
      lowerText.includes('type') ||
      lowerText.includes('drag') ||
      lowerText.includes('scroll')) {
    return 'instruction'
  }
  
  return 'general'
}

/**
 * Group steps into logical training sections
 */
export function groupStepsIntoSections(steps: TrainingStep[]): StepGroup[] {
  const groups: StepGroup[] = []
  let currentGroup: StepGroup | null = null

  for (const step of steps) {
    // Start new group for introduction
    if (step.type === 'introduction') {
      if (currentGroup) {
        groups.push(currentGroup)
      }
      currentGroup = {
        title: 'Introduction',
        steps: [step],
        totalDuration: step.duration,
        averageConfidence: step.confidence
      }
    }
    // Start new group for main content
    else if (step.type === 'instruction' || step.type === 'demonstration') {
      if (currentGroup && currentGroup.title !== 'Main Content') {
        groups.push(currentGroup)
      }
      if (!currentGroup || currentGroup.title !== 'Main Content') {
        currentGroup = {
          title: 'Main Content',
          steps: [step],
          totalDuration: step.duration,
          averageConfidence: step.confidence
        }
      } else {
        currentGroup.steps.push(step)
        currentGroup.totalDuration += step.duration
        currentGroup.averageConfidence = (currentGroup.averageConfidence + step.confidence) / 2
      }
    }
    // Start new group for summary
    else if (step.type === 'summary') {
      if (currentGroup) {
        groups.push(currentGroup)
      }
      currentGroup = {
        title: 'Summary',
        steps: [step],
        totalDuration: step.duration,
        averageConfidence: step.confidence
      }
    }
    // Add to current group
    else {
      if (!currentGroup) {
        currentGroup = {
          title: 'Content',
          steps: [step],
          totalDuration: step.duration,
          averageConfidence: step.confidence
        }
      } else {
        currentGroup.steps.push(step)
        currentGroup.totalDuration += step.duration
        currentGroup.averageConfidence = (currentGroup.averageConfidence + step.confidence) / 2
      }
    }
  }

  // Add final group
  if (currentGroup) {
    groups.push(currentGroup)
  }

  return groups
}

/**
 * Clean and normalize transcript text
 */
export function cleanTranscriptText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\[.*?\]/g, '') // Remove bracketed content (like [inaudible])
    .replace(/\(.*?\)/g, '') // Remove parenthetical content
    .trim()
}

/**
 * Extract key phrases from transcript for step titles
 */
export function extractKeyPhrases(text: string): string[] {
  const phrases = text
    .split(/[.!?]/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 10 && sentence.length < 100)
    .slice(0, 3) // Limit to top 3 phrases
  
  return phrases
}

/**
 * Generate step title from content
 */
export function generateStepTitle(text: string, stepIndex: number): string {
  const cleanText = cleanTranscriptText(text)
  const keyPhrases = extractKeyPhrases(cleanText)
  
  if (keyPhrases.length > 0) {
    return keyPhrases[0]
  }
  
  // Fallback titles
  const fallbackTitles = [
    'Introduction and Overview',
    'Setup and Preparation',
    'Main Demonstration',
    'Key Techniques',
    'Advanced Features',
    'Summary and Review'
  ]
  
  return fallbackTitles[stepIndex] || `Step ${stepIndex + 1}`
}

/**
 * Calculate overall transcript statistics
 */
export function calculateTranscriptStats(steps: TrainingStep[]): {
  totalDuration: number
  averageConfidence: number
  totalWords: number
  stepCount: number
  typeDistribution: Record<string, number>
} {
  const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0)
  const averageConfidence = steps.reduce((sum, step) => sum + step.confidence, 0) / steps.length
  const totalWords = steps.reduce((sum, step) => sum + step.wordCount, 0)
  const typeDistribution = steps.reduce((acc, step) => {
    acc[step.type] = (acc[step.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    totalDuration,
    averageConfidence: parseFloat(averageConfidence.toFixed(2)),
    totalWords,
    stepCount: steps.length,
    typeDistribution
  }
} 