import { useState, useEffect } from 'react'

export interface Step {
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
    const apiBase = import.meta.env.VITE_API_BASE_URL || ''
    fetch(`${apiBase}/api/steps/${moduleId}`)
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
