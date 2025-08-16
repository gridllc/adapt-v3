#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

async function migrateSchema() {
  console.log('🔄 Starting schema migration...')
  
  try {
    // Step 1: Generate Prisma client
    console.log('📦 Generating Prisma client...')
    execSync('npx prisma generate', { stdio: 'inherit' })
    
    // Step 2: Create migration
    console.log('📝 Creating migration...')
    execSync('npx prisma migrate dev --name normalize-relations', { stdio: 'inherit' })
    
    // Step 3: Clean up orphaned data
    console.log('🧹 Cleaning up orphaned data...')
    await cleanupOrphanedData()
    
    // Step 4: Update existing data
    console.log('🔄 Updating existing data...')
    await updateExistingData()
    
    console.log('✅ Schema migration completed successfully!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

async function cleanupOrphanedData() {
  console.log('  - Cleaning orphaned questions...')
  
  // Find questions that reference non-existent modules
  const orphanedQuestions = await prisma.question.findMany({
    where: {
      module: null
    }
  })
  
  if (orphanedQuestions.length > 0) {
    console.log(`    Found ${orphanedQuestions.length} orphaned questions`)
    await prisma.question.deleteMany({
      where: {
        module: null
      }
    })
  }
  
  // Find questions that reference non-existent steps
  const questionsWithInvalidSteps = await prisma.question.findMany({
    where: {
      stepId: {
        not: null
      },
      step: null
    }
  })
  
  if (questionsWithInvalidSteps.length > 0) {
    console.log(`    Found ${questionsWithInvalidSteps.length} questions with invalid step references`)
    await prisma.question.updateMany({
      where: {
        stepId: {
          not: null
        },
        step: null
      },
      data: {
        stepId: null
      }
    })
  }
  
  // Clean up orphaned steps
  const orphanedSteps = await prisma.step.findMany({
    where: {
      module: null
    }
  })
  
  if (orphanedSteps.length > 0) {
    console.log(`    Found ${orphanedSteps.length} orphaned steps`)
    await prisma.step.deleteMany({
      where: {
        module: null
      }
    })
  }
  
  // Clean up orphaned feedback
  const orphanedFeedback = await prisma.feedback.findMany({
    where: {
      module: null
    }
  })
  
  if (orphanedFeedback.length > 0) {
    console.log(`    Found ${orphanedFeedback.length} orphaned feedback entries`)
    await prisma.feedback.deleteMany({
      where: {
        module: null
      }
    })
  }
  
  // Clean up orphaned status entries
  const orphanedStatuses = await prisma.moduleStatus.findMany({
    where: {
      module: null
    }
  })
  
  if (orphanedStatuses.length > 0) {
    console.log(`    Found ${orphanedStatuses.length} orphaned status entries`)
    await prisma.moduleStatus.deleteMany({
      where: {
        module: null
      }
    })
  }
  
  // Clean up orphaned AI interactions
  const orphanedAIInteractions = await prisma.aIInteraction.findMany({
    where: {
      module: null
    }
  })
  
  if (orphanedAIInteractions.length > 0) {
    console.log(`    Found ${orphanedAIInteractions.length} orphaned AI interactions`)
    await prisma.aIInteraction.deleteMany({
      where: {
        module: null
      }
    })
  }
  
  // Clean up orphaned training sessions
  const orphanedTrainingSessions = await prisma.trainingSession.findMany({
    where: {
      module: null
    }
  })
  
  if (orphanedTrainingSessions.length > 0) {
    console.log(`    Found ${orphanedTrainingSessions.length} orphaned training sessions`)
    await prisma.trainingSession.deleteMany({
      where: {
        module: null
      }
    })
  }
}

async function updateExistingData() {
  console.log('  - Updating existing data...')
  
  // Update steps to have proper start/end times
  const stepsToUpdate = await prisma.step.findMany({
    where: {
      startTime: null,
      endTime: null
    }
  })
  
  if (stepsToUpdate.length > 0) {
    console.log(`    Updating ${stepsToUpdate.length} steps with timestamp data...`)
    
    for (const step of stepsToUpdate) {
      // Convert old timestamp to start/end times
      const startTime = step.timestamp || 0
      const endTime = startTime + (step.duration || 0)
      
      await prisma.step.update({
        where: { id: step.id },
        data: {
          startTime,
          endTime
        }
      })
    }
  }
  
  // Update modules with proper status values
  const modulesToUpdate = await prisma.module.findMany({
    where: {
      status: 'completed'
    }
  })
  
  if (modulesToUpdate.length > 0) {
    console.log(`    Updating ${modulesToUpdate.length} modules with 'completed' status to 'ready'...`)
    
    await prisma.module.updateMany({
      where: {
        status: 'completed'
      },
      data: {
        status: 'ready'
      }
    })
  }
  
  // Ensure all modules have proper user references
  const modulesWithoutUser = await prisma.module.findMany({
    where: {
      userId: null
    }
  })
  
  if (modulesWithoutUser.length > 0) {
    console.log(`    Found ${modulesWithoutUser.length} modules without user references (this is normal for anonymous uploads)`)
  }
}

// Run the migration
migrateSchema().catch(console.error) 
