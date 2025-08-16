// src/hooks/useSignedVideoUrl.ts
import { useState, useEffect } from 'react'
import { api, API_ENDPOINTS } from '../config/api'

interface UseSignedVideoUrlResult {
  url: string | null
  loading: boolean
  error: string | null
}

export function useSignedVideoUrl(filename?: string): UseSignedVideoUrlResult {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!filename) {
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
        
        console.log('🔗 Fetching video URL for:', filename)
        
        const data = await api(API_ENDPOINTS.VIDEO_URL(filename))
        
        if (!isMounted) return
        
        console.log('📦 Video URL response data:', data)
        
        if (data?.url) {
          // Always use the absolute URL from the backend
          const videoUrl = data.url
          console.log('🎥 Final video URL:', videoUrl)
          setUrl(videoUrl)
        } else {
          setUrl(null)
          setError('No URL returned from server')
        }
      } catch (err) {
        if (!isMounted) return
        console.error('❌ Video URL error:', err)
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
  }, [filename])

  return { url, loading, error }
}
