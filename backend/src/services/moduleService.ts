import prisma from '../services/prismaService.js'

export const ModuleService = {
  async createForFilename(filename: string) {
    try {
      return await prisma.module.create({ 
        data: { 
          title: filename, 
          filename, 
          status: 'UPLOADED',
          videoUrl: `https://placeholder.com/${filename}` // Required field
        } 
      })
    } catch (e: any) {
      throw new Error(`createForFilename failed: ${e.message}`)
    }
  },
  async get(id: string) {
    return prisma.module.findUnique({ where: { id } })
  },
  async getSteps(moduleId: string) {
    return prisma.step.findMany({ where: { moduleId }, orderBy: { order: 'asc' } })
  },
  async saveSteps(moduleId: string, steps: any[]) {
    try {
      await prisma.$transaction([
        prisma.step.deleteMany({ where: { moduleId } }),
        ...(steps?.length ? [
          prisma.step.createMany({
            data: steps.map((s: any, i: number) => ({
              moduleId,
              text: s.title || `Step ${i + 1}`,
              startTime: Math.max(0, Math.floor(s.startTime || 0)),
              endTime: s.endTime != null ? Math.floor(s.endTime) : 0,
              order: i,
            }))
          })
        ] : [])
      ])
    } catch (e: any) {
      throw new Error(`saveSteps failed: ${e.message}`)
    }
  },
  async markUploaded(id: string, s3Key: string) {
    await prisma.module.update({ where: { id }, data: { status: 'UPLOADED', s3Key } })
  },
  async markProcessing(id: string) {
    await prisma.module.update({ where: { id }, data: { status: 'PROCESSING', progress: 0 } })
  },
  async markReady(id: string) {
    await prisma.module.update({ where: { id }, data: { status: 'READY', progress: 100 } })
  },
  async markError(id: string, message?: string) {
    // Use a valid status from the schema
    await prisma.module.update({ 
      where: { id }, 
      data: { 
        status: 'FAILED', 
        lastError: message || 'Processing failed',
        progress: 100
      } 
    })
  },

  // Backward compatibility methods
  async getModuleById(id: string) {
    return this.get(id)
  },

  async updateModuleStatus(id: string, status: string, progress?: number, error?: string) {
    const data: any = { status }
    if (progress !== undefined) data.progress = progress
    if (error !== undefined) data.lastError = error
    
    await prisma.module.update({ where: { id }, data })
  },

  // New method for updating transcript information
  async updateTranscript(id: string, transcriptText: string, transcriptJobId: string) {
    await prisma.module.update({
      where: { id },
      data: { transcriptText, transcriptJobId }
    })
  }
}
