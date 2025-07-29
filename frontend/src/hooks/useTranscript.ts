import { useState, useEffect } from 'react'
import { API_CONFIG, API_ENDPOINTS } from '@config/api'

export function useTranscript(moduleId?: string) {
  const [transcript, setTranscript] = useState<string | any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!moduleId) return

    setLoading(true)
    fetch(API_CONFIG.getApiUrl(API_ENDPOINTS.TRANSCRIPT(moduleId)))
      .then(res => {
        if (!res.ok) throw new Error('Transcript not found')
        return res.json()
      })
      .then(data => setTranscript(data.transcript))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [moduleId])

  return { transcript, loading, error }
}