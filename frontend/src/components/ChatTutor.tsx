import React, { useRef, useState } from 'react'
import { streamText } from '@/utils/streaming'
import { useAuth } from '@clerk/clerk-react'
import { AISuggestionFeedback } from './common/FeedbackWidget'
import { SecureContextBanner } from './common/SecureContextBanner'
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
      // 1. Detect support before even trying to start
      console.log('🔍 MediaRecorder supported:', 'MediaRecorder' in window)
      console.log('🔍 getUserMedia supported:', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia))
      console.log('🔍 MIME types supported:', MediaRecorder.isTypeSupported('audio/webm') ? 'webm OK' : 'webm not supported')

      // 2. Log permission state before asking
      if (navigator.permissions) {
        try {
          const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
          console.log('🎤 Mic permission state:', status.state)
        } catch (err) {
          console.warn('Could not check mic permission:', err)
        }
      } else {
        console.log('🎤 Permissions API not supported')
      }

      // 3. Wrap getUserMedia with granular error logging
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        console.log('✅ Got audio stream:', stream)
      } catch (err: any) {
        console.error('❌ getUserMedia failed:', err.name, err.message, err)
        alert(`Mic access failed: ${err.name} - ${err.message}`)
        return
      }

      const recorder = new MediaRecorder(stream)
      setAudioChunks([])
      
      // 4. Add onstart / onstop listeners to MediaRecorder
      recorder.onstart = () => console.log('🎙️ MediaRecorder started')
      recorder.onstop = () => console.log('⏹️ MediaRecorder stopped')
      recorder.onerror = (e) => console.error('MediaRecorder error:', e)
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
      console.log('🎙️ Processing recorded audio...')
      console.log('📊 Audio chunks count:', audioChunks.length)
      
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
      console.log('📁 Audio blob size:', audioBlob.size, 'bytes')
      console.log('📁 Audio blob type:', audioBlob.type)
      
      const formData = new FormData()
      formData.append('audio', audioBlob)

      console.log('📤 Sending audio for transcription...')
      
      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Transcription response error:', response.status, errorText)
        throw new Error(`Transcription failed: ${response.status} - ${errorText}`)
      }

      const { transcript } = await response.json()
      console.log('📝 Transcription received:', transcript)
      console.log('📏 Transcript length:', transcript?.length || 0, 'characters')
      
      if (transcript) {
        setQuestion(transcript)
        // Optionally auto-send the transcribed question
        // await askQuestion()
      } else {
        console.warn('⚠️ Empty transcript received')
        alert('No speech was detected. Please try speaking more clearly.')
      }
    } catch (error) {
      console.error('❌ Transcription error:', error)
      
      // Provide more specific error messages for mobile users
      let userMessage = 'Failed to transcribe audio. Please try again.'
      if (error instanceof Error) {
        if (error.message.includes('NotAllowedError')) {
          userMessage = 'Microphone permission denied. Please allow microphone access in your browser settings.'
        } else if (error.message.includes('NotFoundError')) {
          userMessage = 'No microphone found. Please check your device has a working microphone.'
        } else if (error.message.includes('NotReadableError')) {
          userMessage = 'Microphone is busy or not accessible. Please try again.'
        } else if (error.message.includes('NetworkError')) {
          userMessage = 'Network error during transcription. Please check your internet connection.'
        }
      }
      
      alert(userMessage)
    }
  }

  // Mobile-specific diagnostic function
  const runMobileDiagnostics = () => {
    console.log('🔍 === MOBILE MIC DIAGNOSTICS ===')
    console.log('📱 User Agent:', navigator.userAgent)
    console.log('🌐 Platform:', navigator.platform)
    console.log('🔒 Secure Context:', window.isSecureContext)
    console.log('📡 Online Status:', navigator.onLine)
    
    // Check MediaRecorder support
    console.log('🎙️ MediaRecorder support:', {
      supported: 'MediaRecorder' in window,
      mimeTypes: {
        webm: MediaRecorder.isTypeSupported('audio/webm'),
        mp4: MediaRecorder.isTypeSupported('audio/mp4'),
        ogg: MediaRecorder.isTypeSupported('audio/ogg'),
        wav: MediaRecorder.isTypeSupported('audio/wav')
      }
    })
    
    // Check getUserMedia support
    console.log('🎤 getUserMedia support:', {
      mediaDevices: !!navigator.mediaDevices,
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      enumerateDevices: !!navigator.mediaDevices?.enumerateDevices
    })
    
    // Check permissions API
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then(status => console.log('🔐 Microphone permission:', status.state))
        .catch(err => console.log('🔐 Permission check failed:', err))
    } else {
      console.log('🔐 Permissions API not supported')
    }
    
    // Check for existing audio devices
    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const audioDevices = devices.filter(device => device.kind === 'audioinput')
          console.log('🎵 Audio input devices:', audioDevices.map(d => ({ id: d.deviceId, label: d.label, groupId: d.groupId })))
        })
        .catch(err => console.log('🎵 Device enumeration failed:', err))
    }
    
    console.log('🔍 === END DIAGNOSTICS ===')
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
      {/* Security and Permission Banner */}
      <SecureContextBanner />
      
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
          onClick={runMobileDiagnostics}
          className="px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm"
          title="Run mobile microphone diagnostics"
        >
          🔍
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