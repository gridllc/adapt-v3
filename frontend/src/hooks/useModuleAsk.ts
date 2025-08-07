import { useState } from 'react'
import { api, API_ENDPOINTS } from '../config/api'

interface AskResult {
  answer: string | null
  loading: boolean
  error: string | null
  ask: (moduleId: string, question: string) => Promise<void>
  // Grouped metadata for better organization
  reused: boolean
  similarity: number | null
  questionId: string | null
  source: string | null
  // Optional raw response for analytics/debugging
  raw?: any
}

export function useModuleAsk(): AskResult {
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [raw, setRaw] = useState<any>(null)

  // Grouped metadata object for better organization
  const [meta, setMeta] = useState<{
    reused: boolean
    similarity: number | null
    questionId: string | null
    source: string | null
  }>({
    reused: false,
    similarity: null,
    questionId: null,
    source: null,
  })

  const ask = async (moduleId: string, question: string) => {
    try {
      setLoading(true)
      setError(null)
      setAnswer(null)
      setRaw(null)
      setMeta({ reused: false, similarity: null, questionId: null, source: null })

      const data = await api(API_ENDPOINTS.AI_ASK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, question }),
      })

      if (data.success) {
        setAnswer(data.answer || null)
        setRaw(data)
        setMeta({
          reused: data.reused || false,
          similarity: data.similarity || null,
          questionId: data.questionId || null,
          source: data.source || null
        })

        // Development logging for transparency
        if (import.meta.env.DEV) {
          console.log(
            `[AI ASK] Module: ${moduleId} | Q: "${question}"\n` +
            `↪️ Reused: ${data.reused ? '✅' : '❌'} | Similarity: ${data.similarity?.toFixed(3)} | QID: ${data.questionId}`
          )
        }
      } else {
        setError(data.error || 'Failed to get answer')
      }
    } catch (err) {
      console.error('Error asking question:', err)
      setError(err instanceof Error ? err.message : 'Failed to get answer')
    } finally {
      setLoading(false)
    }
  }

  return {
    answer,
    loading,
    error,
    ask,
    raw,
    ...meta, // exposes reused, similarity, questionId, source
  }
}