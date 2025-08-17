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
}