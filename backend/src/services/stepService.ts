// backend/src/services/stepService.ts
import prisma from "./prismaService.js"

export async function createStep(data: {
  moduleId: string
  order: number
  text: string
  startTime: number
  endTime: number
  aiConfidence?: number
}) {
  return prisma.step.create({ data })
}

export async function updateStep(id: string, data: any) {
  return prisma.step.update({
    where: { id },
    data,
  })
}

export async function getStepsByModule(moduleId: string) {
  return prisma.step.findMany({
    where: { moduleId },
    orderBy: { order: 'asc' }
  })
}

export async function deleteStep(id: string) {
  return prisma.step.delete({ where: { id } })
}

export async function getStepsByModuleId(moduleId: string) {
  return prisma.step.findMany({
    where: { moduleId },
    orderBy: { order: 'asc' }
  })
}

export async function saveSteps(moduleId: string, steps: any[]) {
  // Delete existing steps for this module
  await prisma.step.deleteMany({
    where: { moduleId }
  })
  
  // Create new steps
  const createdSteps = await Promise.all(
    steps.map((step, index) => 
      prisma.step.create({
        data: {
          moduleId,
          order: index + 1,
          text: step.text || step.title || '',
          startTime: step.start || step.timestamp || 0,
          endTime: step.end || (step.start || step.timestamp || 0) + 30,
        }
      })
    )
  )
  
  return createdSteps
}

export async function getSteps(req: any, res: any) {
  try {
    const { moduleId } = req.params
    const steps = await getStepsByModuleId(moduleId)
    res.json({ success: true, steps })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch steps' })
  }
}

export async function createSteps(req: any, res: any) {
  try {
    const { moduleId } = req.params
    const { steps } = req.body
    const createdSteps = await saveSteps(moduleId, steps)
    res.json({ success: true, steps: createdSteps })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create steps' })
  }
}

export async function updateSteps(req: any, res: any) {
  try {
    const { moduleId } = req.params
    const { steps } = req.body
    const updatedSteps = await saveSteps(moduleId, steps)
    res.json({ success: true, steps: updatedSteps })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update steps' })
  }
}

export async function rewriteStep(req: any, res: any) {
  try {
    const { moduleId } = req.params
    const { text } = req.body
    // TODO: Implement AI rewrite logic
    const rewritten = `AI Rewritten: ${text}`
    res.json({ success: true, rewritten })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to rewrite step' })
  }
}

// Export as a service object for consistency
export const StepService = {
  createStep,
  updateStep,
  getStepsByModule,
  getStepsByModuleId,
  saveSteps,
  deleteStep,
  getSteps,
  createSteps,
  updateSteps,
  rewriteStep,
}
