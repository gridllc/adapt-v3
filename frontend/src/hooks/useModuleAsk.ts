import { useState } from 'react'

interface AskResult {
  answer: string | null
  source: string | null
  loading: boolean
  error: string | null
  ask: (moduleId: string, question: string) => Promise<void>
}

export function useModuleAsk(): AskResult {
  const [answer, setAnswer] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ask = async (moduleId: string, question: string) => {
    setLoading(true)
    setError(null)
    setAnswer(null)
    setSource(null)
    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, question }),
      })
      if (!res.ok) throw new Error('Failed to get answer')
      const data = await res.json()
      setAnswer(data.answer || null)
      setSource(data.source || null)
    } catch (err: any) {
      setError(err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return { answer, source, loading, error, ask }
}