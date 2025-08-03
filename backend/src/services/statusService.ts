import fs from 'fs'
import path from 'path'

export interface ModuleStatus {
  status: 'processing' | 'complete' | 'error' | 'queued'
  message?: string
  timestamp: string
  progress?: number
  error?: string
}

export const saveModuleStatus = (moduleId: string, status: string, message?: string, progress?: number, error?: string) => {
  try {
    const statusPath = path.join(process.cwd(), 'backend', 'data', 'status', `${moduleId}.json`)
    
    // Ensure directory exists
    fs.mkdirSync(path.dirname(statusPath), { recursive: true })
    
    const statusData: ModuleStatus = {
      status: status as ModuleStatus['status'],
      message,
      timestamp: new Date().toISOString(),
      progress,
      error
    }
    
    fs.writeFileSync(statusPath, JSON.stringify(statusData, null, 2))
    console.log(`📊 [Status] Updated status for ${moduleId}: ${status}${message ? ` - ${message}` : ''}`)
  } catch (err) {
    console.error(`❌ [Status] Failed to save status for ${moduleId}:`, err)
  }
}

export const getModuleStatus = (moduleId: string): ModuleStatus | null => {
  try {
    const statusPath = path.join(process.cwd(), 'backend', 'data', 'status', `${moduleId}.json`)
    
    if (!fs.existsSync(statusPath)) {
      return null
    }
    
    const raw = fs.readFileSync(statusPath, 'utf-8')
    return JSON.parse(raw)
  } catch (err) {
    console.error(`❌ [Status] Failed to read status for ${moduleId}:`, err)
    return null
  }
}

export const updateModuleProgress = (moduleId: string, progress: number, message?: string) => {
  const currentStatus = getModuleStatus(moduleId)
  if (currentStatus) {
    saveModuleStatus(moduleId, currentStatus.status, message, progress, currentStatus.error)
  }
} 