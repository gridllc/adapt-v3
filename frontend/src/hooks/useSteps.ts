import { useState, useEffect } from 'react'
import { api, API_ENDPOINTS } from '../config/api'

interface Step {
  stepTitle: string
  text: string
  timestamp?: number
}

export function useSteps(moduleId?: string) {
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!moduleId) return

    const fetchSteps = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const data = await api(API_ENDPOINTS.STEPS(moduleId))
        
        if (data.success) {
          setSteps(data.steps || [])
        } else {
          setError(data.error || 'Failed to load steps')
          setSteps([])
        }
      } catch (err) {
        console.error('❌ Error fetching steps:', err)
        setError(err instanceof Error ? err.message : 'Failed to load steps')
        setSteps([]) // Set empty steps on error
      } finally {
        setLoading(false)
      }
    }

    fetchSteps()
  }, [moduleId])

  return { steps, loading, error }
} 
