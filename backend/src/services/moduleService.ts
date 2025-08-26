import { prisma } from '../config/database.js'
import { Prisma } from '@prisma/client'

export class ModuleService {
  /**
   * Get all modules with their basic info for dashboard
   * @returns Promise<{ success: boolean; modules?: any[]; error?: string }>
   */
  static async getAllModules(): Promise<{ success: boolean; modules?: any[]; error?: string }> {
    try {
      console.log('🔍 [ModuleService] Fetching all modules...')
      
      // Simplified query to prevent hanging
      const modules = await prisma.module.findMany({
        select: {
          id: true,
          title: true,
          filename: true,
          status: true,
          progress: true,
          createdAt: true,
          updatedAt: true,
          userId: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      console.log(`✅ [ModuleService] Found ${modules.length} modules`)

      return {
        success: true,
        modules: modules.map((module: any) => ({
          ...module,
          stepCount: 0, // Simplified for now
          feedbackCount: 0 // Simplified for now
        }))
      }
    } catch (error) {
      console.error('❌ Error fetching modules:', error)
      return {
        success: false,
        error: 'Failed to fetch modules'
      }
    }
  }

  /**
   * Get orphaned modules (ready status but no steps)
   * @returns Promise<{ success: boolean; orphanedModules?: any[]; count?: number; error?: string }>
   */
  static async getOrphanedModules(): Promise<{ success: boolean; orphanedModules?: any[]; count?: number; error?: string }> {
    try {
      const orphanedModules = await prisma.module.findMany({
        where: {
          status: 'READY',
          steps: {
            none: {}
          }
        },
        select: {
          id: true,
          title: true,
          filename: true,
          videoUrl: true,
          status: true,
          progress: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
          user: {
            select: {
              email: true,
              clerkId: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return {
        success: true,
        orphanedModules,
        count: orphanedModules.length
      }
    } catch (error) {
      console.error('❌ Error fetching orphaned modules:', error)
      return {
        success: false,
        error: 'Failed to fetch orphaned modules'
      }
    }
  }

  /**
   * Mark orphaned modules as failed
   */
  static async markOrphanedAsFailed() {
    try {
      const result = await prisma.module.updateMany({
        where: {
          status: 'READY',
          steps: {
            none: {}
          }
        },
        data: {
          status: 'FAILED',
          progress: 0
        }
      })

      console.log(`✅ Marked ${result.count} orphaned modules as failed`)

      return {
        success: true,
        updatedCount: result.count,
        message: `Marked ${result.count} orphaned modules as failed`
      }
    } catch (error) {
      console.error('❌ Error marking orphaned modules as failed:', error)
      return {
        success: false,
        error: 'Failed to mark orphaned modules as failed'
      }
    }
  }

  /**
   * Clean up old failed modules (older than 7 days)
   */
  static async cleanupOldFailedModules(daysOld: number = 7) {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)

      const result = await prisma.module.deleteMany({
        where: {
          status: 'FAILED',
          createdAt: {
            lt: cutoffDate
          }
        }
      })

      console.log(`🗑️ Cleaned up ${result.count} old failed modules`)

      return {
        success: true,
        deletedCount: result.count,
        message: `Cleaned up ${result.count} old failed modules`
      }
    } catch (error) {
      console.error('❌ Error cleaning up old failed modules:', error)
      return {
        success: false,
        error: 'Failed to clean up old failed modules'
      }
    }
  }

  /**
   * Get module statistics for dashboard
   * @returns Promise<{ success: boolean; stats?: any; error?: string }>
   */
  static async getModuleStats(): Promise<{ success: boolean; stats?: any; error?: string }> {
    try {
      const [
        totalModules,
        processingModules,
        completedModules,
        failedModules,
        orphanedModules
      ] = await Promise.all([
        prisma.module.count(),
        prisma.module.count({ where: { status: 'PROCESSING' } }),
        prisma.module.count({ where: { status: 'READY' } }),
        prisma.module.count({ where: { status: 'FAILED' } }),
        prisma.module.count({
          where: {
            status: 'READY',
            steps: { none: {} }
          }
        })
      ])

      return {
        success: true,
        stats: {
          total: totalModules,
          processing: processingModules,
          completed: completedModules,
          failed: failedModules,
          orphaned: orphanedModules
        }
      }
    } catch (error) {
      console.error('❌ Error fetching module stats:', error)
      return {
        success: false,
        error: 'Failed to fetch module statistics'
      }
    }
  }

  /**
   * Update module status and handle orphaned detection
   * @param moduleId - The ID of the module to update
   * @param status - New status value
   * @param progress - Progress percentage (0-100)
   * @param message - Optional status message
   * @returns Promise<{ success: boolean; error?: string }>
   */
  static async updateModuleStatus(
    moduleId: string, 
    status: string, 
    progress: number, 
    message?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // First, verify the module exists to prevent foreign key constraint violations
      const module = await prisma.module.findUnique({
        where: { id: moduleId },
        select: { id: true }
      })

      if (!module) {
        console.warn(`⚠️ [ModuleService] Cannot update status for non-existent module: ${moduleId}`)
        return {
          success: false,
          error: `Module ${moduleId} not found`
        }
      }

      // Update module status directly with Prisma
      await prisma.module.update({
        where: { id: moduleId },
        data: { 
          status: status as any, 
          progress, 
          lastError: null,
          updatedAt: new Date()
        }
      })

      // If status is READY, check if it has steps
      if (status === 'READY') {
        await this.checkAndMarkOrphaned(moduleId)
      }

      return { success: true }
    } catch (error) {
      console.error('❌ Error updating module status:', error)
      return {
        success: false,
        error: 'Failed to update module status'
      }
    }
  }

  /**
   * Check if a module is orphaned (ready status but no steps) and mark it accordingly
   * @param moduleId - The ID of the module to check
   * @returns Promise<void>
   */
  private static async checkAndMarkOrphaned(moduleId: string): Promise<void> {
    try {
      const module = await prisma.module.findUnique({
        where: { id: moduleId },
        include: { 
          steps: {
            select: {
              id: true
            }
          } 
        }
      })

      if (module && module.steps.length === 0) {
        // Mark as FAILED if no steps (orphaned is not a valid enum value)
        await prisma.module.update({
          where: { id: moduleId },
          data: { status: 'FAILED' as any, progress: 0 }
        })

        console.log(`⚠️ Module ${moduleId} marked as orphaned (no steps)`)
      }
    } catch (error) {
      console.error(`❌ Error checking orphaned status for module ${moduleId}:`, error)
    }
  }

  /**
   * Atomic lock for processing - only one worker can acquire PROCESSING status
   * @param id - Module ID to lock
   * @returns Promise<boolean> - true if lock acquired, false if already processing
   */
  static async tryLockForProcessing(id: string): Promise<boolean> {
    try {
      console.log(`🔒 [ModuleService] Attempting to acquire processing lock for module: ${id}`)
      
      // Only flip to PROCESSING if not already PROCESSING
      const res = await prisma.module.updateMany({
        where: {
          id,
          status: { in: ['UPLOADED', 'READY', 'FAILED'] as any[] }, // allowed starting points
        },
        data: { 
          status: 'PROCESSING' as any, 
          progress: 0, 
          lastError: null, 
          updatedAt: new Date() 
        },
      })
      
      const gotLock = res.count === 1
      console.log(`🔒 [ModuleService] Processing lock ${gotLock ? 'ACQUIRED' : 'NOT ACQUIRED'} for module: ${id}`)
      
      return gotLock
    } catch (error) {
      console.error(`❌ [ModuleService] Error acquiring processing lock for module ${id}:`, error)
      return false
    }
  }

  /**
   * Mark module as ready (processing complete)
   * @param id - Module ID to mark ready
   * @returns Promise<void>
   */
  static async markReady(id: string): Promise<void> {
    try {
      console.log(`✅ [ModuleService] Marking module ${id} as READY`)
      await prisma.module.update({
        where: { id },
        data: { 
          status: 'READY', 
          progress: 100, 
          updatedAt: new Date() 
        }
      })
    } catch (error) {
      console.error(`❌ [ModuleService] Error marking module ${id} as ready:`, error)
      throw error
    }
  }

  /**
   * Mark module as failed (processing failed)
   * @param id - Module ID to mark failed
   * @param reason - Reason for failure
   * @returns Promise<void>
   */
  static async markFailed(id: string, reason: string): Promise<void> {
    try {
      console.log(`❌ [ModuleService] Marking module ${id} as FAILED: ${reason}`)
      await prisma.module.update({
        where: { id },
        data: { 
          status: 'FAILED', 
          progress: 0, 
          lastError: reason, 
          updatedAt: new Date() 
        }
      })
    } catch (error) {
      console.error(`❌ [ModuleService] Error marking module ${id} as failed:`, error)
      throw error
    }
  }

  /**
   * Save AI-generated steps to a module
   * @param moduleId - The ID of the module to save steps to
   * @param steps - Array of step data to save (from AI service)
   * @returns Promise<{ success: boolean; stepCount?: number; createdSteps?: any[]; message?: string; error?: string }>
   */
  static async saveStepsToModule(
    moduleId: string, 
    steps: Array<{
      id: string
      text?: string
      title?: string
      description?: string
      startTime?: number
      endTime?: number
      timestamp?: number
      duration?: number
      aliases?: string[]
      notes?: string
    }>
  ): Promise<{ 
    success: boolean; 
    stepCount?: number; 
    createdSteps?: any[]; 
    message?: string; 
    error?: string 
  }> {
    try {
      console.log(`💾 [ModuleService] Saving ${steps.length} steps to module ${moduleId}`)
      
      // First, delete any existing steps for this module
      await prisma.step.deleteMany({
        where: { moduleId: moduleId }
      })
      
      // Create new steps with proper data mapping
      // Note: Prisma Step model doesn't have aliases/notes fields, so we'll store
      // the AI-generated ID in the description or create a metadata field later
      const stepData = steps.map((step, index) => ({
        moduleId: moduleId,
        order: index + 1,
        text: step.text || step.title || step.description || '',
        startTime: step.startTime || step.timestamp || 0,
        endTime: step.endTime || (step.startTime || step.timestamp || 0) + (step.duration || 15),
        // TODO: Consider extending the Prisma schema for aiGeneratedId, aliases, notes, metadata
      }))
      
      const createdSteps = await prisma.step.createMany({
        data: stepData
      })
      
      // Fetch the created steps for return data
      const savedSteps = await prisma.step.findMany({
        where: { moduleId: moduleId },
        orderBy: { order: 'asc' }
      })
      
      console.log(`✅ [ModuleService] Successfully saved ${createdSteps.count} steps to module ${moduleId}`)
      
      return {
        success: true,
        stepCount: createdSteps.count,
        createdSteps: savedSteps,
        message: `Saved ${steps.length} steps to module`
      }
    } catch (error) {
      console.error(`❌ [ModuleService] Failed to save steps to module ${moduleId}:`, error)
      return {
        success: false,
        error: 'Failed to save steps to module: ' + (error instanceof Error ? error.message : 'Unknown error')
      }
    }
  }

  /**
   * Get a module by its ID with optional relations
   * @param id - The module ID to fetch
   * @param includeRelations - Whether to include related data (steps, feedbacks, etc.)
   * @returns Promise<{ success: boolean; module?: any; error?: string }>
   */
  static async getModuleById(
    id: string, 
    includeRelations: boolean = false
  ): Promise<{ success: boolean; module?: any; error?: string }> {
    try {
      const module = await prisma.module.findUnique({
        where: { id },
        include: includeRelations ? {
          steps: true,
          feedbacks: true,
          user: {
            select: {
              email: true,
              clerkId: true
            }
          }
        } : undefined
      })

      if (!module) {
        return {
          success: false,
          error: 'Module not found'
        }
      }

      return {
        success: true,
        module
      }
    } catch (error) {
      console.error(`❌ Error fetching module ${id}:`, error)
      return {
        success: false,
        error: 'Failed to fetch module'
      }
    }
  }

  /**
   * Get steps for a specific module
   * @param moduleId - The ID of the module to get steps for
   * @returns Promise<{ success: boolean; steps?: any[]; error?: string }>
   */
  static async getModuleSteps(moduleId: string): Promise<{ success: boolean; steps?: any[]; error?: string }> {
    try {
      const steps = await prisma.step.findMany({
        where: { moduleId: moduleId },
        orderBy: { order: 'asc' }
      })

      return {
        success: true,
        steps
      }
    } catch (error) {
      console.error(`❌ Error fetching steps for module ${moduleId}:`, error)
      return {
        success: false,
        error: 'Failed to fetch module steps'
      }
    }
  }

  /**
   * Delete a module and all its related data
   * @param id - The module ID to delete
   * @returns Promise<{ success: boolean; message?: string; error?: string }>
   */
  static async deleteModule(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      // Check if module exists
      const module = await prisma.module.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              steps: true,
              feedbacks: true,
              questions: true
            }
          }
        }
      })

      if (!module) {
        return {
          success: false,
          error: 'Module not found'
        }
      }

      // Delete the module (cascade will handle related records)
      await prisma.module.delete({
        where: { id }
      })

      console.log(`🗑️ [ModuleService] Deleted module ${id} with ${module._count.steps} steps, ${module._count.feedbacks} feedbacks, ${module._count.questions} questions`)

      return {
        success: true,
        message: `Module deleted successfully`
      }
    } catch (error) {
      console.error(`❌ Error deleting module ${id}:`, error)
      return {
        success: false,
        error: 'Failed to delete module'
      }
    }
  }

  /**
   * Schema Extension Recommendation:
   * 
   * To better support AI-generated steps, consider extending the Prisma Step model:
   * 
   * ```prisma
   * model Step {
   *   // ... existing fields ...
   *   aiGeneratedId String?  // Preserve AI-generated ID for reference
   *   aliases      String[]  // Step variations/aliases
   *   notes        String?   // Additional context from AI
   *   metadata     Json?     // Flexible metadata storage
   * }
   * ```
   * 
   * This would allow:
   * - Better traceability between AI generation and database storage
   * - Support for step variations and aliases
   * - Flexible metadata storage for future AI enhancements
   */
} 