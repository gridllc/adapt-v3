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
  const { lastAnswer, isLoading, error, askQuestion } = useModuleAsk()

  const askQuestionHandler = async () => {
    if (!question.trim()) return
    
    // Create the training context
    const context = {
      moduleId,
      allSteps: [], // This would need to be populated from module data
      videoTime: 0, // This would need to be populated from video player
      currentStep: undefined
    }
    
    await askQuestion({ moduleId, question }, context)
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
          // await askQuestionHandler()
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
          disabled={isLoading}
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
          onClick={askQuestionHandler}
          disabled={isLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {isLoading ? 'Thinking...' : 'Ask'}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {lastAnswer && (
        <div className="bg-gray-100 p-3 rounded-lg text-gray-800">
          <p className="whitespace-pre-wrap">{lastAnswer.answer}</p>
          <div className="mt-2 text-xs text-gray-500 space-y-1">
            <p>Confidence: {(lastAnswer.confidence * 100).toFixed(1)}%</p>
            {lastAnswer.sources.length > 0 && (
              <p>Sources: {lastAnswer.sources.join(', ')}</p>
            )}
            {lastAnswer.relatedSteps.length > 0 && (
              <p>Related steps: {lastAnswer.relatedSteps.length}</p>
            )}
          </div>
          
          {/* AI Suggestion Feedback */}
          <div className="mt-3">
            <AISuggestionFeedback 
              moduleId={moduleId}
              userMessage={question}
              aiResponse={lastAnswer.answer}
              context="AI tutor response"
              className="text-xs"
            />
          </div>
        </div>
      )}
    </div>
  )
}
