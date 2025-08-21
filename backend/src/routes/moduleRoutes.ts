import { Router } from 'express'
import { prisma } from '../config/database.js'
import { ModuleService } from '../services/moduleService.js'
import { presignedUploadService } from '../services/presignedUploadService.js'

export const moduleRoutes = Router()

// GET /api/modules  -> list recent modules (optionally for the signed-in user)
moduleRoutes.get('/', async (req: any, res) => {
  try {
    const userId = req.auth?.userId ?? null // if you wire Clerk later
    const modules = await prisma.module.findMany({
      where: userId ? { userId } : undefined,
      select: {
        id: true,
        title: true,
        filename: true,
        status: true,
        progress: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return res.json({ success: true, modules })
  } catch (e) {
    console.error('GET /api/modules failed', e)
    return res.status(500).json({ success: false, error: 'failed_to_list_modules' })
  }
})

// GET /api/modules/:id -> module details + (optional) steps
moduleRoutes.get('/:id', async (req, res) => {
  try {
    const id = req.params.id
    const mod = await ModuleService.get(id)
    if (!mod) return res.status(404).json({ success: false, error: 'not_found' })
    
    let videoUrl: string | undefined;
    if (mod.status === "READY" && mod.s3Key) {
      videoUrl = await presignedUploadService.getSignedPlaybackUrl(mod.s3Key);
    }

    // many UIs want steps bundled
    const steps = await ModuleService.getSteps(id).catch(() => [])
    
    return res.json({ 
      success: true, 
      ...mod, 
      videoUrl, 
      steps 
    })
  } catch (e) {
    console.error('GET /api/modules/:id failed', e)
    return res.status(500).json({ success: false, error: 'failed_to_get_module' })
  }
})

// GET /api/modules/:id/status -> lightweight status poll
moduleRoutes.get('/:id/status', async (req, res) => {
  try {
    const id = req.params.id
    const mod = await ModuleService.get(id)
    if (!mod) return res.status(404).json({ success: false, error: 'not_found' })
    return res.json({
      success: true,
      status: mod.status,
      progress: mod.progress ?? 0,
      moduleId: id,
    })
  } catch (e) {
    console.error('GET /api/modules/:id/status failed', e)
    return res.status(500).json({ success: false, error: 'failed_to_get_status' })
  }
})

// DELETE /api/modules/:id -> delete module and associated data
moduleRoutes.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id
    console.log(`🗑️ Deleting module: ${id}`)
    
    // Check if module exists
    const mod = await ModuleService.get(id)
    if (!mod) {
      return res.status(404).json({ success: false, error: 'not_found' })
    }
    
    // Delete the module (this should cascade to steps if foreign key constraints are set up)
    await prisma.module.delete({
      where: { id }
    })
    
    console.log(`✅ Module deleted: ${id}`)
    return res.json({ success: true, message: 'Module deleted successfully' })
  } catch (e) {
    console.error('DELETE /api/modules/:id failed', e)
    return res.status(500).json({ success: false, error: 'failed_to_delete_module' })
  }
})