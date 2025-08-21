import { useState, useEffect } from 'react'
import { useAuthenticatedApi } from './useAuthenticatedApi'
import { normalizeModuleData, NormalizedModule } from '../config/api'

interface ModulesResponse {
  success: boolean
  modules?: any[]
  error?: string
}

export function useModules() {
  const [modules, setModules] = useState<NormalizedModule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { authenticatedFetch } = useAuthenticatedApi()

  useEffect(() => {
    const fetchModules = async () => {
      const maxRetries = 3
      let retryCount = 0
      
      const attemptFetch = async (): Promise<NormalizedModule[]> => {
        try {
          console.log(`🔍 Fetching modules... (attempt ${retryCount + 1}/${maxRetries})`)
          const data = await authenticatedFetch('/api/modules') as ModulesResponse
          
          console.log('📦 Modules response:', data)
          
          if (data.success) {
            // Normalize each module in the response
            return (data.modules || []).map(module => normalizeModuleData(module))
          } else {
            throw new Error(data.error || 'Failed to fetch modules')
          }
        } catch (error) {
          console.error(`Error fetching modules (attempt ${retryCount + 1}):`, error)
          throw error
        }
      }
      
      while (retryCount < maxRetries) {
        try {
          const modulesData = await attemptFetch()
          setModules(modulesData)
          setError(null)
          break
        } catch (error) {
          retryCount++
          if (retryCount >= maxRetries) {
            console.error('Error fetching modules (attempt 1):', error)
            setError(error instanceof Error ? error.message : 'Failed to fetch modules')
            setModules([])
          } else {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
          }
        }
      }
      
      setLoading(false)
    }

    fetchModules()
  }, [authenticatedFetch])

  return { modules, loading, error }
}