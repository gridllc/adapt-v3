import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

export const aiService = {
  async processVideo(videoUrl: string) {
    try {
      // Try Gemini first
      const geminiResult = await this.processWithGemini(videoUrl)
      return geminiResult
    } catch (error) {
      console.log('Gemini failed, trying OpenAI...')
      // Fallback to OpenAI
      const openaiResult = await this.processWithOpenAI(videoUrl)
      return openaiResult
    }
  },

  async processWithGemini(videoUrl: string) {
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

  async chat(message: string, context: any) {
    try {
      const geminiResult = await this.chatWithGemini(message, context)
      return geminiResult
    } catch (error) {
      console.log('Gemini chat failed, trying OpenAI...')
      const openaiResult = await this.chatWithOpenAI(message, context)
      return openaiResult
    }
  },

  async chatWithGemini(message: string, context: any) {
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