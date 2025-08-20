// src/hooks/useSignedVideoUrl.ts
import { useEffect, useState } from 'react'
import { api } from '../config/api'

export function useSignedVideoUrl(moduleId?: string, enabled: boolean = true) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !moduleId) return
    let active = true
    ;(async () => {
      try {
        const r = await api.get(`/api/video/${moduleId}/play`)
        if (active) setUrl(r.url)
      } catch (e: any) {
        if (active) setError(e?.message || 'failed to sign url')
      }
    })()
    return () => { active = false }
  }, [moduleId, enabled])

  return { url, error }
}