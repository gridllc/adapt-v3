import { useState, useEffect } from 'react'
import { api, API_ENDPOINTS } from '../config/api'

interface ModuleStatus {
  success: boolean
  status: 'processing' | 'ready' | 'error'
  moduleId: string
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
        
        // Get module status from the new status endpoint
        const data = await api(API_ENDPOINTS.MODULE_STATUS(moduleId))
        console.log(`📊 Module status from status endpoint:`, data)
        
        setStatus(data)
        setLoading(false)
        setError(null)

        // Stop polling when ready or error
        if (data.status === 'ready' || data.status === 'error') {
          console.log(`✅ Module ${moduleId} processing complete: ${data.status}`)
          clearInterval(interval)
          if (stuckTimeout) clearTimeout(stuckTimeout)
          if (timeoutTimer) clearTimeout(timeoutTimer)
        }
      } catch (err) {
        console.error('❌ Status check failed:', err)
        setError(err instanceof Error ? err.message : 'Status check failed')
        setLoading(false)
      }
    }

    // Check immediately
    checkStatus()

    // Then poll every 4 seconds
    interval = setInterval(checkStatus, 4000)

    // Set up overall timeout (3 minutes)
    timeoutTimer = setTimeout(() => {
      setTimeoutReached(true)
      console.warn(`⏰ Module ${moduleId} processing timeout reached (3 minutes)`)
      clearInterval(interval)
      if (stuckTimeout) clearTimeout(stuckTimeout)
    }, 180000) // 3 minutes

    return () => {
      clearInterval(interval)
      if (stuckTimeout) clearTimeout(stuckTimeout)
      if (timeoutTimer) clearTimeout(timeoutTimer)
    }
  }, [moduleId, enabled])

  return { status, loading, error, stuckAtZero, timeoutReached }
} 