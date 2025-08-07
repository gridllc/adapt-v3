import { useState } from 'react'
import { api, API_ENDPOINTS } from '../config/api'

interface AskResult {
  answer: string | null
  source: string | null
  loading: boolean
  error: string | null
  reused: boolean
  similarity: number | null
  questionId: string | null
  ask: (moduleId: string, question: string) => Promise<void>
}

export function useModuleAsk(): AskResult {
  const [answer, setAnswer] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reused, setReused] = useState<boolean>(false)
  const [similarity, setSimilarity] = useState<number | null>(null)
  const [questionId, setQuestionId] = useState<string | null>(null)

  const ask = async (moduleId: string, question: string) => {
    try {
      setLoading(true)
      setError(null)
      setAnswer(null)
      setSource(null)
      setReused(false)
      setSimilarity(null)
      setQuestionId(null)
      
      const data = await api(API_ENDPOINTS.AI_ASK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, question }),
      })
      
      if (data.success) {
        setAnswer(data.answer || null)
        setSource(data.source || null)
        setReused(data.reused || false)
        setSimilarity(data.similarity || null)
        setQuestionId(data.questionId || null)
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

  return { answer, source, loading, error, reused, similarity, questionId, ask }
}