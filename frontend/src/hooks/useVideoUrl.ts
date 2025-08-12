// src/hooks/useVideoUrl.ts
import { useState, useEffect } from 'react'
import { api, API_ENDPOINTS } from '../config/api'

interface UseVideoUrlResult {
  url: string | null
  loading: boolean
  error: string | null
}

/**
 * Hook to get video URLs, automatically handling S3 keys and full URLs.
 * If the input is an S3 key (e.g., "videos/abc.mp4"), it will fetch a signed URL.
 * If the input is already a full URL, it will use it directly.
 */
export function useVideoUrl(videoKeyOrUrl?: string): UseVideoUrlResult {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!videoKeyOrUrl) {
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
        
        console.log('🔗 Processing video input:', videoKeyOrUrl)
        
        // Check if it's already a full URL
        if (videoKeyOrUrl.startsWith('http://') || videoKeyOrUrl.startsWith('https://')) {
          console.log('🌐 Input is already a full URL, using directly')
          setUrl(videoKeyOrUrl)
          return
        }
        
        // It's an S3 key, fetch signed URL
        console.log('🔑 Input is S3 key, fetching signed URL...')
        
        const data = await api(`/api/storage/signed-url?key=${encodeURIComponent(videoKeyOrUrl)}`)
        
        if (!isMounted) return
        
        console.log('📦 Signed URL response data:', data)
        
        if (data?.url) {
          console.log('🎥 Final signed URL:', data.url)
          setUrl(data.url)
        } else {
          setUrl(null)
          setError('No signed URL returned from server')
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
  }, [videoKeyOrUrl])

  return { url, loading, error }
}
