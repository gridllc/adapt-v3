import { useState, useEffect } from 'react'
import { api } from '../config/api'

interface ModuleStatus {
  status: 'processing' | 'ready' | 'failed'
  progress: number
  message?: string
  steps?: any[]
  error?: string
  title?: string
  description?: string
  totalDuration?: number
}

export function useModuleStatus(moduleId: string, enabled = true) {
  const [status, setStatus] = useState<ModuleStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !moduleId) return

    let interval: NodeJS.Timeout

    const checkStatus = async () => {
      try {
        console.log(`🔍 Checking status for module: ${moduleId}`)
        // Fix: Use correct endpoint path
        const data = await api(`/api/upload/status/${moduleId}`)
        
        console.log(`📊 Module status:`, data)
        setStatus(data)
        setLoading(false)
        setError(null)

        // Stop polling when ready or failed
        if (data.status === 'ready' || data.status === 'failed') {
          console.log(`✅ Module ${moduleId} processing complete: ${data.status}`)
          clearInterval(interval)
        }
      } catch (err) {
        console.error('❌ Status check failed:', err)
        setError(err instanceof Error ? err.message : 'Status check failed')
        setLoading(false)
      }
    }

    // Check immediately
    checkStatus()

    // Then poll every 3 seconds
    interval = setInterval(checkStatus, 3000)

    return () => clearInterval(interval)
  }, [moduleId, enabled])

  return { status, loading, error }
} 