import { useState, useEffect } from 'react'
import { API_CONFIG, API_ENDPOINTS } from '../config/api'

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
    const fetchModules = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch(API_CONFIG.getApiUrl(API_ENDPOINTS.MODULES))
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const text = await response.text()
        if (!text) {
          throw new Error('Empty response from server')
        }
        
        const data = JSON.parse(text)
        
        if (data.success) {
          setModules(data.modules || [])
        } else {
          throw new Error(data.error || 'Failed to load modules')
        }
      } catch (err) {
        console.error('Error fetching modules:', err)
        setError(err instanceof Error ? err.message : 'Failed to load modules')
        setModules([])
      } finally {
        setLoading(false)
      }
    }

    fetchModules()
  }, [])

  return { modules, loading, error }
}