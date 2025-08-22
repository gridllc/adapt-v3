import { Router } from 'express'
import { ok, fail } from '../utils/http.js'
import { prisma } from '../config/database.js'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { mustBeAuthed, currentUserId, authorizeModule } from '../middleware/auth.js'

export const stepsRoutes = Router()

// S3 client for getting JSON data
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-west-1' })
const BUCKET = process.env.AWS_BUCKET_NAME || 'adaptv3-training-videos'

// Helper function to get JSON from S3
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

/**
 * GET /api/steps/:moduleId
 * Returns ordered steps for a module with all fields including aliases and notes
 * Falls back to S3 if database is empty and hydrates the database
 */
stepsRoutes.get('/:moduleId', mustBeAuthed, async (req, res) => {
  try {
    const { moduleId } = req.params
    const userId = currentUserId(req)

    if (!moduleId) {
      return res.status(400).json({ success: false, error: 'Missing moduleId' })
    }

    // Verify the module belongs to the authenticated user
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      select: { userId: true }
    })
    
    if (!module) {
      return res.status(404).json({ success: false, error: 'Module not found' })
    }
    
    if (module.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You can only access your own modules' })
    }

    console.log(`📋 Loading steps for module: ${moduleId}`)

    // First try to get steps from database
    let steps = await prisma.step.findMany({
      where: { moduleId },
      orderBy: [{ order: 'asc' }, { startTime: 'asc' }],
      select: {
        id: true,
        order: true,
        text: true,
        startTime: true,
        endTime: true,
        aiConfidence: true,
        aliases: true,  // String[] field containing string[]
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // If database is empty, try to load from S3 and hydrate the database
    if (steps.length === 0) {
      console.log(`🔄 Database empty for module ${moduleId}, checking S3...`)
      
      try {
        // Use user-specific S3 path
        const s3Key = `users/${userId}/modules/${moduleId}/derived/steps.json`
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
              createdAt: true,
              updatedAt: true,
            },
          })
        }
      } catch (s3Error) {
        console.warn(`⚠️ Failed to load from S3 for module ${moduleId}:`, s3Error)
        // Continue with empty steps array
      }
    }

    console.log(`✅ Found ${steps.length} steps for module: ${moduleId}`)

    return res.json({ success: true, steps })
  } catch (err: any) {
    console.error('❌ GET /steps error:', err)
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to load steps',
      details: err?.message 
    })
  }
})

/**
 * POST /api/steps/:moduleId
 * Upserts an array of steps with transaction safety and validation
 * Body: { steps: Array<{id?, order?, text, startTime, endTime, aliases?, notes?}> }
 */
