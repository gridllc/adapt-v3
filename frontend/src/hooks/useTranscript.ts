import { useState, useEffect } from 'react'
import { api, API_ENDPOINTS } from '../config/api'

export function useTranscript(moduleId?: string) {
  const [transcript, setTranscript] = useState<string | any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!moduleId) return

    const fetchTranscript = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const data = await api(API_ENDPOINTS.TRANSCRIPT(moduleId))
        
        if (data.success) {
          setTranscript(data.transcript)
        } else {
          setError(data.error || 'Failed to load transcript')
        }
      } catch (err) {
        console.error('Error fetching transcript:', err)
        setError(err instanceof Error ? err.message : 'Failed to load transcript')
      } finally {
        setLoading(false)
      }
    }

    fetchTranscript()
  }, [moduleId])

  return { transcript, loading, error }
}