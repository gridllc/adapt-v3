/**
 * Shared interface for parsed transcript steps
 */
export interface ParsedStep {
  timestamp: number
  title: string
  description: string
  duration: number
}

/**
 * Parse raw transcript text into structured training steps.
 * Each step includes a timestamp, title, description, and duration.
 * 
 * ⚠️ NOTE: This function uses static 30s timestamps as a fallback.
 * For more accurate timing, prefer createStepsFromSegments() when segment data is available.
 */
export function parseTranscriptToSteps(
  transcript: string,
  moduleId?: string
): ParsedStep[] {
  const label = `Module ${moduleId || 'unknown'}`
  console.log(`📝 [TranscriptParser] ${label}: Parsing transcript into steps...`)
  
  console.warn(`⚠️ [TranscriptParser] ${label}: Using static 30s timestamps – consider using segment data if available.`)

  const lines = transcript
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  const steps = lines.map((line, index) => {
    const timestamp = index * 30 // naive assumption: 30s per line
    return {
      timestamp,
      title: `Step ${index + 1}`,
      description: line,
      duration: 30
    }
  })

  console.log(`✅ [TranscriptParser] ${label}: Parsed ${steps.length} steps from transcript`)
  return steps
}

/**
 * Alternative step generation that creates steps from transcript segments
 * This is the preferred method when segment timing data is available.
 */
export function createStepsFromSegments(
  segments: Array<{ start: number; end: number; text: string }>,
  moduleId?: string
): ParsedStep[] {
  const label = `Module ${moduleId || 'unknown'}`
  console.log(`📝 [TranscriptParser] ${label}: Creating steps from transcript segments...`)

  const steps = segments.map((segment, index) => {
    const duration = segment.end - segment.start
    return {
      timestamp: segment.start,
      title: `Step ${index + 1}`,
      description: segment.text.trim(),
      duration: Math.max(duration, 1) // Ensure minimum 1 second duration
    }
  })

  console.log(`✅ [TranscriptParser] ${label}: Created ${steps.length} steps from segments`)
  return steps
}
