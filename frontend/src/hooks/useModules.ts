import { useState, useEffect } from 'react'
import { api } from '../config/api'

export interface Module {
  id: string
  title: string
  filename: string
  createdAt: string
  status?: string
}

export function useModules() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchModules = async () => {
      const maxRetries = 3
      let retryCount = 0
      
      const attemptFetch = async (): Promise<any> => {
        try {
          console.log(`🔍 Fetching modules... (attempt ${retryCount + 1}/${maxRetries})`)
          const data = await api('/api/modules')
          
          console.log('📦 Modules response:', data)
          
          if (data.success) {
            setModules(data.modules || [])
            console.log(`✅ Loaded ${data.modules?.length || 0} modules`)
            return data
          } else {
            throw new Error(data.error || 'Failed to load modules')
          }
        } catch (err) {
          console.error(`❌ Error fetching modules (attempt ${retryCount + 1}):`, err)
          
          if (retryCount < maxRetries - 1) {
            retryCount++
            console.log(`🔄 Retrying in 1 second... (${retryCount}/${maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, 1000))
            return attemptFetch()
          } else {
            throw err
          }
        }
      }

      try {
        setLoading(true)
        setError(null)
        
        // Small delay to ensure backend is ready
        await new Promise(resolve => setTimeout(resolve, 500))
        
        await attemptFetch()
      } catch (err) {
        console.error('❌ Final error fetching modules:', err)
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