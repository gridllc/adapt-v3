import { prisma } from '../config/database.js'
import { ModuleStatus } from '@prisma/client'

export const ModuleService = {
  // ===== Core Getters =====
  async get(id: string) {
    return prisma.module.findUnique({
      where: { id },
      // Fix: Don't include steps from database since they're stored in S3
      // include: { steps: true },
    })
  },

  async getSteps(moduleId: string) {
    return prisma.step.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
    })
  },

  // ===== Create =====
  async createForFilename(filename: string, userId?: string) {
    const module = await prisma.module.create({
      data: {
        title: filename,
        filename,
        videoUrl: '', // Empty placeholder - we'll generate presigned URL on read
        userId: userId || null,
        status: ModuleStatus.UPLOADED,
        stepsKey: `training/placeholder.json`, // Will be updated with actual module ID
      },
    })
    
    // Update stepsKey with actual module ID
    await prisma.module.update({
      where: { id: module.id },
      data: { stepsKey: `training/${module.id}.json` }
    })
    
    return module
  },

  // ===== Status + Lifecycle =====
  async updateModuleStatus(id: string, status: ModuleStatus, progress?: number) {
    return prisma.module.update({
      where: { id },
      data: { status, progress },
    })
  },

  async markUploaded(id: string, s3Key: string, userId?: string) {
    return prisma.module.update({
      where: { id },
      data: { 
        status: ModuleStatus.UPLOADED, 
        s3Key,
        ...(userId && { userId })
      },
    })
  },

  async markProcessing(id: string) {
    return prisma.module.update({
      where: { id },
      data: { status: ModuleStatus.PROCESSING },
    })
  },

  async markError(id: string, error: string) {
    return prisma.module.update({
      where: { id },
      data: { status: ModuleStatus.FAILED, lastError: error },
    })
  },

  async markReady(id: string) {
    // First get the current module to check if it has s3Key
    const module = await this.get(id)
    if (!module) {
      throw new Error(`Module ${id} not found`)
    }
    
    console.log(`🔍 [markReady] Module ${id}: s3Key=${module.s3Key}`)
    
    // Only mark as READY - don't store videoUrl (we'll generate it on-demand)
    return prisma.module.update({
      where: { id },
      data: { 
        status: ModuleStatus.READY, 
        progress: 100
        // DO NOT set videoUrl here - we'll generate presigned URL on read
      },
    })
  },

  async updateTranscriptJobId(id: string, transcriptJobId: string) {
    return prisma.module.update({
      where: { id },
      data: { transcriptJobId },
    })
  },

  async updateStepsKey(id: string, stepsKey: string) {
    return prisma.module.update({
      where: { id },
      data: { stepsKey },
    })
  },

  async applyTranscript(id: string, transcriptText: string) {
    return prisma.module.update({
      where: { id },
      data: { transcriptText },
    })
  },

  // ===== Video URL Management =====
  async refreshVideoUrl(id: string) {
    const module = await this.get(id)
    if (!module) {
      throw new Error(`Module ${id} not found`)
    }
    
    if (module.status !== ModuleStatus.READY) {
      throw new Error(`Module ${id} is not READY (status: ${module.status})`)
    }
    
    if (!module.s3Key) {
      throw new Error(`Module ${id} has no s3Key`)
    }
    
    try {
      const { storageService } = await import('./storageService.js')
      const videoUrl = await storageService.getSignedPlaybackUrl(module.s3Key, 60 * 60 * 24) // 24 hours
      
      await prisma.module.update({
        where: { id },
        data: { videoUrl }
      })
      
      return videoUrl
    } catch (error: any) {
      console.error(`❌ Failed to refresh videoUrl for module ${id}:`, error)
      throw error
    }
  },

  // ===== Aliases / Backwards Compatibility =====
  async getModuleById(id: string) {
    return this.get(id)
  },

  async getAllModules() {
    return prisma.module.findMany({
      orderBy: { createdAt: 'desc' },
      include: { steps: true }
    })
  },

  async getAllModulesPaginated(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit
    
    const [modules, total] = await Promise.all([
      prisma.module.findMany({
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { steps: true }
      }),
      prisma.module.count()
    ])
    
    return {
      modules,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    }
  },
}


