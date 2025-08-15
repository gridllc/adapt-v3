import React, { useRef, useState } from 'react'
import { streamText } from '@/utils/streaming'
import { useAuth } from '@clerk/clerk-react'
import { AISuggestionFeedback } from './common/FeedbackWidget'
import { API_ENDPOINTS } from '@/config/api'

interface Props {
  moduleId: string
}

export const ChatTutor: React.FC<Props> = ({ moduleId }) => {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [source, setSource] = useState<'openai' | undefined>()
  const [reused, setReused] = useState(false)
  const [similarity, setSimilarity] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const { getToken } = useAuth()
  
  // Voice recording state
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const [isRecording, setIsRecording] = useState(false)

  const askQuestion = async () => {
    if (!question.trim() || loading) return
    setAnswer('')
    setError(undefined)
    setLoading(true)
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    
    try {
      const token = await getToken({ template: 'integration_fallback' })
      await streamText({
        url: API_ENDPOINTS.AI_STREAM,
        body: { moduleId, question },
        token,
        mode: 'text',
        signal: abortRef.current.signal,
        timeoutMs: 120_000,
        onDelta: (t) => setAnswer(prev => prev + t),
        onDone: () => setLoading(false),
        onError: (e) => {
          setError(e instanceof Error ? e.message : String(e))
          setLoading(false)
        },
      })
      // optional: setSource('openai'), setReused/similarity if your stream sends meta
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setLoading(false)
    } finally {
      abortRef.current = null
    }
  }

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      setAudioChunks([])
      
      recorder.ondataavailable = (e) => setAudioChunks((prev) => [...prev, e.data])
      recorder.onstop = handleStopRecording
      
      setMediaRecorder(recorder)
      setIsRecording(true)
      recorder.start()
      
      console.log('🎙️ Started recording')
    } catch (error) {
      console.error('❌ Failed to start recording:', error)
      alert('Failed to access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop()
      setIsRecording(false)
      mediaRecorder.stream.getTracks().forEach(track => track.stop())
      console.log('⏹️ Stopped recording')
    }
  }

  const handleStopRecording = async () => {
    try {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
      const formData = new FormData()
      formData.append('audio', audioBlob)

      console.log('📤 Sending audio for transcription...')
      
      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status}`)
      }

      const { transcript } = await response.json()
      console.log('📝 Transcription received:', transcript)
      
      if (transcript) {
        setQuestion(transcript)
        // Optionally auto-send the transcribed question
        // await askQuestion()
      }
    } catch (error) {
      console.error('❌ Transcription error:', error)
      alert('Failed to transcribe audio. Please try again.')
    }
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        Ask the AI Tutor
      </h3>

      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type your question..."
          className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => { if (e.key === 'Enter') askQuestion() }}
        />
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={loading}
          className={`px-4 py-2 rounded-lg transition-colors ${
            isRecording 
              ? 'bg-red-600 text-white hover:bg-red-700' 
              : 'bg-gray-600 text-white hover:bg-gray-700'
          }`}
          title={isRecording ? 'Stop Recording' : 'Start Voice Recording'}
        >
          {isRecording ? '⏹️' : '🎙️'}
        </button>
        <button
          onClick={askQuestion}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {loading ? 'Thinking...' : 'Ask'}
        </button>
        <button
          onClick={() => abortRef.current?.abort()}
          disabled={!loading}
          className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          title="Stop"
        >
          ⏹️
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      
      {answer && (
        <div className="bg-gray-100 p-3 rounded-lg text-gray-800">
          <p className="whitespace-pre-wrap">{answer}</p>
          {loading && <span className="animate-pulse">▍</span>}
          
          {/* AI Suggestion Feedback */}
          <div className="mt-3">
            <AISuggestionFeedback 
              moduleId={moduleId}
              userMessage={question}
              aiResponse={answer}
              context="AI tutor response"
              className="text-xs"
            />
          </div>
        </div>
      )}
    </div>
  )
}