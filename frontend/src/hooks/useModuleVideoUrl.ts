import { useState, useEffect } from 'react'
import { api, API_ENDPOINTS } from '../config/api'

interface UseModuleVideoUrlResult {
  url: string | null
  loading: boolean
  error: string | null
}

export function useModuleVideoUrl(moduleId?: string): UseModuleVideoUrlResult {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!moduleId) {
      setUrl(null)
      setError(null)
      setLoading(false)
      return
    }

    let isMounted = true
    
    const fetchVideoUrl = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('🔗 Fetching video URL for module:', moduleId)
        
        const data = await api(API_ENDPOINTS.VIDEO_URL_BY_MODULE(moduleId))
        
        if (!isMounted) return
        
        console.log('📦 Module video URL response:', data)
        
        if (data?.url) {
          console.log('🎥 Module video URL:', data.url)
          setUrl(data.url)
        } else {
          setUrl(null)
          setError('No URL returned from server')
        }
      } catch (err) {
        if (!isMounted) return
        console.error('❌ Module video URL error:', err)
        setError(err instanceof Error ? err.message : 'Failed to get video URL')
        setUrl(null)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchVideoUrl()

    return () => {
      isMounted = false
    }
  }, [moduleId])

  return { url, loading, error }
}
