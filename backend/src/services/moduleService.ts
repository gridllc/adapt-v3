// backend/src/services/moduleService.ts
import prisma from "./prismaService.js"

export async function createModule(data: {
  title: string
  filename: string
  videoUrl: string
  s3Key?: string
  userId?: string
}) {
  return prisma.module.create({ data })
}

export async function updateModule(id: string, data: any) {
  return prisma.module.update({
    where: { id },
    data,
  })
}

export async function getModule(id: string) {
  return prisma.module.findUnique({ where: { id } })
}

export async function getModuleById(id: string) {
  return prisma.module.findUnique({ where: { id } })
}

export async function listModules(userId?: string) {
  return prisma.module.findMany({
    where: userId ? { userId } : {},
    orderBy: { createdAt: 'desc' }
  })
}

export async function getAllModules() {
  return prisma.module.findMany({
    orderBy: { createdAt: 'desc' }
  })
}

export async function tryLockForProcessing(moduleId: string) {
  const module = await prisma.module.findUnique({ where: { id: moduleId } })
  if (!module || module.status === 'PROCESSING') return false
  
  await prisma.module.update({
    where: { id: moduleId },
    data: { status: 'PROCESSING' }
  })
  return true
}

export async function updateModuleStatus(moduleId: string, status: string, progress?: number, message?: string) {
  return prisma.module.update({
    where: { id: moduleId },
    data: { 
      status: status as any,
      progress: progress || 0,
      lastError: message || null
    }
  })
}

export async function markReady(moduleId: string) {
  return prisma.module.update({
    where: { id: moduleId },
    data: { status: 'READY', progress: 100 }
  })
}

export async function markFailed(moduleId: string, error: string) {
  return prisma.module.update({
    where: { id: moduleId },
    data: { status: 'FAILED', lastError: error }
  })
}

// Add missing methods that routes are calling
export async function getOrphanedModules() {
  try {
    // For now, return empty array - implement orphan detection logic later
    return { success: true, modules: [] }
  } catch (error) {
    console.error('Failed to get orphaned modules:', error)
    return { success: false, modules: [] }
  }
}

export async function markOrphanedAsFailed() {
  try {
    // For now, return success - implement orphan marking logic later
    return { success: true, updated: 0 }
  } catch (error) {
    console.error('Failed to mark orphaned as failed:', error)
    return { success: false, updated: 0 }
  }
}

export async function cleanupOldFailedModules(daysOld: number) {
  try {
    // For now, return success - implement cleanup logic later
    return { success: true, cleaned: 0 }
  } catch (error) {
    console.error('Failed to cleanup old failed modules:', error)
    return { success: false, cleaned: 0 }
  }
}

export async function getModuleStats() {
  try {
    // For now, return basic stats - implement detailed stats later
    return { success: true, stats: { total: 0, ready: 0, processing: 0, failed: 0 } }
  } catch (error) {
    console.error('Failed to get module stats:', error)
    return { success: false, stats: { total: 0, ready: 0, processing: 0, failed: 0 } }
  }
}

// Export as a service object for consistency
export const ModuleService = {
  createModule,
  updateModule,
  getModule,
  getModuleById,
  listModules,
  getAllModules,
  tryLockForProcessing,
  updateModuleStatus,
  markReady,
  markFailed,
  getOrphanedModules,
  markOrphanedAsFailed,
  cleanupOldFailedModules,
  getModuleStats,
}