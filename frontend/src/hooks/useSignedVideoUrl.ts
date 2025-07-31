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
    
    fetch(apiUrl, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`Failed to get video URL: ${res.status} ${res.statusText}`)
        return res.json()
      })
      .then(data => {
        if (data?.url) {
          // Convert relative URL to absolute URL for video player
          const videoUrl = data.url.startsWith('http') ? data.url : `http://localhost:8000${data.url}`
          setUrl(videoUrl)
        } else {
          setUrl(null)
          setError('No URL returned from server')
        }
      })
      .catch(err => {
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