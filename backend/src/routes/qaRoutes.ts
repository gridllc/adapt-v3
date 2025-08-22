import express, { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../config/database.js'
import { aiService } from '../services/aiService.js'
import { DatabaseService } from '../services/prismaService.js'
import { UserService } from '../services/userService.js'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { extractStepNumber } from '../utils/parseStepOrdinal.js'

const router = express.Router()

// S3 client for fallback step loading
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-west-1' })
const BUCKET = process.env.AWS_BUCKET_NAME || 'adaptv3-training-videos'

// Helper function to get JSON from S3 (same as in stepsRoutes)
async function getJsonFromS3(key: string): Promise<any> {
  try {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
    const response = await s3Client.send(command)
    const body = await response.Body?.transformToString()
    return body ? JSON.parse(body) : null
  } catch (error) {
    console.warn(`Failed to get JSON from S3: ${key}`, error)
    return null
  }
}

// Helper function to trim verbose responses to first paragraph
function trimToFirstParagraph(s: string, maxChars = 160): string {
  if (!s) return s;
  const firstPara = s.replace(/\r/g, '').split('\n\n')[0];
  return firstPara.length > maxChars ? firstPara.slice(0, maxChars).trimEnd() + '…' : firstPara;
}

/**
 * POST /api/qa/ask
 * Body: { moduleId: string, stepId?: string, question: string }
 * Returns: { success: true, answer: string, sources?: Array<{type:'step'|'transcript', id?:string, startTime?:number, endTime?:number, snippet?:string}> }
 */
router.post('/ask', async (req, res) => {
  try {
    const { moduleId, stepId, question, mode = 'brief' } = req.body || {}
    
    if (!moduleId || !question) {
      return res.status(400).json({ 
        success: false, 
        error: 'moduleId and question are required' 
      })
    }

    console.log(`🤖 AI Chat request for module: ${moduleId}`, { question, stepId })

    // Get module with minimal fields needed
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      select: { 
        id: true, 
        title: true, 
        transcriptText: true,
        status: true 
      },
    })
    
    if (!module) {
      return res.status(404).json({ 
        success: false, 
        error: 'Module not found' 
      })
    }

    if (module.status !== 'READY') {
      return res.status(400).json({ 
        success: false, 
        error: 'Module is not ready for AI chat. Please wait for processing to complete.' 
      })
    }

    // Fast path: Check if this is a simple step lookup question
    const stepNumber = extractStepNumber(question);
    if (stepNumber) {
      console.log(`🚀 Fast path: Step lookup for step ${stepNumber}`);
      
      // Try to get steps from S3 first (fastest)
      try {
        const s3Key = `training/${moduleId}.json`;
        const s3Data = await getJsonFromS3(s3Key);
        
        if (s3Data?.steps && Array.isArray(s3Data.steps) && s3Data.steps.length > 0) {
          const step = s3Data.steps[stepNumber - 1];
          if (step) {
            // "Shut up" mode: one clean line, no preamble
            return res.json({
              success: true,
              answer: `Step ${stepNumber}: ${step.text || "(no text)"}`,
              mode: "step-only",
              stepNumber,
              stepText: step.text
            });
          }
        }
      } catch (s3Error) {
        console.warn(`⚠️ Fast path S3 fallback failed:`, s3Error);
      }
      
      // Fallback: step not found
      return res.json({ 
        success: true, 
        answer: `Step ${stepNumber} not found.`, 
        mode: "step-only",
        stepNumber
      });
    }

    // Get steps with all relevant fields including aliases and notes
    let steps = await prisma.step.findMany({
      where: { moduleId },
      orderBy: [{ order: 'asc' }, { startTime: 'asc' }],
      select: { 
        id: true, 
        text: true, 
        startTime: true, 
        endTime: true, 
        aliases: true, 
        notes: true,
        order: true
      },
    })

    // If database is empty, try to load from S3 and hydrate the database
    if (steps.length === 0) {
      console.log(`🔄 Database empty for module ${moduleId}, checking S3...`)
      
      try {
        const s3Key = `training/${moduleId}.json`
        const s3Data = await getJsonFromS3(s3Key)
        
        if (s3Data?.steps && Array.isArray(s3Data.steps) && s3Data.steps.length > 0) {
          console.log(`📥 Found ${s3Data.steps.length} steps in S3, hydrating database...`)
          
          // Map S3 steps to database format
          const dbSteps = s3Data.steps.map((s: any, i: number) => ({
            moduleId,
            order: i,
            text: String(s.text || ''),
            startTime: Number(s.startTime || s.start || 0),
            endTime: Number(s.endTime || s.end || 1),
            aiConfidence: null,
            aliases: Array.isArray(s.aliases) ? s.aliases.map(String) : [],
            notes: s.notes ? String(s.notes) : null,
          }))

          // Create steps in database
          const createdSteps = await prisma.step.createMany({
            data: dbSteps,
            skipDuplicates: true,
          })

          console.log(`✅ Hydrated database with ${createdSteps.count} steps from S3`)

          // Fetch the newly created steps
          steps = await prisma.step.findMany({
            where: { moduleId },
            orderBy: [{ order: 'asc' }, { startTime: 'asc' }],
            select: {
              id: true,
              order: true,
              text: true,
              startTime: true,
              endTime: true,
              aiConfidence: true,
              aliases: true,
              notes: true,
            },
          })
        }
      } catch (s3Error) {
        console.warn(`⚠️ Failed to load from S3 for module ${moduleId}:`, s3Error)
        // Continue with empty steps array
      }
    }

    // Find focus window if stepId provided
    let focusStep = null
    let focusWindow = undefined
    if (stepId) {
      focusStep = steps.find((s: any) => s.id === stepId)
      if (focusStep) {
        focusWindow = { 
          start: focusStep.startTime ?? 0, 
          end: focusStep.endTime ?? 0 
        }
      }
    }

    // Prepare context with smart transcript trimming
    const transcript = (module.transcriptText || '').slice(0, 8000) // Token limit safety
    
    const context = {
      module: { 
        id: module.id, 
        title: module.title 
      },
      steps: steps.map((s: any) => ({
        id: s.id,
        text: s.text,
        startTime: s.startTime,
        endTime: s.endTime,
        aliases: Array.isArray(s.aliases) ? s.aliases as string[] : [],
        notes: s.notes || '',
        order: s.order
      })),
      transcript,
      focusWindow,
      currentStep: focusStep,
      question: String(question),
    }

    console.log(`📝 Context prepared: ${steps.length} steps, transcript: ${transcript.length} chars, focus: ${!!focusStep}`)

    // Use enhanced Q&A method with better context prioritization and brevity control
    const { answer, sources } = await aiService.buildQaContextAndAsk({
      module: context.module,
      steps: context.steps,
      transcript: context.transcript,
      focusWindow,
      question: context.question,
      mode, // Pass brevity mode to AI service
    })

    // Log the interaction for analytics and future improvements
    try {
      await prisma.question.create({
        data: {
          moduleId: module.id,
          stepId: stepId || null,
          question: String(question),
          answer: String(answer),
          videoTime: focusWindow?.start || null,
        },
      })
    } catch (logError) {
      // Don't fail the request if logging fails
      console.warn('⚠️ Failed to log Q&A interaction:', logError)
    }

    console.log(`✅ AI response generated for module: ${moduleId}`)
    
    // Apply brevity trimming if in brief mode
    let finalAnswer = answer;
    if (mode === 'brief') {
      finalAnswer = trimToFirstParagraph(answer, 160);
    }
    
    return res.json({
      success: true,
      answer: finalAnswer,
      sources,
      moduleId,
      stepId: stepId || null,
      mode,
      context: {
        hasTranscript: !!transcript,
        stepCount: steps.length,
        focusStep: focusStep?.text || null
      }
    })
    
  } catch (error) {
    console.error('❌ AI Chat error:', error)
    
    // Handle specific AI service errors
    if (error instanceof Error && error.message.includes('API key')) {
      return res.status(503).json({ 
        success: false,
        error: 'AI service temporarily unavailable. Please try again later.',
        code: 'AI_SERVICE_UNAVAILABLE'
      })
    }
    
    return res.status(500).json({ 
      success: false,
      error: 'Failed to process AI chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Get all questions for a module
router.get('/:moduleId', async (req, res) => {
  try {
    const { moduleId } = req.params
    const { includeFAQ = 'false' } = req.query
    
    console.log(`📝 Getting questions for module: ${moduleId}`)
    
    const questions = await DatabaseService.getQuestions(
      moduleId, 
      includeFAQ === 'true'
    )
    
    console.log(`✅ Retrieved ${questions.length} questions`)
    
    res.json({
      success: true,
      moduleId,
      questions,
      count: questions.length
    })
  } catch (error) {
    console.error('❌ Error fetching questions:', error)
    res.status(500).json({ 
      error: 'Failed to fetch questions',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Get FAQ for a module
router.get('/:moduleId/faq', async (req, res) => {
  try {
    const { moduleId } = req.params
    
    console.log(`📝 Getting FAQ for module: ${moduleId}`)
    
    const faq = await DatabaseService.getFAQ(moduleId)
    
    console.log(`✅ Retrieved ${faq.length} FAQ items`)
    
    res.json({
      success: true,
      moduleId,
      faq,
      count: faq.length
    })
  } catch (error) {
    console.error('❌ Error fetching FAQ:', error)
    res.status(500).json({ 
      error: 'Failed to fetch FAQ',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Toggle FAQ status (admin only)
router.put('/:questionId/toggle-faq', async (req, res) => {
  try {
    const { questionId } = req.params
    
    // Check if user is authenticated (basic admin check)
    const userId = await UserService.getUserIdFromRequest(req)
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    console.log(`🔄 Toggling FAQ status for question: ${questionId}`)
    
    const updatedQuestion = await DatabaseService.toggleFAQ(questionId)
    
    console.log(`✅ FAQ status updated: ${updatedQuestion.isFAQ}`)
    
    res.json({
      success: true,
      questionId,
      isFAQ: updatedQuestion.isFAQ
    })
  } catch (error) {
    console.error('❌ Error toggling FAQ:', error)
    res.status(500).json({ 
      error: 'Failed to toggle FAQ status',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Get Q&A history for a module
router.get('/:moduleId/history', async (req, res) => {
  try {
    const { moduleId } = req.params
    const { limit = '10' } = req.query
    
    console.log(`📝 Getting Q&A history for module: ${moduleId}`)
    
    const history = await DatabaseService.getQuestionHistory(moduleId, Number(limit))
    
    console.log(`✅ Retrieved ${history.length} Q&A history items`)
    
    res.json({
      success: true,
      moduleId,
      history,
      count: history.length
    })
  } catch (error) {
    console.error('❌ Error fetching Q&A history:', error)
    res.status(500).json({ 
      error: 'Failed to fetch Q&A history',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export { router as qaRoutes } 