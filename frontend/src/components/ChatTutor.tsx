import React, { useState } from 'react'
import { useModuleAsk } from '@/hooks/useModuleAsk'
import { AISuggestionFeedback } from './common/FeedbackWidget'

interface Props {
  moduleId: string
}

export const ChatTutor: React.FC<Props> = ({ moduleId }) => {
  const [question, setQuestion] = useState('')
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const { answer, source, loading, error, reused, similarity, ask } = useModuleAsk()

  const askQuestion = async () => {
    if (!question.trim()) return
    await ask(moduleId, question)
  }

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
        // await ask(moduleId, transcript)
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
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {answer && (
        <div className="bg-gray-100 p-3 rounded-lg text-gray-800">
          <p className="whitespace-pre-wrap">{answer}</p>
          <div className="mt-2 text-xs text-gray-500 space-y-1">
            <p>Answered by: {source?.toUpperCase()}</p>
            {reused && (
              <p className="text-green-600">
                ♻️ Reused from shared memory ({(similarity * 100).toFixed(1)}% match)
              </p>
            )}
          </div>
          
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
