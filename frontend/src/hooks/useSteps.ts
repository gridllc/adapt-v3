import { useState, useEffect } from 'react'
import { API_CONFIG, API_ENDPOINTS } from '../config/api'

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

    setLoading(true)
    setError(null)
    
    fetch(API_CONFIG.getApiUrl(API_ENDPOINTS.STEPS(moduleId)))
      .then(res => {
        if (!res.ok) {
          if (res.status === 404) {
            console.warn('⚠️ Steps not found for module:', moduleId)
            return { steps: [], success: false, error: 'Steps not found' }
          }
          throw new Error('Steps not found')
        }
        return res.json()
      })
      .then(data => {
        setSteps(data.steps || [])
        if (data.error) {
          setError(data.error)
        }
      })
      .catch(err => {
        console.error('❌ Error fetching steps:', err)
        setError(err.message)
        setSteps([]) // Set empty steps on error
      })
      .finally(() => setLoading(false))
  }, [moduleId])

  return { steps, loading, error }
} 
