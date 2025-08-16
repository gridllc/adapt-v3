import fs from 'fs/promises'
import path from 'path'
import { ModuleStatus as PrismaModuleStatus } from '@prisma/client'

// Local status interface for file-based status tracking
export interface LocalModuleStatus {
  status: 'processing' | 'complete' | 'error' | 'queued'
  message?: string
  timestamp: string
  progress?: number
  error?: string
}

export const saveModuleStatus = async (moduleId: string, status: string, message?: string, progress?: number, error?: string) => {
  try {
    // Use the correct path structure that matches the data directory
    const statusPath = path.join(process.cwd(), 'backend', 'src', 'data', 'status', `${moduleId}.json`)
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(statusPath), { recursive: true })
    
    const statusData: LocalModuleStatus = {
      status: status as LocalModuleStatus['status'],
      message,
      timestamp: new Date().toISOString(),
      progress,
      error
    }
    
    await fs.writeFile(statusPath, JSON.stringify(statusData, null, 2))
    console.log(`📊 [Status] Updated status for ${moduleId}: ${status}${message ? ` - ${message}` : ''}`)
  } catch (err) {
    console.error(`❌ [Status] Failed to save status for ${moduleId}:`, err)
    console.error(`❌ [Status] Error details:`, err instanceof Error ? err.stack : 'No stack trace')
  }
}

export const getModuleStatus = async (moduleId: string): Promise<LocalModuleStatus | null> => {
  try {
    // Use the correct path structure that matches the data directory
    const statusPath = path.join(process.cwd(), 'backend', 'src', 'data', 'status', `${moduleId}.json`)
    
    const exists = await fs.access(statusPath).then(() => true).catch(() => false)
    if (!exists) {
      return null
    }
    
    const raw = await fs.readFile(statusPath, 'utf-8')
    return JSON.parse(raw)
  } catch (err) {
    console.error(`❌ [Status] Failed to read status for ${moduleId}:`, err)
    return null
  }
}

export const updateModuleProgress = async (moduleId: string, progress: number, message?: string) => {
  const currentStatus = await getModuleStatus(moduleId)
  if (currentStatus) {
    await saveModuleStatus(moduleId, currentStatus.status, message, progress, currentStatus.error)
  } else {
    // If no status exists, create one
    await saveModuleStatus(moduleId, 'processing', message, progress)
  }
} 