stepsRoutes.post('/:moduleId', async (req, res) => {
  try {
    const { moduleId } = req.params
    const { steps } = req.body

    // Input validation
    if (!moduleId) {
      return res.status(400).json({ success: false, error: 'Missing moduleId' })
    }
    
    if (!Array.isArray(steps)) {
      return res.status(400).json({ success: false, error: 'Steps must be an array' })
    }

    console.log(`💾 Saving ${steps.length} steps for module: ${moduleId}`)

    // Verify module exists
    const module = await prisma.module.findUnique({ 
      where: { id: moduleId },
      select: { id: true, title: true }
    })
    
    if (!module) {
      return res.status(404).json({ success: false, error: 'Module not found' })
    }

    // Sanitize and validate step data
    const sanitizedSteps = steps.map((step, index) => {
      // Data validation
      if (!step.text || typeof step.text !== 'string') {
        throw new Error(`Step ${index + 1}: text is required`)
      }
      
      const startTime = Number(step.startTime ?? 0)
      const endTime = Number(step.endTime ?? 0)
      
      if (!Number.isFinite(startTime) || startTime < 0) {
        throw new Error(`Step ${index + 1}: invalid startTime`)
      }
      
      if (!Number.isFinite(endTime) || endTime <= startTime) {
        throw new Error(`Step ${index + 1}: endTime must be greater than startTime`)
      }

      return {
        id: step.id || undefined,
        order: Number.isFinite(step.order) ? Number(step.order) : index,
        text: step.text.trim(),
        startTime,
        endTime,
        aiConfidence: typeof step.aiConfidence === 'number' ? step.aiConfidence : null,
        aliases: Array.isArray(step.aliases) 
          ? step.aliases.map((a: any) => String(a).trim()).filter(Boolean)
          : [],
        notes: step.notes ? String(step.notes).trim() : null,
      }
    })

    // Execute transaction with better error handling
    const result = await prisma.$transaction(async (tx: any) => {
      console.log(`🔄 Transaction started: updating steps for module ${moduleId}`)

      // Get existing step IDs to track what needs to be deleted
      const existingSteps = await tx.step.findMany({
        where: { moduleId },
        select: { id: true }
      })

      const incomingIds = sanitizedSteps
        .map((s: any) => s.id)
        .filter(Boolean) as string[]

      // Delete steps that are no longer in the incoming list
      const stepsToDelete = existingSteps.filter(
        (existing: any) => !incomingIds.includes(existing.id)
      )

      if (stepsToDelete.length > 0) {
        await tx.step.deleteMany({
          where: {
            id: { in: stepsToDelete.map((s: any) => s.id) }
          }
        })
        console.log(`🗑️ Deleted ${stepsToDelete.length} removed steps`)
      }

      // Upsert all steps
      const upsertedSteps = []
      for (const [index, step] of sanitizedSteps.entries()) {
        let upsertedStep
        
        if (step.id) {
          // Update existing step
          upsertedStep = await tx.step.update({
            where: { id: step.id },
            data: {
              order: step.order,
              text: step.text,
              startTime: step.startTime,
              endTime: step.endTime,
              aiConfidence: step.aiConfidence,
              aliases: step.aliases,
              notes: step.notes,
            },
            select: {
              id: true,
              order: true,
              text: true,
              startTime: true,
              endTime: true,
              aiConfidence: true,
              aliases: true,
              notes: true,
            }
          })
        } else {
          // Create new step
          upsertedStep = await tx.step.create({
            data: {
              moduleId,
              order: step.order,
              text: step.text,
              startTime: step.startTime,
              endTime: step.endTime,
              aiConfidence: step.aiConfidence,
              aliases: step.aliases,
              notes: step.notes,
            },
            select: {
              id: true,
              order: true,
              text: true,
              startTime: true,
              endTime: true,
              aiConfidence: true,
              aliases: true,
              notes: true,
            }
          })
        }
        
        upsertedSteps.push(upsertedStep)
      }

      // Normalize order to be 0-indexed and sequential
      const finalSteps = await tx.step.findMany({
        where: { moduleId },
        orderBy: [{ order: 'asc' }, { startTime: 'asc' }],
        select: { id: true }
      })

      await Promise.all(
        finalSteps.map((step: any, index: number) =>
          tx.step.update({
            where: { id: step.id },
            data: { order: index }
          })
        )
      )

      console.log(`✅ Transaction completed: ${upsertedSteps.length} steps processed`)

      return { count: upsertedSteps.length, steps: upsertedSteps }
    })

    console.log(`✅ Successfully saved ${result.count} steps for module: ${moduleId}`)

    // Sync the updated steps back to S3 to keep both data sources in sync
    try {
      // Get the module to access userId for S3 path
      const moduleWithUser = await prisma.module.findUnique({
        where: { id: moduleId },
        select: { userId: true }
      })
      
      if (!moduleWithUser?.userId) {
        console.warn('⚠️ Cannot sync to S3: module missing userId')
        return
      }
      
      // Use user-specific S3 path
      const s3Key = `users/${moduleWithUser.userId}/modules/${moduleId}/derived/steps.json`
      const currentS3Data = await getJsonFromS3(s3Key) || {}
      
      // Get the final steps with all fields for S3 sync
      const finalStepsForS3 = await prisma.step.findMany({
        where: { moduleId },
        orderBy: [{ order: 'asc' }, { startTime: 'asc' }],
        select: {
          id: true,
          order: true,
          text: true,
          startTime: true,
          endTime: true,
          aliases: true,
          notes: true,
        }
      })

      // Update S3 with the new steps data
      const updatedS3Data = {
        ...currentS3Data,
        steps: finalStepsForS3,
        meta: {
          ...currentS3Data.meta,
          updatedAt: new Date().toISOString(),
          source: 'database-sync'
        }
      }

      // Use the storageService to save back to S3
      const { storageService } = await import('../services/storageService.js')
      await storageService.putObject(s3Key, JSON.stringify(updatedS3Data), 'application/json')
      
      console.log(`🔄 Synced ${finalStepsForS3.length} steps back to S3: ${s3Key}`)
    } catch (s3SyncError) {
      console.warn('⚠️ Failed to sync steps back to S3:', s3SyncError)
      // Don't fail the request if S3 sync fails
    }

    return res.json({ 
      success: true, 
      count: result.count,
      moduleId,
      message: `Saved ${result.count} steps successfully`
    })

  } catch (err: any) {
    console.error('❌ POST /steps error:', err)
    
    // Provide more specific error messages
    if (err.message.includes('Step') && err.message.includes(':')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation error',
        details: err.message 
      })
    }
    
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to save steps',
      details: err?.message || 'Unknown server error'
    })
  }
})
