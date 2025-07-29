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
    fetch(API_CONFIG.getApiUrl(API_ENDPOINTS.STEPS(moduleId)))
      .then(res => {
        if (!res.ok) throw new Error('Steps not found')
        return res.json()
      })
      .then(data => setSteps(data.steps || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [moduleId])

  return { steps, loading, error }
} 
