import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { Step, VideoAnalysisResult } from './types.js'
import { smartTrimTranscript, getTranscriptCap } from './utils.js'

// Gemini API gating - prevents any Gemini calls unless explicitly enabled
const USE_GEMINI = 
  (process.env.ENABLE_GEMINI || '').toLowerCase() === 'true' &&
  !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim())

const OAI_MODEL = process.env.OPENAI_MODEL_STEPS || 'gpt-4o-mini'
const TEMP = Number(process.env.AI_TEMPERATURE ?? 0.2)
const MAX_OUT = Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 800)

// Initialize clients lazily
let geminiClient: GoogleGenerativeAI | null = null
let openai: OpenAI | undefined

// Configurable model names
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4'
const geminiModel = process.env.GEMINI_MODEL || 'gemini-pro'

function initializeClients() {
  // Initialize Google Generative AI only if explicitly enabled
  if (USE_GEMINI && !geminiClient && process.env.GEMINI_API_KEY) {
    try {
      geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      console.log('✅ [StepGenerator] Google Generative AI initialized (explicitly enabled)')
    } catch (error) {
      console.error(`❌ [StepGenerator] Failed to initialize Google Generative AI: ${error instanceof Error ? error.message : 'Unknown error'}`)
      geminiClient = null
    }
  } else if (!USE_GEMINI) {
    console.log('🚫 [StepGenerator] Gemini disabled via ENABLE_GEMINI=false - using OpenAI only')
  } else if (!process.env.GEMINI_API_KEY) {
    console.log('🚫 [StepGenerator] Gemini API key missing - using OpenAI only')
  }

  // Initialize OpenAI (always available as fallback)
  if (!openai && process.env.OPENAI_API_KEY) {
    try {
      openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      console.log('✅ [StepGenerator] OpenAI initialized')
    } catch (error) {
      console.error(`❌ [StepGenerator] Failed to initialize OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

/**
 * Generates video steps using AI analysis of transcript and metadata
 */
export async function generateVideoSteps(
  transcript: string,
  segments: Array<{ start: number; end: number; text: string }>,
  metadata: { duration: number },
  moduleId?: string
): Promise<VideoAnalysisResult> {
  initializeClients()
  
  // Smart transcript trimming to reduce AI costs
  const cap = getTranscriptCap();
  const trimmedTranscript = smartTrimTranscript(transcript, cap);
  const wasTrimmed = transcript.length !== trimmedTranscript.length;
  
  const label = `Module ${moduleId || 'unknown'}`
  console.log(`🤖 [StepGenerator] ${label}: Starting AI analysis...`)
  console.log(`📝 [StepGenerator] ${label}: Transcript length: ${transcript.length} characters${wasTrimmed ? ` (trimmed to ${trimmedTranscript.length})` : ''}`)
  console.log(`📊 [StepGenerator] ${label}: Video duration: ${metadata.duration}s`)
  console.log(`🔧 [StepGenerator] ${label}: Using OpenAI model: ${OAI_MODEL}`)
  console.log(`🔧 [StepGenerator] ${label}: Gemini enabled: ${USE_GEMINI ? 'YES' : 'NO'}`)
  console.log(`🔧 [StepGenerator] ${label}: Segments available: ${segments.length > 0 ? 'YES' : 'NO'}`)

  // If we have segments, use them to create better timing context
  let enhancedTranscript = trimmedTranscript
  if (segments.length > 0) {
    const segmentInfo = segments.map((seg, i) => 
      `[${Math.round(seg.start)}s-${Math.round(seg.end)}s] ${seg.text}`
    ).join('\n')
    enhancedTranscript = `TRANSCRIPT WITH TIMING:\n${segmentInfo}\n\nFULL TRANSCRIPT:\n${trimmedTranscript}`
  }

  try {
    // Try OpenAI first (preferred), fallback to Gemini only if explicitly enabled
    if (openai) {
      try {
        return await generateWithOpenAI(enhancedTranscript, segments, metadata, moduleId)
      } catch (openaiError) {
        console.warn(`⚠️ [StepGenerator] ${label}: OpenAI failed:`, openaiError)
        if (USE_GEMINI && geminiClient) {
          console.log(`🔄 [StepGenerator] ${label}: Falling back to Gemini...`)
          return await generateWithGemini(geminiClient, enhancedTranscript, segments, metadata, moduleId)
        }
        throw openaiError
      }
    }

    // Only try Gemini if OpenAI is not available and Gemini is explicitly enabled
    if (USE_GEMINI && geminiClient) {
      return await generateWithGemini(geminiClient, enhancedTranscript, segments, metadata, moduleId)
    }

    throw new Error('No AI service available (OPENAI_API_KEY required)')
  } catch (error) {
    console.error(`❌ [StepGenerator] ${label}: AI analysis failed:`, error)
    
    // Fallback: create steps from transcript if AI fails
    console.log(`🔄 [StepGenerator] ${label}: Creating fallback steps from transcript...`)
    return createFallbackSteps(transcript, segments, metadata, moduleId)
  }
}

// Fallback step creation when AI fails
function createFallbackSteps(
  transcript: string,
  segments: Array<{ start: number; end: number; text: string }>,
  metadata: { duration: number },
  moduleId?: string
): VideoAnalysisResult {
  const label = `Module ${moduleId || 'unknown'}`
  console.log(`🔄 [StepGenerator] ${label}: Creating intelligent fallback steps...`)
  
  let steps: any[] = []
  
  if (segments.length > 0) {
    // Use available segments to create steps
    steps = segments.map((segment, index) => {
      const duration = Math.max(segment.end - segment.start, 2) // Minimum 2 seconds
      const title = generateStepTitle(segment.text, index)
      return {
        id: `step-${index + 1}`,
        title,
        text: segment.text.trim(),
        start: segment.start,
        end: segment.end,
        aliases: [],
        notes: `Auto-generated from transcript segment`
      }
    })
    
    // Coalesce very short segments (less than 4 seconds)
    steps = coalesceShortSteps(steps, 4)
  } else {
    // No segments available - create steps based on transcript content
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 10)
    const wordsPerSecond = 2.5 // Estimate speaking rate
    
    steps = sentences.map((sentence, index) => {
      const wordCount = sentence.trim().split(/\s+/).length
      const estimatedDuration = Math.max(Math.ceil(wordCount / wordsPerSecond), 3) // Minimum 3 seconds
      const start = index === 0 ? 0 : steps[index - 1]?.end || 0
      const end = start + estimatedDuration
      const title = generateStepTitle(sentence, index)
      
      return {
        id: `step-${index + 1}`,
        title,
        text: sentence.trim(),
        start,
        end,
        aliases: [],
        notes: `Auto-generated from transcript (estimated timing)`
      }
    })
    
    // Ensure steps don't exceed video duration
    steps = steps.filter(step => step.start < metadata.duration)
    if (steps.length > 0) {
      steps[steps.length - 1].end = Math.min(steps[steps.length - 1].end, metadata.duration)
    }
  }
  
  // Ensure we have at least one step
  if (steps.length === 0) {
    const title = generateStepTitle(transcript, 0)
    steps = [{
      id: 'step-1',
      title,
      text: transcript.substring(0, 100) + (transcript.length > 100 ? '...' : ''),
      start: 0,
      end: Math.min(metadata.duration, 30),
      aliases: [],
      notes: 'Auto-generated fallback step'
    }]
  }
  
  console.log(`✅ [StepGenerator] ${label}: Created ${steps.length} fallback steps`)
  return {
    title: 'Video Analysis (Fallback)',
    description: 'Steps generated automatically from transcript',
    steps,
    totalDuration: metadata.duration
  }
}

// Helper function to coalesce very short steps
function coalesceShortSteps(steps: any[], minDuration: number): any[] {
  if (steps.length <= 1) return steps
  
  const result = []
  let current = { ...steps[0] }
  
  for (let i = 1; i < steps.length; i++) {
    const next = steps[i]
    const currentDuration = current.end - current.start
    
    if (currentDuration < minDuration) {
      // Merge with next step
      current.end = next.end
      current.text = current.text + ' ' + next.text
      // Keep the better title (prefer non-generic titles)
      if (current.title && !current.title.startsWith('Step ') && next.title && next.title.startsWith('Step ')) {
        // Keep current title if it's more descriptive
      } else if (next.title && !next.title.startsWith('Step ')) {
        current.title = next.title
      }
      current.notes = (current.notes || '') + ' (merged with next step)'
    } else {
      // Keep current step and move to next
      result.push(current)
      current = { ...next }
    }
  }
  
  // Add the last step
  result.push(current)
  return result
}

// Helper function to normalize step times and ensure consistency
function toNumber(v: any, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// Auto-generate title from step content
function generateStepTitle(text: string, index: number): string {
  if (!text || text.trim().length === 0) {
    return `Step ${index + 1}`
  }
  
  // Try to extract a short title from the text
  const cleanText = text.trim()
  const firstSentence = cleanText.split(/[.!?]/)[0].trim()
  
  if (firstSentence.length <= 60) {
    return firstSentence
  }
  
  // If first sentence is too long, try first few words
  const words = cleanText.split(/\s+/).slice(0, 8).join(' ')
  if (words.length <= 60) {
    return words + (words.endsWith('.') ? '' : '...')
  }
  
  // Fallback to step number
  return `Step ${index + 1}`
}

function normalizeSteps(
  ai: { steps: any[]; totalDuration?: number },
  videoDurationSec: number
) {
  const src = Array.isArray(ai.steps) ? ai.steps : [];
  
  // Find max end provided by LLM
  const maxEndRaw = src.reduce((m, s) => {
    const e = toNumber(s.end ?? s.endTime, 0);
    return Math.max(m, e);
  }, 0);

  // If AI thinks the video is much longer than reality, scale all times.
  const basis = ai.totalDuration && ai.totalDuration > 0 ? ai.totalDuration : maxEndRaw;
  const needsScale = basis > videoDurationSec + 1;
  const scale = needsScale && basis > 0 ? (videoDurationSec / basis) : 1;

  console.log(`🔧 [StepGenerator] Time normalization: AI thinks ${basis}s, video is ${videoDurationSec}s, scaling by ${scale.toFixed(3)}`);

  // Build normalized steps
  let steps = src.map((s, i) => {
    const rawStart = toNumber(s.start ?? s.startTime, 0);
    const rawEnd = toNumber(s.end ?? s.endTime, (i < src.length - 1)
      ? toNumber(src[i + 1].start ?? src[i + 1].startTime, rawStart) // next start fallback
      : videoDurationSec);

    // scale, clamp, and round to whole seconds
    let start = Math.max(0, Math.min(videoDurationSec, Math.round(rawStart * scale)));
    let end = Math.max(0, Math.min(videoDurationSec, Math.round(rawEnd * scale)));

    if (end <= start) end = Math.min(videoDurationSec, start + 1);

    // Ensure title is always set
    const title = s.title || s.text || generateStepTitle(s.text || s.description || '', i)

    return {
      id: s.id || `step-${i + 1}`,
      title,
      text: s.text || s.title || s.description || 'Step description',
      aliases: s.aliases || [],
      notes: s.notes || '',
      // canonical fields:
      start,
      end,
      // legacy mirror fields for anything that still reads the old names:
      startTime: start,
      endTime: end,
    };
  });

  // ensure sorted by start
  steps.sort((a, b) => a.start - b.start);

  return steps;
}

// Helper function to map AI response to new field names
function mapStepFields(parsed: any, videoDurationSec: number): VideoAnalysisResult {
  // Normalize the steps to ensure consistent timing
  const normalizedSteps = normalizeSteps(parsed, videoDurationSec);

  return {
    title: parsed.title || 'Video Analysis',
    description: parsed.description || 'AI-generated step-by-step guide',
    steps: normalizedSteps,
    totalDuration: videoDurationSec
  }
}

async function generateWithGemini(
  client: GoogleGenerativeAI,
  transcript: string,
  segments: Array<{ start: number; end: number; text: string }>,
  metadata: { duration: number },
  moduleId?: string
): Promise<VideoAnalysisResult> {
  const label = `Module ${moduleId || 'unknown'}`
  const model = client.getGenerativeModel({ model: geminiModel })

  const prompt = `Analyze this video transcript and create a structured step-by-step guide:

TRANSCRIPT: ${transcript}
VIDEO DURATION: ${metadata.duration} seconds

Create a JSON response with this exact structure:
{
  "title": "Brief, descriptive title",
  "description": "2-3 sentence summary",
  "steps": [
    {
      "id": "step-1",
      "title": "Short, descriptive title for this step",
      "text": "What happens in this step",
      "startTime": 0,
      "endTime": 15,
      "aliases": ["alternative names"],
      "notes": "optional additional info"
    }
  ],
  "totalDuration": ${metadata.duration}
}

Rules:
- Create 5-15 logical steps
- Each step should be 10-60 seconds
- Use clear, actionable language
- Ensure steps cover the entire video
- Make step text concise but descriptive
- Each step MUST have a short, descriptive title (not just "Step 1")

Return ONLY valid JSON.`

  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text()
  
  console.log(`${label}: Gemini raw response:`, text)
  
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }
    
    const parsed = JSON.parse(jsonMatch[0])
    
    // Validate parsed result structure
    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error(`${label}: Invalid or empty steps array returned`)
    }
    
    console.log(`✅ [StepGenerator] ${label}: Gemini analysis successful`)
    return mapStepFields(parsed, metadata.duration)
  } catch (parseError) {
    throw new Error(`${label}: Failed to parse Gemini response: ${parseError}`)
  }
}

async function generateWithOpenAI(
  transcript: string,
  segments: Array<{ start: number; end: number; text: string }>,
  metadata: { duration: number },
  moduleId?: string
): Promise<VideoAnalysisResult> {
  const label = `Module ${moduleId || 'unknown'}`
  console.log(`🤖 [StepGenerator] ${label}: OpenAI config - Model: ${OAI_MODEL}, Temp: ${TEMP}, Max Tokens: ${MAX_OUT}`)
  const prompt = `Analyze this video transcript and create a structured step-by-step guide:

TRANSCRIPT: ${transcript}
VIDEO DURATION: ${metadata.duration} seconds

Create a JSON response with this exact structure:
{
  "title": "Brief, descriptive title",
  "description": "2-3 sentence summary",
  "steps": [
    {
      "id": "step-1",
      "title": "Short, descriptive title for this step",
      "text": "What happens in this step",
      "startTime": 0,
      "endTime": 15,
      "aliases": ["alternative names"],
      "notes": "optional additional info"
    }
  ],
  "totalDuration": ${metadata.duration}
}

Rules:
- Create 5-15 logical steps
- Each step should be 10-60 seconds
- Use clear, actionable language
- Ensure steps cover the entire video
- Make step text concise but descriptive
- Each step MUST have a short, descriptive title (not just "Step 1")

Return ONLY valid JSON.`

  const completion = await openai!.chat.completions.create({
    model: OAI_MODEL,
    temperature: TEMP,
    response_format: { type: 'json_object' },
    max_tokens: MAX_OUT,
    messages: [
      { role: 'system', content: 'Return strict JSON with steps only.' },
      { role: 'user', content: prompt }
    ]
  })

  const response = completion.choices[0]?.message?.content
  if (!response) {
    throw new Error('Empty response from OpenAI')
  }

  console.log(`${label}: OpenAI raw response:`, response)

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }
    
    const parsed = JSON.parse(jsonMatch[0])
    
    // Validate parsed result structure
    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error(`${label}: Invalid or empty steps array returned`)
    }
    
    console.log(`✅ [StepGenerator] ${label}: OpenAI analysis successful`)
    return mapStepFields(parsed, metadata.duration)
  } catch (parseError) {
    throw new Error(`${label}: Failed to parse OpenAI response: ${parseError}`)
  }
}
