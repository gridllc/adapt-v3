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
    return prisma.step.findMany({ where: { moduleId }, orderBy: { startTime: 'asc' } })
  },
  async saveSteps(moduleId: string, steps: any[]) {
    try {
      await prisma.$transaction([
        prisma.step.deleteMany({ where: { moduleId } }),
        ...(steps?.length ? [
          prisma.step.createMany({
            data: steps.map((s: any, i: number) => ({
              moduleId,
              text: s.title || `Step ${i + 1}`, // Required field
              startTime: Math.max(0, Math.floor(s.startTime || 0)),
              endTime: s.endTime != null ? Math.floor(s.endTime) : 0, // Required field
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
    await prisma.module.update({ where: { id }, data: { status: 'FAILED' } })
  },
}
