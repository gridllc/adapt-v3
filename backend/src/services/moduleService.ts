import { prisma } from '../config/database.js'
import { ModuleStatus } from '@prisma/client'

export const ModuleService = {
  // ===== Core Getters =====
  async get(id: string) {
    return prisma.module.findUnique({
      where: { id },
      include: { steps: true },
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
    return prisma.module.create({
      data: {
        title: filename,
        filename,
        videoUrl: `https://placeholder.com/${filename}`, // Required field
        userId: userId || null,
        status: ModuleStatus.UPLOADED,
      },
    })
  },

  // ===== Status + Lifecycle =====
  async updateModuleStatus(id: string, status: ModuleStatus, progress?: number) {
    return prisma.module.update({
      where: { id },
      data: { status, progress },
    })
  },

  async markUploaded(id: string, s3Key: string) {
    return prisma.module.update({
      where: { id },
      data: { status: ModuleStatus.UPLOADED, s3Key },
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
    return prisma.module.update({
      where: { id },
      data: { status: ModuleStatus.READY, progress: 100 },
    })
  },

  async updateTranscriptJobId(id: string, transcriptJobId: string) {
    return prisma.module.update({
      where: { id },
      data: { transcriptJobId },
    })
  },

  async applyTranscript(id: string, transcriptText: string) {
    return prisma.module.update({
      where: { id },
      data: { transcriptText },
    })
  },

  // ===== Aliases / Backwards Compatibility =====
  async getModuleById(id: string) {
    return this.get(id)
  },
}


