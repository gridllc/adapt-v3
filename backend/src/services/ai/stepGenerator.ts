import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { Step, VideoAnalysisResult } from './types.js'

// Initialize clients lazily
let genAI: GoogleGenerativeAI | undefined
let openai: OpenAI | undefined

// Configurable model names
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4'
const geminiModel = process.env.GEMINI_MODEL || 'gemini-pro'

function initializeClients() {
  // Initialize Google Generative AI
  if (!genAI && process.env.GEMINI_API_KEY) {
    try {
      genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      console.log('✅ [StepGenerator] Google Generative AI initialized')
    } catch (error) {
      console.error(`❌ [StepGenerator] Failed to initialize Google Generative AI: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Initialize OpenAI
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
  
  const label = `Module ${moduleId || 'unknown'}`
  console.log(`🤖 [StepGenerator] ${label}: Starting AI analysis...`)
  console.log(`📝 [StepGenerator] ${label}: Transcript length: ${transcript.length} characters`)
  console.log(`📊 [StepGenerator] ${label}: Video duration: ${metadata.duration}s`)

  try {
    // Try Gemini first, fallback to OpenAI
    if (genAI) {
      try {
        return await generateWithGemini(transcript, segments, metadata, moduleId)
      } catch (geminiError) {
        console.log(`⚠️ [StepGenerator] ${label}: Gemini failed, falling back to OpenAI:`, geminiError)
      }
    }

    if (openai) {
      return await generateWithOpenAI(transcript, segments, metadata, moduleId)
    }

    throw new Error('No AI service available (GEMINI_API_KEY or OPENAI_API_KEY required)')
  } catch (error) {
    console.error(`❌ [StepGenerator] ${label}: AI analysis failed:`, error)
    throw new Error(`${label}: AI analysis failed: ` + (error instanceof Error ? error.message : 'Unknown error'))
  }
}

// Helper function to map AI response to new field names
function mapStepFields(parsed: any): VideoAnalysisResult {
  // Map old field names to new ones for backward compatibility
  const mappedSteps = parsed.steps.map((step: any) => ({
    id: step.id || `step-${Math.random().toString(36).substr(2, 9)}`,
    text: step.text || step.title || step.description || 'Step description',
    startTime: step.startTime || step.timestamp || 0,
    endTime: step.endTime || (step.startTime || step.timestamp || 0) + (step.duration || 15),
    aliases: step.aliases || [],
    notes: step.notes || ''
  }))

  return {
    title: parsed.title || 'Video Analysis',
    description: parsed.description || 'AI-generated step-by-step guide',
    steps: mappedSteps,
    totalDuration: parsed.totalDuration || 0
  }
}

async function generateWithGemini(
  transcript: string,
  segments: Array<{ start: number; end: number; text: string }>,
  metadata: { duration: number },
  moduleId?: string
): Promise<VideoAnalysisResult> {
  const label = `Module ${moduleId || 'unknown'}`
  const model = genAI!.getGenerativeModel({ model: geminiModel })

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
- Make step text concise but descriptive`

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
    return mapStepFields(parsed)
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

Return ONLY valid JSON.`

  const completion = await openai!.chat.completions.create({
    model: openaiModel,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
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
    return mapStepFields(parsed)
  } catch (parseError) {
    throw new Error(`${label}: Failed to parse OpenAI response: ${parseError}`)
  }
}
