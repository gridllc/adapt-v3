// src/hooks/useSignedVideoUrl.ts
import { useEffect, useState } from 'react'
import { apiClient } from '../config/api'

interface SignedUrlResponse {
  success: boolean
  url?: string
  error?: string
}

export function useSignedVideoUrl(moduleId: string | null) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!moduleId) return

    const fetchSignedUrl = async () => {
      setLoading(true)
      setError(null)

      try {
        const res = await apiClient.get<SignedUrlResponse>(`/video/${moduleId}/play`)
        if (res.data.success && res.data.url) {
          setUrl(res.data.url)
        } else {
          setError(res.data.error || 'Failed to fetch video URL')
        }
      } catch (err: any) {
        console.error('❌ useSignedVideoUrl error:', err)
        setError(err.message || 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchSignedUrl()
  }, [moduleId])

  return { url, loading, error }
}