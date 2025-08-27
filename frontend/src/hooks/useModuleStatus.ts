import { useState, useEffect } from 'react'
import { api } from '../config/api'

interface ModuleStatus {
  status: 'processing' | 'ready' | 'failed' | 'complete' | 'error'
  progress: number
  message?: string
  steps?: any[]
  error?: string
  title?: string
  description?: string
  totalDuration?: number
  timestamp?: string
}

export function useModuleStatus(moduleId: string, enabled = true) {
  const [status, setStatus] = useState<ModuleStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stuckAtZero, setStuckAtZero] = useState(false)
  const [lastProgress, setLastProgress] = useState(0)
  const [stuckStartTime, setStuckStartTime] = useState<number | null>(null)
  const [timeoutReached, setTimeoutReached] = useState(false)

  useEffect(() => {
    if (!enabled || !moduleId) return

    let interval: NodeJS.Timeout
    let stuckTimeout: NodeJS.Timeout
    let timeoutTimer: NodeJS.Timeout

    const checkStatus = async () => {
      try {
        console.log(`🔍 Checking status for module: ${moduleId}`)
        
        // Get module from the modules endpoint (fixes 404 errors)
        const response = await api(`/api/modules/${moduleId}`)
        console.log(`📊 Module response:`, response)
        
        if (!response.success || !response.module) {
          throw new Error(response.error || 'Module not found')
        }
        
        const module = response.module
        const statusData: ModuleStatus = {
          status: module.status || 'processing',
          progress: module.progress || 0,
          message: module.message,
          steps: module.steps,
          title: module.title,
          description: module.description,
          error: module.error
        }
        
        setStatus(statusData)
        setLoading(false)
        setError(null)

        // Track progress for stuck detection
        const currentProgress = statusData.progress || 0
        if (currentProgress === 0 && lastProgress === 0) {
          if (!stuckStartTime) {
            setStuckStartTime(Date.now())
          } else {
            const stuckDuration = Date.now() - stuckStartTime
            if (stuckDuration > 20000) { // 20 seconds stuck at 0%
              setStuckAtZero(true)
              console.warn(`⚠️ Module ${moduleId} stuck at 0% for ${stuckDuration}ms`)
            }
          }
        } else {
          setStuckAtZero(false)
          setStuckStartTime(null)
        }
        setLastProgress(currentProgress)

        // Stop polling when ready, complete, or failed
        if (statusData.status === 'ready' || statusData.status === 'failed' || statusData.status === 'complete' || statusData.status === 'error') {
          console.log(`✅ Module ${moduleId} processing complete: ${statusData.status}`)
          clearInterval(interval)
          if (stuckTimeout) clearTimeout(stuckTimeout)
          if (timeoutTimer) clearTimeout(timeoutTimer)
        }
      } catch (err) {
        console.error('❌ Status check failed:', err)
        setError(err instanceof Error ? err.message : 'Status check failed')
        setLoading(false)
        
        // If we can't reach the server, assume it might be stuck
        if (!stuckAtZero) {
          setStuckAtZero(true)
        }
      }
    }

    // Check immediately
    checkStatus()

    // Then poll every 3 seconds
    interval = setInterval(checkStatus, 3000)

    // Set up stuck detection timeout
    stuckTimeout = setTimeout(() => {
      if (lastProgress === 0) {
        setStuckAtZero(true)
        console.warn(`⚠️ Module ${moduleId} appears to be stuck at 0%`)
      }
    }, 15000) // 15 seconds

    // Set up overall timeout (5 minutes)
    timeoutTimer = setTimeout(() => {
      setTimeoutReached(true)
      console.warn(`⏰ Module ${moduleId} processing timeout reached (5 minutes)`)
      clearInterval(interval)
      if (stuckTimeout) clearTimeout(stuckTimeout)
    }, 300000) // 5 minutes

    return () => {
      clearInterval(interval)
      if (stuckTimeout) clearTimeout(stuckTimeout)
      if (timeoutTimer) clearTimeout(timeoutTimer)
    }
  }, [moduleId, enabled])

  return { status, loading, error, stuckAtZero, timeoutReached }
} 