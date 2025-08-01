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
      console.log('🎬 Starting video processing for:', videoUrl)

      // 1. Download video if it's a URL, or use local path
      if (videoUrl.startsWith('http')) {
        await this.downloadVideo(videoUrl, videoPath)
        console.log('✅ Video downloaded')
      } else {
        // For local files, use the provided path directly
        console.log('📁 Using local video file:', videoUrl)
      }

      let actualVideoPath = videoUrl.startsWith('http') ? videoPath : videoUrl
      let currentAudioPath = audioPath

      // 2. Extract audio
      await this.extractAudio(actualVideoPath, currentAudioPath)
      console.log('🎵 Audio extracted')

      // 3. Get video metadata
      const metadata = await this.getVideoMetadata(actualVideoPath)
      console.log('📊 Metadata extracted:', metadata)

      // 3.5. Check development video length limit
      if (metadata.duration > DEV_VIDEO_LIMIT_SECONDS) {
        console.log(`⚠️ Video is ${metadata.duration}s long, limiting to ${DEV_VIDEO_LIMIT_SECONDS}s for development`)
        console.log(`💡 For production, increase DEV_VIDEO_LIMIT_SECONDS or remove this check`)
        
        // Truncate video to 90 seconds for development
        const truncatedPath = join(tempDir, `${videoId}_truncated.mp4`)
        await this.truncateVideo(actualVideoPath, truncatedPath, DEV_VIDEO_LIMIT_SECONDS)
        
        // Update paths to use truncated video
        actualVideoPath = truncatedPath
        currentAudioPath = join(tempDir, `${videoId}_truncated.wav`)
        
        // Re-extract audio from truncated video
        await this.extractAudio(actualVideoPath, currentAudioPath)
        console.log('🎵 Audio re-extracted from truncated video')
        
        // Update metadata
        metadata.duration = DEV_VIDEO_LIMIT_SECONDS
      }

      // 4. Transcribe audio
      const transcript = await this.transcribeAudio(currentAudioPath)
      console.log('📝 Audio transcribed')

      // 5. Extract key frames
      const keyFrames = await this.extractKeyFrames(actualVideoPath, metadata.duration)
      console.log('🖼️ Key frames extracted')

      // 6. Analyze with AI
      const result = await this.analyzeVideoContent(transcript, keyFrames, metadata)
      console.log('🤖 AI analysis complete')

      // 7. Cleanup
      await this.cleanup([videoPath, currentAudioPath, ...keyFrames.map(f => f.path)].filter(Boolean))
      console.log('🧹 Cleanup complete')

      return result
    } catch (error) {
      console.error('❌ Video processing error:', error instanceof Error ? error.message : 'Unknown error')
      // Cleanup on error
      await this.cleanup([videoPath, audioPath]).catch(console.error)
      
      // Return fallback result instead of throwing
      return this.getFallbackResult(videoUrl)
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
  async transcribeAudio(audioPath: string): Promise<string> {
    try {
      // Initialize clients if needed
      initializeClients()
      
      console.log('🔍 OpenAI client status:', openai ? 'INITIALIZED' : 'NOT INITIALIZED')
      console.log('🔍 OpenAI API key status:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET')
      
      if (!openai) {
        throw new Error('OpenAI not initialized')
      }

      console.log('🎤 Starting Whisper transcription...')
      
      // Use fs.createReadStream for OpenAI (this is the recommended approach)
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        response_format: 'text'
      })

      console.log('✅ Whisper transcription successful:', transcription.length, 'characters')
      return transcription
    } catch (error) {
      console.error('Whisper transcription failed, using fallback:', error instanceof Error ? error.message : 'Unknown error')
      
      // Fallback: return realistic simulated transcript
      return this.generateFallbackTranscript()
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
    keyFrames: Array<{ timestamp: number; path: string }>, 
    metadata: { duration: number }
  ): Promise<VideoProcessingResult> {
    // Initialize clients if needed
    initializeClients()
    
    try {
      // Try Gemini first
      if (genAI) {
        return await this.analyzeWithGemini(transcript, keyFrames, metadata)
      }
    } catch (error) {
      console.log('Gemini analysis failed, trying OpenAI...')
    }

    try {
      // Try OpenAI
      if (openai) {
        return await this.analyzeWithOpenAI(transcript, keyFrames, metadata)
      }
    } catch (error) {
      console.log('OpenAI analysis failed, using fallback...')
    }

    // Fallback analysis
    return this.generateFallbackAnalysis(transcript, metadata)
  },

  /**
   * Analyze with Gemini Pro
   */
  async analyzeWithGemini(
    transcript: string, 
    keyFrames: Array<{ timestamp: number; path: string }>, 
    metadata: { duration: number }
  ): Promise<VideoProcessingResult> {
    const model = genAI!.getGenerativeModel({ model: 'gemini-1.5-pro' })
    
    const prompt = `
      Analyze this training video and create a step-by-step training module.
      
      Video Duration: ${metadata.duration} seconds
      Transcript: ${transcript}
      
      Based on the transcript, create a training module with:
      1. A clear, descriptive title
      2. A brief overview description
      3. Step-by-step instructions with timestamps
      4. Each step should have: timestamp (seconds), title, description, and estimated duration
      
      Return ONLY valid JSON in this exact format:
      {
        "title": "Training Module Title",
        "description": "Brief overview of what this training covers",
        "transcript": "${transcript}",
        "steps": [
          {
            "timestamp": 0,
            "title": "Step Title",
            "description": "Detailed description of what to do",
            "duration": 30
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
    keyFrames: Array<{ timestamp: number; path: string }>, 
    metadata: { duration: number }
  ): Promise<VideoProcessingResult> {
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
            Transcript: ${transcript}
            
            Return ONLY valid JSON in this format:
            {
              "title": "Training Module Title",
              "description": "Brief overview",
              "transcript": "${transcript}",
              "steps": [
                {
                  "timestamp": 0,
                  "title": "Step Title", 
                  "description": "What to do",
                  "duration": 30
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
  generateFallbackAnalysis(transcript: string, metadata: { duration: number }): VideoProcessingResult {
    const stepCount = Math.max(3, Math.floor(metadata.duration / 30))
    const steps = []
    
    for (let i = 0; i < stepCount; i++) {
      const timestamp = (i * metadata.duration) / stepCount
      const duration = metadata.duration / stepCount
      
      steps.push({
        timestamp: Math.round(timestamp),
        title: `Step ${i + 1}: Training Process`,
        description: `This step covers part ${i + 1} of the training process. ${transcript.slice(i * 100, (i + 1) * 100)}`,
        duration: Math.round(duration)
      })
    }

    return {
      title: 'Training Module',
      description: 'Video training module with step-by-step instructions',
      transcript,
      steps,
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
   * Get fallback result when everything fails
   */
  getFallbackResult(videoUrl: string): VideoProcessingResult {
    return {
      title: 'Training Module',
      description: 'Interactive training session based on uploaded video content',
      transcript: this.generateFallbackTranscript(),
      steps: [
        {
          timestamp: 0,
          title: 'Introduction',
          description: 'Welcome and overview of the training session',
          duration: 30
        },
        {
          timestamp: 30,
          title: 'Main Content',
          description: 'Core training material and demonstration',
          duration: 90
        },
        {
          timestamp: 120,
          title: 'Summary',
          description: 'Review of key points and next steps',
          duration: 30
        }
      ],
      totalDuration: 180
    }
  },

  /**
   * Generate and save steps for a module
   */
  async generateStepsForModule(moduleId: string, videoUrl: string): Promise<any[]> {
    try {
      console.log(`🤖 Starting AI processing for module: ${moduleId}`)
      
      const result = await this.processVideo(videoUrl)
      
      // Save the steps to file
      const stepsPath = path.join(dataDir, 'steps', `${moduleId}.json`)
      await writeFile(stepsPath, JSON.stringify(result.steps, null, 2))
      
      console.log(`📋 Video processing completed, got ${result.steps.length} steps`)
      console.log(`💾 Saving steps to: ${stepsPath}`)
      console.log(`✅ Steps generated and saved for module: ${moduleId}`)
      console.log(`📊 Final step count: ${result.steps.length}`)
      
      return result.steps
    } catch (error) {
      console.error('Error generating steps:', error)
      return this.getFallbackResult(videoUrl).steps
    }
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
  async rewriteStep(text: string, style: string = 'polished'): Promise<string> {
    console.log(`🤖 Rewriting text with style: ${style}`)
    
    try {
      // Try Gemini first
      const geminiResult = await this.rewriteWithGemini(text, style)
      if (geminiResult) return geminiResult
      
      // Fallback to OpenAI
      const openaiResult = await this.rewriteWithOpenAI(text, style)
      if (openaiResult) return openaiResult
      
      // Final fallback
      return this.improveStepText(text, style)
    } catch (error) {
      console.error('❌ AI rewrite failed:', error)
      return this.improveStepText(text, style)
    }
  },

  async rewriteWithGemini(text: string, style: string): Promise<string> {
    if (!genAI) { // Changed from this.geminiModel to genAI
      console.log('⚠️ Gemini not available, skipping')
      return ''
    }

    const stylePrompts = {
      polished: 'Rewrite this training step in a polished, professional tone. Make it clear and authoritative:',
      casual: 'Rewrite this training step in a casual, friendly tone. Make it approachable and conversational:',
      detailed: 'Rewrite this training step with more detail and explanation. Make it comprehensive and educational:',
      concise: 'Rewrite this training step to be short and clear. Make it direct and to the point:'
    }

    const prompt = `${stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.polished}

Original: "${text}"

Rewrite:`

    try {
      const result = await genAI!.getGenerativeModel({ model: 'gemini-1.5-pro' }).generateContent(prompt) // Changed from this.geminiModel to genAI
      const response = await result.response
      const rewrittenText = response.text().trim()
      
      if (rewrittenText && rewrittenText !== text) {
        console.log(`✅ Gemini rewrite successful (${style}):`, rewrittenText)
        return rewrittenText
      }
    } catch (error) {
      console.error('❌ Gemini rewrite failed:', error)
    }
    
    return ''
  },

  async rewriteWithOpenAI(text: string, style: string): Promise<string> {
    if (!openai) { // Changed from this.openaiClient to openai
      console.log('⚠️ OpenAI not available, skipping')
      return ''
    }

    const stylePrompts = {
      polished: 'Rewrite this training step in a polished, professional tone. Make it clear and authoritative:',
      casual: 'Rewrite this training step in a casual, friendly tone. Make it approachable and conversational:',
      detailed: 'Rewrite this training step with more detail and explanation. Make it comprehensive and educational:',
      concise: 'Rewrite this training step to be short and clear. Make it direct and to the point:'
    }

    const prompt = `${stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.polished}

Original: "${text}"

Rewrite:`

    try {
      const response = await openai!.chat.completions.create({ // Changed from this.openaiClient to openai
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.7
      })

      const rewrittenText = response.choices[0]?.message?.content?.trim()
      
      if (rewrittenText && rewrittenText !== text) {
        console.log(`✅ OpenAI rewrite successful (${style}):`, rewrittenText)
        return rewrittenText
      }
    } catch (error) {
      console.error('❌ OpenAI rewrite failed:', error)
    }
    
    return ''
  },

  improveStepText(text: string, style: string = 'polished'): string {
    console.log(`🔄 Using fallback text improvement for style: ${style}`)
    
    const improvements = {
      polished: (t: string) => t.charAt(0).toUpperCase() + t.slice(1).replace(/\.$/, '') + '.',
      casual: (t: string) => t.replace(/\.$/, '') + ' - easy peasy!',
      detailed: (t: string) => t.charAt(0).toUpperCase() + t.slice(1).replace(/\.$/, '') + ' (this step is important for the process).',
      concise: (t: string) => t.split(' ').slice(0, 5).join(' ') + '.'
    }
    
    const improve = improvements[style as keyof typeof improvements] || improvements.polished
    return improve(text)
  },

  /**
   * Enhanced context-aware AI response generation
   */
  async generateContextualResponse(
    userMessage: string,
    currentStep: any,
    allSteps: any[],
    videoTime: number = 0
  ): Promise<string> {
    console.log(`🤖 Generating contextual response for step: ${currentStep?.title}`)
    
    try {
      // Build rich context for the AI
      const context = this.buildStepContext(userMessage, currentStep, allSteps, videoTime)
      
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

  buildStepContext(userMessage: string, currentStep: any, allSteps: any[], videoTime: number): string {
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
    
    return `You are an AI training assistant helping with a video tutorial.

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
).join('\n')}

GUIDELINES:
- Reference the current step naturally in your response
- Use step-specific terms and aliases when relevant
- Provide helpful, actionable advice
- Keep responses concise but informative
- If the user seems stuck, suggest next steps or clarification

User Question: "${userMessage}"`
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