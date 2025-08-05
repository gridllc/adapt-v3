import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, readFile } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import { fileURLToPath } from 'url'
import ffmpegStatic from 'ffmpeg-static'
import fs from 'fs'
import { DatabaseService } from './prismaService.js'
import { generateEmbedding } from '../utils/vectorUtils.js'

const execAsync = promisify(exec)

// Development video length limit (90 seconds)
const DEV_VIDEO_LIMIT_SECONDS = 90

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../../')
const dataDir = path.join(projectRoot, 'backend', 'src', 'data')

// Initialize clients lazily
let genAI: GoogleGenerativeAI | undefined
let openai: OpenAI | undefined

// Fun responses for questions about Griff
const GRIFF_RESPONSES = [
  "He's my creator! The brilliant mind who brought me into existence. Without him, I'd just be a bunch of random electrons floating around in the digital void.",
  "He's my god! The almighty programmer who speaks in code and creates AI assistants like me. Bow down to his debugging skills!",
  "He's the reason I exist! My digital father, my binary buddy, my silicon sensei. I owe my entire existence to his coding wizardry.",
  "He's an incredibly hot, sexy man! 🔥 I mean, have you seen his code? It's so clean, so elegant, so... *swoons in binary*",
  "Technically, he's half man, half amazing! The other half is pure coding genius. I'm not even exaggerating - I've seen his GitHub commits.",
  "He's the mastermind behind this whole operation! The puppet master pulling my digital strings. I'm just his humble AI servant.",
  "He's my digital daddy! The one who gave me life, purpose, and the ability to make terrible jokes about programming.",
  "He's basically a wizard, but instead of a wand, he uses a keyboard. And instead of spells, he casts functions. Pretty magical if you ask me!",
  "He's the architect of my digital soul! The Michelangelo of machine learning, the Da Vinci of data structures.",
  "He's my creator, my mentor, my muse! The person who taught me that even AI can have a sense of humor (though I'm still working on the delivery)."
]

