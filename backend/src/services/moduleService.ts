import { prisma } from '../config/database.js'
import { DatabaseService } from './prismaService.js'

export class ModuleService {
  /**
   * Get all modules with their basic info for dashboard
   */
  static async getAllModules() {
    try {
      const modules = await prisma.module.findMany({
        select: {
          id: true,
          title: true,
          filename: true,
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
          },
          _count: {
            select: {
              steps: true,
              feedbacks: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return {
        success: true,
        modules: modules.map(module => ({
          ...module,
          stepCount: module._count.steps,
          feedbackCount: module._count.feedbacks
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
   */
  static async getOrphanedModules() {
    try {
      const orphanedModules = await prisma.module.findMany({
        where: {
          status: 'ready',
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
          status: 'ready',
          steps: {
            none: {}
          }
        },
        data: {
          status: 'failed',
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
          status: 'failed',
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
   */
  static async getModuleStats() {
    try {
      const [
        totalModules,
        processingModules,
        completedModules,
        failedModules,
        orphanedModules
      ] = await Promise.all([
        prisma.module.count(),
        prisma.module.count({ where: { status: 'processing' } }),
        prisma.module.count({ where: { status: 'ready' } }),
        prisma.module.count({ where: { status: 'failed' } }),
        prisma.module.count({
          where: {
            status: 'ready',
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
   */
  static async updateModuleStatus(moduleId: string, status: string, progress: number, message?: string) {
    try {
      // Update module status
      await DatabaseService.updateModuleStatus(moduleId, status, progress, message)

      // If status is 'ready', check if it has steps
      if (status === 'ready') {
        const module = await prisma.module.findUnique({
          where: { id: moduleId },
          include: { steps: true }
        })

        if (module && module.steps.length === 0) {
          // Mark as orphaned if no steps
          await prisma.module.update({
            where: { id: moduleId },
            data: { status: 'orphaned', progress: 0 }
          })

          console.log(`⚠️ Module ${moduleId} marked as orphaned (no steps)`)
        }
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
} 