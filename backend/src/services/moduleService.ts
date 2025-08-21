import { prisma } from '../config/database.js'
import { presignedUploadService } from './presignedUploadService.js'

export class ModuleService {
  // Fetch a single module with consistent shape
  static async get(id: string) {
    const mod = await prisma.module.findUnique({
      where: { id },
      include: {
        steps: true,
      },
    })
    if (!mod) return null

    // Generate signed playback URL if READY
    let videoUrl: string | undefined
    if (mod.status === 'READY' && mod.s3Key) {
      try {
        videoUrl = await presignedUploadService.getSignedPlaybackUrl(mod.s3Key)
      } catch {
        videoUrl = undefined
      }
    }

    return {
      ...mod,
      videoUrl,
      steps: mod.steps ?? [],
    }
  }

  // Fetch steps for a module
  static async getSteps(moduleId: string) {
    return prisma.step.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
    })
  }

  // Create a new module
  static async create(data: any) {
    return prisma.module.create({ data })
  }

  // Update a module
  static async update(id: string, data: any) {
    return prisma.module.update({
      where: { id },
      data,
    })
  }
}
