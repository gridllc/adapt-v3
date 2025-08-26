import { prisma } from '../config/database.js'
import { embed } from './embeddings.js'

export async function logQA(params: { moduleId: string; question: string; answer: string; stepId?: string; videoTime?: number; isFAQ?: boolean }) {
  try {
    const [embedding] = await Promise.all([embed(params.question)])
    
    // Create the question first
    const question = await prisma.question.create({
      data: {
        moduleId: params.moduleId,
        question: params.question,
        answer: params.answer,
        stepId: params.stepId,
        videoTime: params.videoTime,
        isFAQ: params.isFAQ ?? false,
      },
    })

    // Then create the vector embedding
    await prisma.questionVector.create({
      data: {
        questionId: question.id,
        embedding: embedding,
        modelName: 'text-embedding-3-small'
      }
    })

    console.log(`✅ [QA Logger] Stored Q&A with embedding for module: ${params.moduleId}`)
    return question
  } catch (error) {
    console.error('❌ [QA Logger] Failed to store Q&A:', error)
    throw error
  }
} 