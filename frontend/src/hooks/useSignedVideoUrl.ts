// src/hooks/useSignedVideoUrl.ts
import { useState, useEffect } from 'react'
import { API_CONFIG, API_ENDPOINTS } from '../config/api'

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

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const apiUrl = API_CONFIG.getApiUrl(API_ENDPOINTS.VIDEO_URL(filename))
    
    console.log('🔗 Fetching video URL:', apiUrl)
    
    fetch(apiUrl, { signal: controller.signal })
      .then(res => {
        console.log('📡 Video URL response status:', res.status)
        if (!res.ok) throw new Error(`Failed to get video URL: ${res.status} ${res.statusText}`)
        return res.json()
      })
      .then(data => {
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
      })
      .catch(err => {
        console.error('❌ Video URL error:', err)
        if (err.name !== 'AbortError') {
          setError(err.message || 'Unknown error')
          setUrl(null)
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [filename])

  return { url, loading, error }
}