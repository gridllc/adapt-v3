import { useEffect, useState } from 'react'

export interface Module {
  id: string
  filename: string
  title: string
  createdAt: string
}

export function useModules() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001'
    fetch(`${apiBase}/api/modules`)
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