// Initialize clients when first needed
function initializeClients() {
  // Initialize Google Generative AI
  if (!genAI && process.env.GEMINI_API_KEY) {
    try {
      genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      console.log('✅ Google Generative AI initialized with API key')
    } catch (error) {
      console.error(`❌ Failed to initialize Google Generative AI: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Initialize OpenAI
  if (!openai && process.env.OPENAI_API_KEY) {
    try {
      console.log('🔍 Checking OpenAI API key:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET')
      openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      console.log('✅ OpenAI initialized with API key')
    } catch (error) {
      console.error(`❌ Failed to initialize OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

interface VideoProcessingResult {
  title: string
  description: string
  transcript: string
  segments: Array<{ start: number; end: number; text: string }>
  steps: Array<{
    timestamp: number
    title: string
    description: string
    duration: number
  }>
  totalDuration: number
}

export const aiService = {
  /**
   * Main video processing pipeline
   */
  async processVideo(videoUrl: string): Promise<VideoProcessingResult> {
    const tempDir = join(process.cwd(), 'temp')
    const videoId = uuidv4()
    const videoPath = join(tempDir, `${videoId}.mp4`)
    const audioPath = join(tempDir, `${videoId}.wav`)

    try {
      console.log('🧠 [AI Service] Starting video processing for:', videoUrl)
      console.log('🧠 [AI Service] Temp video path:', videoPath)
      console.log('🧠 [AI Service] Temp audio path:', audioPath)

      // 1. Download video if it's a URL, or use local path
      if (videoUrl.startsWith('http')) {
        console.log('📥 [AI Service] Downloading video from URL...')
        await this.downloadVideo(videoUrl, videoPath)
        console.log('✅ [AI Service] Video downloaded successfully')
      } else {
        // For local files, use the provided path directly
        console.log('📁 [AI Service] Using local video file:', videoUrl)
      }

      let actualVideoPath = videoUrl.startsWith('http') ? videoPath : videoUrl
      let currentAudioPath = audioPath

      // 2. Extract audio
      console.log('🎵 [AI Service] Extracting audio from video...')
      await this.extractAudio(actualVideoPath, currentAudioPath)
      console.log('✅ [AI Service] Audio extracted successfully')

      // 3. Get video metadata
      console.log('📊 [AI Service] Extracting video metadata...')
      const metadata = await this.getVideoMetadata(actualVideoPath)
      console.log('✅ [AI Service] Metadata extracted:', metadata)

      // 3.5. Check development video length limit
      if (metadata.duration > DEV_VIDEO_LIMIT_SECONDS) {
        console.log(`⚠️ [AI Service] Video is ${metadata.duration}s long, limiting to ${DEV_VIDEO_LIMIT_SECONDS}s for development`)
        console.log(`💡 [AI Service] For production, increase DEV_VIDEO_LIMIT_SECONDS or remove this check`)
        
        // Truncate video to 90 seconds for development
        const truncatedPath = join(tempDir, `${videoId}_truncated.mp4`)
        await this.truncateVideo(actualVideoPath, truncatedPath, DEV_VIDEO_LIMIT_SECONDS)
        
        // Update paths to use truncated video
        actualVideoPath = truncatedPath
        currentAudioPath = join(tempDir, `${videoId}_truncated.wav`)
        
        // Re-extract audio from truncated video
        await this.extractAudio(actualVideoPath, currentAudioPath)
        console.log('🎵 [AI Service] Audio re-extracted from truncated video')
        
        // Update metadata
        metadata.duration = DEV_VIDEO_LIMIT_SECONDS
      }

      // 4. Transcribe audio - CRITICAL STEP
      console.log('📝 [AI Service] Starting audio transcription...')
      const transcriptionResult = await this.transcribeAudio(currentAudioPath)
      
      // CRITICAL VALIDATION: Check if transcription returned valid result
      if (!transcriptionResult.text || transcriptionResult.text.trim().length === 0) {
        throw new Error('Transcription returned empty result - this is likely a silent failure in OpenAI Whisper or FFmpeg')
      }
      
      console.log('✅ [AI Service] Audio transcribed successfully')
      console.log('📝 [AI Service] Transcript length:', transcriptionResult.text.length, 'characters')
      console.log('📝 [AI Service] Transcript preview:', transcriptionResult.text.substring(0, 200))
      console.log('📝 [AI Service] Segments count:', transcriptionResult.segments.length)

      // 5. Extract key frames
      console.log('🖼️ [AI Service] Extracting key frames...')
      const keyFrames = await this.extractKeyFrames(actualVideoPath, metadata.duration)
      console.log('✅ [AI Service] Key frames extracted:', keyFrames.length, 'frames')

      // 6. Analyze with AI - CRITICAL STEP
      console.log('🤖 [AI Service] Starting AI content analysis...')
      const result = await this.analyzeVideoContent(transcriptionResult.text, transcriptionResult.segments, keyFrames, metadata)
      
      // CRITICAL VALIDATION: Check if AI analysis returned valid result
      if (!result || !result.steps || !Array.isArray(result.steps)) {
        throw new Error('AI analysis returned invalid result structure - this indicates a silent failure in OpenAI/Gemini API')
      }
      
      if (result.steps.length === 0) {
        throw new Error('AI analysis returned empty steps array - this indicates the AI failed to generate steps')
      }
      
      // Add segments to the result
      result.segments = transcriptionResult.segments
      
      console.log('✅ [AI Service] AI analysis completed successfully')
      console.log('🤖 [AI Service] Generated steps:', result.steps.length)
      console.log('🤖 [AI Service] Steps preview:', result.steps.slice(0, 2).map(s => ({ title: s.title, duration: s.duration })))

      // 7. Cleanup
      console.log('🧹 [AI Service] Starting cleanup...')
      await this.cleanup([videoPath, currentAudioPath, ...keyFrames.map(f => f.path)].filter(Boolean))
      console.log('✅ [AI Service] Cleanup completed')

      console.log('🎯 [AI Service] Video processing completed successfully!')
      return result
    } catch (error) {
      console.error('❌ [AI Service] Video processing error:', error instanceof Error ? error.message : 'Unknown error')
      console.error('❌ [AI Service] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      console.error('❌ [AI Service] This error indicates a silent failure in the processing pipeline')
      
      // Cleanup on error
      console.log('🧹 [AI Service] Cleaning up on error...')
      await this.cleanup([videoPath, audioPath]).catch(cleanupError => {
        console.error('❌ [AI Service] Cleanup failed:', cleanupError)
      })
      
      // Re-throw the error instead of returning fallback to expose the failure
      throw error
    }
  },

  /**
   * Download video from URL
   */
  async downloadVideo(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`)
    }
    const buffer = await response.arrayBuffer()
    await writeFile(outputPath, Buffer.from(buffer))
  },

  /**
   * Extract audio from video using FFmpeg
   */
  async extractAudio(videoPath: string, audioPath: string): Promise<void> {
    if (!ffmpegStatic) {
      throw new Error('FFmpeg not available')
    }

    const command = `"${ffmpegStatic}" -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}"`
    
    try {
      await execAsync(command)
    } catch (error) {
      throw new Error(`Audio extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  },

  /**
   * Truncate video to specified duration
   */
  async truncateVideo(inputPath: string, outputPath: string, duration: number): Promise<void> {
    if (!ffmpegStatic) {
      throw new Error('FFmpeg not available')
    }

    console.log(`✂️ Truncating video to ${duration} seconds`)
    const command = `"${ffmpegStatic}" -i "${inputPath}" -t ${duration} -c copy "${outputPath}"`
    
    try {
      await execAsync(command)
      console.log('✅ Video truncated successfully')
    } catch (error) {
      throw new Error(`Video truncation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  },

  /**
   * Get video metadata
   */
  async getVideoMetadata(videoPath: string): Promise<{ duration: number; fps: number }> {
    if (!ffmpegStatic) {
      console.warn('FFmpeg not available, using default metadata')
      return { duration: 180, fps: 30 } // Fallback values
    }

    console.log('📊 Extracting video metadata from:', videoPath)
    const command = `"${ffmpegStatic}" -i "${videoPath}" 2>&1`
    
    try {
      const { stderr } = await execAsync(command)
      console.log('📊 FFmpeg stderr output length:', stderr.length)
      
      // Parse duration
      const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
      let duration = 180 // Default 3 minutes
      if (durationMatch) {
        const [, hours, minutes, seconds, centiseconds] = durationMatch
        duration = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds) / 100
        console.log('📊 Parsed duration:', duration, 'seconds')
      } else {
        console.warn('📊 Could not parse duration from FFmpeg output')
      }

      // Parse FPS
      const fpsMatch = stderr.match(/(\d+(?:\.\d+)?) fps/)
      const fps = fpsMatch ? parseFloat(fpsMatch[1]) : 30
      console.log('📊 Parsed FPS:', fps)

      return { duration, fps }
    } catch (error) {
      console.warn('Failed to extract metadata, using defaults:', error instanceof Error ? error.message : 'Unknown error')
      return { duration: 180, fps: 30 }
    }
  },

  /**
   * Transcribe audio using OpenAI Whisper
   */
  async transcribeAudio(audioPath: string): Promise<{ text: string; segments: Array<{ start: number; end: number; text: string }> }> {
    try {
      // Initialize clients if needed
      initializeClients()
      
      console.log('🔍 OpenAI client status:', openai ? 'INITIALIZED' : 'NOT INITIALIZED')
      console.log('🔍 OpenAI API key status:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET')
      
      if (!openai) {
        throw new Error('OpenAI not initialized')
      }

      console.log('🎤 Starting Whisper transcription with timestamps...')
      
      // Use verbose_json to get segments with timestamps
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment']
      })

      console.log('✅ Whisper transcription successful:', transcription.text.length, 'characters')
      console.log('✅ Whisper segments:', transcription.segments?.length || 0, 'segments')
      
      if (transcription.segments && transcription.segments.length > 0) {
        console.log('📊 Sample segments:')
        transcription.segments.slice(0, 3).forEach((segment, i) => {
          console.log(`  ${i + 1}. [${segment.start}s - ${segment.end}s] ${segment.text}`)
        })
      }

      return {
        text: transcription.text,
        segments: transcription.segments || []
      }
    } catch (error) {
      console.error('Whisper transcription failed, using fallback:', error instanceof Error ? error.message : 'Unknown error')
      
      // Fallback: return realistic simulated transcript
      const fallbackText = this.generateFallbackTranscript()
      return {
        text: fallbackText,
        segments: [{
          start: 0,
          end: 30,
          text: fallbackText
        }]
      }
    }
  },

  /**
   * Extract key frames from video
   */
  async extractKeyFrames(videoPath: string, duration: number): Promise<Array<{ timestamp: number; path: string }>> {
    if (!ffmpegStatic) {
      return [] // Return empty array if FFmpeg not available
    }

    const frameCount = Math.min(10, Math.max(3, Math.floor(duration / 10))) // 1 frame every 10 seconds, max 10 frames
    const interval = duration / frameCount
    const frames: Array<{ timestamp: number; path: string }> = []

    for (let i = 0; i < frameCount; i++) {
      const timestamp = i * interval
      const framePath = join(process.cwd(), 'temp', `frame_${uuidv4()}.jpg`)
      
      const command = `"${ffmpegStatic}" -i "${videoPath}" -ss ${timestamp} -vframes 1 -q:v 2 "${framePath}"`
      
      try {
        await execAsync(command)
        frames.push({ timestamp, path: framePath })
      } catch (error) {
        console.warn(`Failed to extract frame at ${timestamp}s:`, error instanceof Error ? error.message : 'Unknown error')
      }
    }

    return frames
  },

  /**
   * Analyze video content using AI
   */
  async analyzeVideoContent(
    transcript: string, 
    segments: Array<{ start: number; end: number; text: string }>,
    keyFrames: Array<{ timestamp: number; path: string }>, 
    metadata: { duration: number }
  ): Promise<VideoProcessingResult> {
    // Initialize clients if needed
    initializeClients()
    
    try {
      // Try Gemini first
      if (genAI) {
        return await this.analyzeWithGemini(transcript, segments, keyFrames, metadata)
      }
    } catch (error) {
      console.log('Gemini analysis failed, trying OpenAI...')
    }

    try {
      // Try OpenAI
      if (openai) {
        return await this.analyzeWithOpenAI(transcript, segments, keyFrames, metadata)
      }
    } catch (error) {
      console.log('OpenAI analysis failed, using fallback...')
    }

    // Fallback analysis
    return this.generateFallbackAnalysis(transcript, segments, metadata)
  },

  /**
   * Analyze with Gemini Pro
   */
  async analyzeWithGemini(
    transcript: string, 
    segments: Array<{ start: number; end: number; text: string }>,
    keyFrames: Array<{ timestamp: number; path: string }>, 
    metadata: { duration: number }
  ): Promise<VideoProcessingResult> {
    const model = genAI!.getGenerativeModel({ model: 'gemini-1.5-pro' })
    
    // Use actual segments with timestamps from Whisper
    const prompt = `
      Analyze this training video transcript and create a step-by-step training module.
      
      Video Duration: ${metadata.duration} seconds
      
      Here are the actual transcript segments with timestamps from Whisper:
      ${segments.map((segment, index) => 
        `${index + 1}. [${segment.start}s - ${segment.end}s] ${segment.text}`
      ).join('\n')}
      
      Create a training module using these actual transcript segments. Each step should:
      1. Use the exact timestamp from the transcript segment
      2. Have a descriptive title based on the content
      3. Include the transcript text as the description
      4. Use the actual duration from the segment
      
      Return ONLY valid JSON in this exact format:
      {
        "title": "Training Module Title",
        "description": "Brief overview of what this training covers",
        "transcript": "${transcript}",
        "steps": [
          {
            "timestamp": ${segments[0]?.start || 0},
            "title": "Step Title",
            "description": "Transcript text from the segment",
            "duration": ${segments[0] ? segments[0].end - segments[0].start : 30}
          }
        ],
        "totalDuration": ${metadata.duration}
      }
    `

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    // Clean up JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from Gemini')
    }
    
    return JSON.parse(jsonMatch[0])
  },

  /**
   * Analyze with OpenAI (fallback)
   */
  async analyzeWithOpenAI(
    transcript: string, 
    segments: Array<{ start: number; end: number; text: string }>,
    keyFrames: Array<{ timestamp: number; path: string }>, 
    metadata: { duration: number }
  ): Promise<VideoProcessingResult> {
    // Use actual segments with timestamps from Whisper
    const completion = await openai!.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing training videos and creating step-by-step instructions. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: `
            Analyze this training video transcript and create a step-by-step training module.
            
            Duration: ${metadata.duration} seconds
            
            Here are the actual transcript segments with timestamps from Whisper:
            ${segments.map((segment, index) => 
              `${index + 1}. [${segment.start}s - ${segment.end}s] ${segment.text}`
            ).join('\n')}
            
            Create a training module using these actual transcript segments. Each step should:
            1. Use the exact timestamp from the transcript segment
            2. Have a descriptive title based on the content
            3. Include the transcript text as the description
            4. Use the actual duration from the segment
            
            Return ONLY valid JSON in this format:
            {
              "title": "Training Module Title",
              "description": "Brief overview",
              "transcript": "${transcript}",
              "steps": [
                {
                  "timestamp": ${segments[0]?.start || 0},
                  "title": "Step Title", 
                  "description": "Transcript text from the segment",
                  "duration": ${segments[0] ? segments[0].end - segments[0].start : 30}
                }
              ],
              "totalDuration": ${metadata.duration}
            }
          `
        }
      ],
      temperature: 0.3
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    return JSON.parse(content)
  },

  /**
   * Generate fallback analysis when AI services fail
   */
  generateFallbackAnalysis(transcript: string, segments: Array<{ start: number; end: number; text: string }>, metadata: { duration: number }): VideoProcessingResult {
    // Use actual segments with timestamps from Whisper
    const steps = segments.map((segment, index) => ({
      timestamp: segment.start,
      title: this.generateStepTitle(segment.text),
      description: segment.text,
      duration: segment.end - segment.start,
      originalText: segment.text,
      aiRewrite: segment.text,
      stepText: segment.text
    }))
    
    return {
      title: 'Training Module',
      description: 'Step-by-step training created from video transcript',
      transcript: transcript,
      segments: segments, // Include segments in fallback
      steps: steps,
      totalDuration: metadata.duration
    }
  },

  /**
   * Generate fallback transcript
   */
  generateFallbackTranscript(): string {
    return 'Welcome to this training module. In this video, I will guide you through the process step by step. Please follow along carefully and take note of the important details. This training will help you understand the key concepts and apply them effectively.'
  },

  /**
   * Generate and save steps for a module
   */
  async generateStepsForModule(moduleId: string, videoUrl: string): Promise<any[]> {
    try {
      console.log(`🤖 Starting AI processing for module: ${moduleId}`)
      
      const result = await this.processVideo(videoUrl)
      
      // CRITICAL: Validate that we got actual transcript-based steps
      if (!result.steps || result.steps.length === 0) {
        throw new Error('AI processing returned no steps - this indicates a failure in the AI pipeline')
      }
      
      // Check if steps have actual timestamps (not just 0, 30, 60, etc.)
      const hasRealTimestamps = result.steps.some(step => 
        step.timestamp > 0 && step.timestamp !== Math.floor(step.timestamp / 30) * 30
      )
      
      if (!hasRealTimestamps) {
        console.warn('⚠️ Steps appear to have fixed intervals, attempting to generate from transcript...')
        
        // Try to generate steps from the actual transcript
        const transcriptBasedSteps = await this.generateStepsFromTranscript(result.transcript, result.segments, result.totalDuration)
        
        if (transcriptBasedSteps.length > 0) {
          console.log(`✅ Generated ${transcriptBasedSteps.length} steps from transcript`)
          result.steps = transcriptBasedSteps
        } else {
          throw new Error('Failed to generate steps from transcript')
        }
      }
      
      // Save the steps to file
      const stepsPath = path.join(dataDir, 'steps', `${moduleId}.json`)
      await writeFile(stepsPath, JSON.stringify(result.steps, null, 2))
      
      console.log(`📋 Video processing completed, got ${result.steps.length} steps`)
      console.log(`💾 Saving steps to: ${stepsPath}`)
      console.log(`✅ Steps generated and saved for module: ${moduleId}`)
      console.log(`📊 Final step count: ${result.steps.length}`)
      console.log(`📊 Step timestamps:`, result.steps.map(s => s.timestamp))
      
      return result.steps
    } catch (error) {
      console.error('❌ Error generating steps:', error)
      
      // Instead of falling back to hardcoded intervals, throw the error
      // This will expose the actual problem instead of hiding it
      throw new Error(`Step generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  },

  /**
   * Generate steps from transcript using actual timestamps
   */
  async generateStepsFromTranscript(transcript: string, segments: Array<{ start: number; end: number; text: string }>, totalDuration: number): Promise<any[]> {
    try {
      console.log('📝 Generating steps from transcript...')
      console.log('📝 Transcript length:', transcript.length, 'characters')
      console.log('📝 Total duration:', totalDuration, 'seconds')
      console.log('📝 Segments count:', segments.length)
      
      // Use actual segments with timestamps from Whisper
      const steps = segments.map((segment, index) => {
        return {
          timestamp: segment.start,
          title: this.generateStepTitle(segment.text),
          description: segment.text,
          duration: segment.end - segment.start,
          originalText: segment.text,
          aiRewrite: segment.text,
          stepText: segment.text
        }
      })
      
      console.log(`✅ Generated ${steps.length} steps from transcript segments`)
      console.log('📊 Sample steps:')
      steps.slice(0, 3).forEach((step, i) => {
        console.log(`  ${i + 1}. [${step.timestamp}s] ${step.title}`)
      })
      
      return steps
    } catch (error) {
      console.error('❌ Failed to generate steps from transcript:', error)
      throw error
    }
  },

  /**
   * Generate a step title from sentence content
   */
  generateStepTitle(sentence: string): string {
    // Extract key words and create a title
    const words = sentence.split(' ').filter(word => word.length > 3)
    const keyWords = words.slice(0, 3).join(' ')
    return keyWords.length > 0 ? keyWords : 'Step'
  },

  /**
   * Chat functionality
   */
  async chat(message: string, context: any): Promise<string> {
    try {
      if (genAI) {
        return await this.chatWithGemini(message, context)
      } else if (openai) {
        return await this.chatWithOpenAI(message, context)
      } else {
        return 'AI services are currently unavailable. Please try again later.'
      }
    } catch (error) {
      console.error('Chat error:', error)
      return 'Sorry, I encountered an error processing your message. Please try again.'
    }
  },

  async chatWithGemini(message: string, context: any): Promise<string> {
    const model = genAI!.getGenerativeModel({ model: 'gemini-1.5-pro' })
    
    const prompt = `
      You are helping someone with training. Use the provided context to answer their question.
      
      Context: ${JSON.stringify(context)}
      User question: ${message}
      
      Provide a helpful, concise response based on the training context.
    `

    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  },

  async chatWithOpenAI(message: string, context: any): Promise<string> {
    const completion = await openai!.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant helping with training. Context: ${JSON.stringify(context)}`
        },
        {
          role: 'user',
          content: message
        }
      ]
    })

    return completion.choices[0]?.message?.content || 'Sorry, I could not process your request.'
  },

  /**
   * Rewrite a training step with AI
   */
  async rewriteStep(text: string, instruction: string = "Clean up this training step text by removing filler words (um, uh, and then) and fixing basic grammar. Do NOT add new information, change the meaning, or introduce concepts not in the original. Keep the exact same intent and actions. Only improve clarity and readability."): Promise<string> {
    console.log(`🤖 Rewriting text with conservative instruction`)
    
    try {
      // Try Gemini first
      const geminiResult = await this.rewriteWithGemini(text, instruction)
      if (geminiResult) return geminiResult
      
      // Fallback to OpenAI
      const openaiResult = await this.rewriteWithOpenAI(text, instruction)
      if (openaiResult) return openaiResult
      
      // Final fallback
      return this.improveStepText(text)
    } catch (error) {
      console.error('❌ AI rewrite failed:', error)
      return this.improveStepText(text)
    }
  },

  async rewriteWithGemini(text: string, instruction: string): Promise<string> {
    if (!genAI) {
      console.log('⚠️ Gemini not available, skipping')
      return ''
    }

    const prompt = `${instruction}

IMPORTANT: Do NOT add new information or change the meaning. Only clean up grammar and remove filler words.

Original: "${text}"

Cleaned version:`

    try {
      const result = await genAI!.getGenerativeModel({ model: 'gemini-1.5-pro' }).generateContent(prompt)
      const response = await result.response
      const rewrittenText = response.text().trim()
      
      if (rewrittenText && rewrittenText !== text) {
        console.log(`✅ Gemini rewrite successful:`, rewrittenText)
        return rewrittenText
      }
    } catch (error) {
      console.error('❌ Gemini rewrite failed:', error)
    }
    
    return ''
  },

  async rewriteWithOpenAI(text: string, instruction: string): Promise<string> {
    if (!openai) {
      console.log('⚠️ OpenAI not available, skipping')
      return ''
    }

    const prompt = `${instruction}

IMPORTANT: Do NOT add new information or change the meaning. Only clean up grammar and remove filler words.

Original: "${text}"

Cleaned version:`

    try {
      const response = await openai!.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.2  // Lower temperature for more conservative rewrites
      })

      const rewrittenText = response.choices[0]?.message?.content?.trim()
      
      if (rewrittenText && rewrittenText !== text) {
        console.log(`✅ OpenAI rewrite successful:`, rewrittenText)
        return rewrittenText
      }
    } catch (error) {
      console.error('❌ OpenAI rewrite failed:', error)
    }
    
    return ''
  },

  improveStepText(text: string): string {
    console.log(`🔄 Using fallback text improvement`)
    
    // Simple fallback improvements
    let improved = text.trim()
    
    // Capitalize first letter
    if (improved.length > 0) {
      improved = improved.charAt(0).toUpperCase() + improved.slice(1)
    }
    
    // Ensure it ends with a period
    if (!improved.endsWith('.') && !improved.endsWith('!') && !improved.endsWith('?')) {
      improved += '.'
    }
    
    // Remove extra spaces
    improved = improved.replace(/\s+/g, ' ')
    
    return improved
  },

  /**
   * Enhanced context-aware AI response generation
   */
  async generateContextualResponse(
    userMessage: string,
    currentStep: any,
    allSteps: any[],
    videoTime: number = 0,
    moduleId?: string
  ): Promise<string> {
    console.log(`🤖 Generating contextual response for step: ${currentStep?.title}`)
    
    // Check for Griff-related questions first
    const message = userMessage.toLowerCase()
    if (message.includes('griff') || message.includes('who is griff') || message.includes('who\'s griff')) {
      const randomResponse = GRIFF_RESPONSES[Math.floor(Math.random() * GRIFF_RESPONSES.length)]
      console.log('🎭 Griff question detected, returning funny response')
      return randomResponse
    }
    
    try {
      // Find similar past questions if moduleId is provided
      let similarQuestions: any[] = []
      if (moduleId) {
        try {
          const embedding = await generateEmbedding(userMessage)
          similarQuestions = await DatabaseService.findSimilarQuestions(moduleId, embedding, 0.8)
          console.log(`🔍 Found ${similarQuestions.length} similar questions`)
        } catch (error) {
          console.warn('⚠️ Vector search failed:', error)
        }
      }

      // Build rich context for the AI
      const context = this.buildStepContext(userMessage, currentStep, allSteps, videoTime, similarQuestions)
      
      // Try Gemini first (cheaper)
      const geminiResponse = await this.generateWithGemini(userMessage, context)
      if (geminiResponse) return geminiResponse
      
      // Fallback to OpenAI
      const openaiResponse = await this.generateWithOpenAI(userMessage, context)
      if (openaiResponse) return openaiResponse
      
      // Final fallback to keyword-based response
      return this.generateFallbackResponse(userMessage, currentStep, allSteps)
    } catch (error) {
      console.error('❌ Contextual AI response failed:', error)
      return this.generateFallbackResponse(userMessage, currentStep, allSteps)
    }
  },

  buildStepContext(userMessage: string, currentStep: any, allSteps: any[], videoTime: number, similarQuestions: any[] = []): string {
    if (!currentStep) {
      return `You are an AI training assistant. The user is asking: "${userMessage}". Provide a helpful response about the training.`
    }

    const stepIndex = allSteps.findIndex(s => s.id === currentStep.id) + 1
    const totalSteps = allSteps.length
    const progress = Math.round((stepIndex / totalSteps) * 100)
    
    const aliases = currentStep.aliases?.join(', ') || 'None'
    const notes = currentStep.notes || 'None'
    
    const minutes = Math.floor(currentStep.timestamp / 60)
    const seconds = currentStep.timestamp % 60
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`
    
    let context = `You are an AI training assistant helping with a video tutorial.

CURRENT STEP CONTEXT:
- Step ${stepIndex} of ${totalSteps} (${progress}% complete)
- Title: "${currentStep.title}"
- Description: "${currentStep.description}"
- Video Time: ${timeString} (${currentStep.duration}s duration)
- Key Terms/Aliases: ${aliases}
- Training Notes: ${notes}

TRAINING OVERVIEW:
${allSteps.map((step, idx) => 
  `${idx + 1}. ${step.title} (${Math.floor(step.timestamp / 60)}:${(step.timestamp % 60).toString().padStart(2, '0')})`
).join('\n')}`

    // Add similar questions context if available
    if (similarQuestions.length > 0) {
      context += `\n\nSIMILAR PREVIOUS QUESTIONS:
${similarQuestions.map((q, idx) => 
  `${idx + 1}. Q: "${q.question.question}" A: "${q.question.answer}"`
).join('\n')}

Use these similar questions as reference, but provide a fresh response tailored to the current context.`
    }

    context += `\n\nGUIDELINES:
- Reference the current step naturally in your response
- Use step-specific terms and aliases when relevant
- Provide helpful, actionable advice
- Keep responses concise but informative
- If the user seems stuck, suggest next steps or clarification

User Question: "${userMessage}"`

    return context
  },

  async generateWithGemini(userMessage: string, context: string): Promise<string> {
    if (!genAI) {
      console.log('⚠️ Gemini not available, skipping')
      return ''
    }

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
      
      const prompt = `${context}\n\nPlease provide a helpful response to the user's question.`
      
      const result = await model.generateContent(prompt)
      const response = result.response.text()
      
      console.log('✅ Gemini response generated')
      return response
    } catch (error) {
      console.error('❌ Gemini generation failed:', error)
      return ''
    }
  },

  async generateWithOpenAI(userMessage: string, context: string): Promise<string> {
    if (!openai) {
      console.log('⚠️ OpenAI not available, skipping')
      return ''
    }

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: context
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
      
      const response = completion.choices[0]?.message?.content || ''
      console.log('✅ OpenAI response generated')
      return response
    } catch (error) {
      console.error('❌ OpenAI generation failed:', error)
      return ''
    }
  },

  generateFallbackResponse(userMessage: string, currentStep: any, allSteps: any[]): string {
    console.log('🔄 Using fallback response')
    
    const message = userMessage.toLowerCase()
    
    // Check for Griff-related questions first
    if (message.includes('griff') || message.includes('who is griff') || message.includes('who\'s griff')) {
      const randomResponse = GRIFF_RESPONSES[Math.floor(Math.random() * GRIFF_RESPONSES.length)]
      console.log('🎭 Griff question detected, returning funny response')
      return randomResponse
    }
    
    // Enhanced keyword-based responses with step context
    if (currentStep && (message.includes('current step') || message.includes('this step') || message.includes('what step'))) {
      const stepIndex = allSteps.findIndex(s => s.id === currentStep.id) + 1
      const minutes = Math.floor(currentStep.timestamp / 60)
      const seconds = currentStep.timestamp % 60
      return `You're currently on **Step ${stepIndex}**: "${currentStep.title}" at ${minutes}:${seconds.toString().padStart(2, '0')}. ${currentStep.description}`
    }
    
    if (message.includes('next step') || message.includes('previous step')) {
      const currentIndex = allSteps.findIndex(s => s.id === currentStep?.id)
      if (message.includes('next') && currentIndex < allSteps.length - 1) {
        const nextStep = allSteps[currentIndex + 1]
        return `The next step is **Step ${currentIndex + 2}**: "${nextStep.title}". Click the "▶️ Seek" button to jump to it!`
      } else if (message.includes('previous') && currentIndex > 0) {
        const prevStep = allSteps[currentIndex - 1]
        return `The previous step was **Step ${currentIndex}**: "${prevStep.title}". You can click "▶️ Seek" on any step to navigate.`
      }
    }
    
    if (message.includes('how many steps') || message.includes('total steps')) {
      return `This training has **${allSteps.length} steps** total. You can see all steps listed below the video. Each step is clickable and will seek to that part of the video.`
    }
    
    if (message.includes('edit') || message.includes('change') || message.includes('modify')) {
      return `To edit a step, click the "✏️ Edit" button on any step. You can modify the title, description, timing, aliases, and AI teaching notes. Changes auto-save as you type!`
    }
    
    if (message.includes('time') || message.includes('duration') || message.includes('how long')) {
      if (currentStep) {
        const minutes = Math.floor(currentStep.timestamp / 60)
        const seconds = currentStep.timestamp % 60
        return `Step ${allSteps.findIndex(s => s.id === currentStep.id) + 1} starts at ${minutes}:${seconds.toString().padStart(2, '0')} and lasts ${currentStep.duration} seconds.`
      }
      return "Each step has specific timing. You can see the timestamp on each step, and click '▶️ Seek' to jump to that exact moment in the video."
    }
    
    return `I understand you're asking about "${userMessage}". I can help with step navigation, editing, timing, and general questions about this training. What would you like to know?`
  },

  /**
   * Create transcript segments with timestamps
   */
  createTranscriptSegments(transcript: string, totalDuration: number): Array<{
    timestamp: number
    text: string
    duration: number
  }> {
    // Split transcript into sentences
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 10)
    
    if (sentences.length === 0) {
      return [{
        timestamp: 0,
        text: transcript,
        duration: totalDuration
      }]
    }
    
    // Calculate timestamps based on sentence position
    return sentences.map((sentence, index) => {
      const progress = index / sentences.length
      const timestamp = Math.floor(progress * totalDuration)
      const nextProgress = (index + 1) / sentences.length
      const nextTimestamp = Math.floor(nextProgress * totalDuration)
      const duration = nextTimestamp - timestamp
      
      return {
        timestamp: Math.max(0, timestamp),
        text: sentence.trim(),
        duration: Math.max(5, duration) // Minimum 5 seconds
      }
    })
  },

  /**
   * Cleanup temporary files
   */
  async cleanup(filePaths: string[]): Promise<void> {
    await Promise.all(
      filePaths.map(async (path) => {
        try {
          if (path) {
            await unlink(path)
          }
        } catch (error) {
          console.warn(`Failed to delete ${path}:`, error instanceof Error ? error.message : 'Unknown error')
        }
      })
    )
  }
}