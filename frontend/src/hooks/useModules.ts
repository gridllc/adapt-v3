import { useState, useEffect } from 'react'
import { API_CONFIG, API_ENDPOINTS } from '@config/api'

export interface Module {
  id: string
  title: string
  description: string
  createdAt: string
}

export function useModules() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(API_CONFIG.getApiUrl(API_ENDPOINTS.MODULES))
      .then(res => {
        if (!res.ok) throw new Error('Failed to load modules')
        return res.json()
      })
      .then(data => {
        setModules(data.modules || [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { modules, loading, error }
}