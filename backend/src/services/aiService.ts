import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../../')
const dataDir = path.join(projectRoot, 'backend', 'src', 'data')

// Initialize clients only if API keys are available
const genAI = process.env.GEMINI_API_KEY 
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

export const aiService = {
  async processVideo(videoUrl: string) {
    try {
      // Try Gemini first
      if (genAI) {
        const geminiResult = await this.processWithGemini(videoUrl)
        return geminiResult
      }
    } catch (error) {
      console.log('Gemini failed, trying OpenAI...')
    }
    
    // Fallback to OpenAI
    if (openai) {
      const openaiResult = await this.processWithOpenAI(videoUrl)
      return openaiResult
    }
    
    // If no AI services available, return mock data
    return {
      title: 'Sample Training Video',
      description: 'A sample training video for demonstration',
      steps: [
        {
          timestamp: 0,
          title: 'Introduction',
          description: 'Welcome to the training',
          duration: 30,
        },
        {
          timestamp: 30,
          title: 'Getting Started',
          description: 'Basic setup and preparation',
          duration: 45,
        },
        {
          timestamp: 75,
          title: 'Main Process',
          description: 'Core training content and procedures',
          duration: 60,
        },
        {
          timestamp: 135,
          title: 'Conclusion',
          description: 'Summary and next steps',
          duration: 30,
        },
      ],
      totalDuration: 165,
    }
  },

  async processWithGemini(videoUrl: string) {
    if (!genAI) throw new Error('Gemini API key not configured')
    
    const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' })
    
    const prompt = `
      Analyze this training video and extract step-by-step instructions.
      Return a JSON object with:
      - title: A descriptive title
      - description: Brief overview
      - steps: Array of objects with timestamp, title, description, and duration
      - totalDuration: Video duration in seconds
    `

    const result = await model.generateContent([prompt, videoUrl])
    const response = await result.response
    const text = response.text()
    
    return JSON.parse(text)
  },

  async processWithOpenAI(videoUrl: string) {
    if (!openai) throw new Error('OpenAI API key not configured')
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this training video and extract step-by-step instructions. Return JSON with title, description, steps array, and totalDuration.',
            },
            {
              type: 'image_url',
              image_url: { url: videoUrl },
            },
          ],
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    return content ? JSON.parse(content) : null
  },

  async generateStepsForModule(moduleId: string, videoUrl: string) {
    try {
      // Process video to get steps
      const videoData = await this.processVideo(videoUrl)
      
      // Save steps to file
      const stepsDir = path.join(dataDir, 'steps')
      const stepsPath = path.join(stepsDir, `${moduleId}.json`)
      
      await fs.promises.mkdir(stepsDir, { recursive: true })
      await fs.promises.writeFile(stepsPath, JSON.stringify(videoData.steps, null, 2))
      
      console.log(`✅ Steps generated and saved for module: ${moduleId}`)
      return videoData.steps
    } catch (error) {
      console.error('Error generating steps:', error)
      // Return default steps if generation fails
      return [
        {
          timestamp: 0,
          title: 'Introduction',
          description: 'Welcome to the training',
          duration: 30,
        },
        {
          timestamp: 30,
          title: 'Getting Started',
          description: 'Basic setup and preparation',
          duration: 45,
        },
        {
          timestamp: 75,
          title: 'Main Process',
          description: 'Core training content and procedures',
          duration: 60,
        },
        {
          timestamp: 135,
          title: 'Conclusion',
          description: 'Summary and next steps',
          duration: 30,
        },
      ]
    }
  },

  async chat(message: string, context: any) {
    try {
      if (genAI) {
        const geminiResult = await this.chatWithGemini(message, context)
        return geminiResult
      }
    } catch (error) {
      console.log('Gemini chat failed, trying OpenAI...')
    }
    
    if (openai) {
      const openaiResult = await this.chatWithOpenAI(message, context)
      return openaiResult
    }
    
    return 'AI services are not configured. Please set up API keys for Gemini or OpenAI.'
  },

  async chatWithGemini(message: string, context: any) {
    if (!genAI) throw new Error('Gemini API key not configured')
    
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
    
    const prompt = `
      Context: ${JSON.stringify(context)}
      User question: ${message}
      
      Answer based on the training context provided.
    `

    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  },

  async chatWithOpenAI(message: string, context: any) {
    if (!openai) throw new Error('OpenAI API key not configured')
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant helping with training. Context: ${JSON.stringify(context)}`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
    })

    return completion.choices[0]?.message?.content || 'Sorry, I could not process your request.'
  },
}

export async function askGemini(question: string, context: string): Promise<string> {
  if (!genAI) throw new Error('Gemini API key not configured')
  
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
  const result = await model.generateContent([context, question])
  const response = await result.response
  return response.text()
}

export async function askOpenAI(question: string, context: string): Promise<string> {
  if (!openai) throw new Error('OpenAI API key not configured')
  
  const result = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: context },
      { role: 'user', content: question },
    ],
  })
  return result.choices[0].message.content || ''
} 