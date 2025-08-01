import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useSignedVideoUrl } from '../hooks/useSignedVideoUrl'
import { api, API_ENDPOINTS } from '../config/api'
import { StepGenerationFeedback, TranscriptionFeedback } from '../components/common/FeedbackWidget'
import { InlineStepEditor, StepData } from '../components/InlineStepEditor'

interface Step {
  id: string
  timestamp: number
  title: string
  description: string
  duration?: number
  aliases?: string[]
  notes?: string
}

export const TrainingPage: React.FC = () => {
  const { moduleId } = useParams()
  const [searchParams] = useSearchParams()
  const filename = moduleId ? `${moduleId}.mp4` : undefined
  const { url, loading, error } = useSignedVideoUrl(filename)
  const videoRef = useRef<HTMLVideoElement>(null)
  
  const [steps, setSteps] = useState<Step[]>([])
  const [stepsLoading, setStepsLoading] = useState(false)
  const [stepsError, setStepsError] = useState<string | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null)

  const [chatMessage, setChatMessage] = useState('')
  const [chatHistory, setChatHistory] = useState([
    {
      type: 'assistant',
      message: "Hi! I'm here to help you with this training. Ask me anything about the current step or the overall process."
    }
  ])

  const [processingAI, setProcessingAI] = useState(false)
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)
  const [editedSteps, setEditedSteps] = useState<Step[]>([])

  // Video seeking function
  const seekToTime = (timeInSeconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeInSeconds
      videoRef.current.play()
      console.log(`🎬 Seeking to ${timeInSeconds}s`)
    }
  }

  // Handle step click for seeking
  const handleStepClick = (step: Step, index: number) => {
    seekToTime(step.timestamp)
    setCurrentStepIndex(index)
    console.log(`📋 Step ${index + 1} clicked: ${step.title}`)
  }

  // Handle inline editing
  const handleEditStep = (index: number) => {
    setEditingStepIndex(index)
    setEditedSteps([...steps])
  }

  const handleSaveStep = async (index: number) => {
    if (!moduleId) return
    
    const updatedSteps = [...editedSteps]
    try {
      await api(API_ENDPOINTS.STEPS(moduleId), {
        method: 'POST',
        body: JSON.stringify({ steps: updatedSteps }),
      })
      setSteps(updatedSteps)
      setEditingStepIndex(null)
      console.log(`✅ Step ${index + 1} saved`)
    } catch (err) {
      console.error('❌ Save error:', err)
      alert('Failed to save step')
    }
  }

  const handleCancelEdit = () => {
    setEditingStepIndex(null)
    setEditedSteps([...steps])
  }

  const handleStepChange = (index: number, field: keyof Step, value: string | string[]) => {
    const newEditedSteps = [...editedSteps]
    newEditedSteps[index] = { ...newEditedSteps[index], [field]: value }
    setEditedSteps(newEditedSteps)
  }

  const handleAIRewrite = async (index: number) => {
    if (!moduleId) return
    
    try {
      const res = await fetch(`/api/steps/${moduleId}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editedSteps[index].title }),
      })
      
      if (!res.ok) throw new Error('AI rewrite failed')
      
      const data = await res.json()
      handleStepChange(index, 'title', data.text)
    } catch (err) {
      console.error('AI rewrite error:', err)
      alert('Failed to rewrite with AI')
    }
  }

  // Convert Step to StepData
  const convertStepToStepData = (step: Step): StepData => ({
    id: step.id || `step-${Date.now()}`,
    title: step.title,
    description: step.description,
    start: step.timestamp,
    end: step.timestamp + (step.duration || 30),
    aliases: step.aliases || [],
    notes: step.notes || ''
  })

  // Handle seek parameter from URL
  useEffect(() => {
    const seekTime = searchParams.get('seek')
    if (seekTime && videoRef.current && url) {
      const timeInSeconds = parseFloat(seekTime)
      if (!isNaN(timeInSeconds)) {
        // Wait for video to be ready, then seek
        const handleCanPlay = () => {
          seekToTime(timeInSeconds)
          videoRef.current?.removeEventListener('canplay', handleCanPlay)
        }
        videoRef.current.addEventListener('canplay', handleCanPlay)
        
        // If video is already ready, seek immediately
        if (videoRef.current.readyState >= 2) {
          seekToTime(timeInSeconds)
        }
      }
    }
  }, [url, searchParams])

  // Fetch steps when video URL is ready
  useEffect(() => {
    if (!moduleId) {
      console.log('🔄 No moduleId, skipping steps fetch')
      return
    }

    console.log('🔄 Fetching steps for module:', moduleId)
    setStepsLoading(true)
    setStepsError(null)

    const stepsEndpoint = API_ENDPOINTS.STEPS(moduleId)
    console.log('📡 Steps endpoint:', stepsEndpoint)

    // Force fresh fetch with cache-busting
    const freshUrl = `${stepsEndpoint}?t=${Date.now()}`
    console.log('📡 Fresh URL:', freshUrl)

    console.log('🔄 Starting API call to:', freshUrl)
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 10000)
    })
    
    Promise.race([
      api(freshUrl),
      timeoutPromise
    ])
      .then(data => {
        console.log('📋 Steps data received:', data)
        console.log('📋 Steps array:', data.steps)
        setSteps(data.steps || [])
      })
      .catch(err => {
        console.error('❌ Error fetching steps:', err)
        setStepsError(`Failed to load steps: ${err.message}`)
        setSteps([])
      })
      .finally(() => {
        console.log('✅ Steps loading finished')
        setStepsLoading(false)
      })
  }, [moduleId])

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return
    
    // Add user message
    setChatHistory(prev => [...prev, { type: 'user', message: chatMessage }])
    
    // Simulate AI response (replace with real API call)
    setTimeout(() => {
      setChatHistory(prev => [...prev, { 
        type: 'assistant', 
        message: "I understand your question. This feature is coming soon - for now, you can watch the video and follow along with the training steps."
      }])
    }, 1000)
    
    setChatMessage('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage()
    }
  }

  const handleLoadSteps = async () => {
    if (!moduleId) return
    
    setStepsLoading(true)
    setStepsError(null)
    
    try {
      const data = await api(API_ENDPOINTS.STEPS(moduleId))
      setSteps(data.steps || [])
    } catch (err) {
      console.error('Error loading steps:', err)
      setStepsError('Failed to load steps')
    } finally {
      setStepsLoading(false)
    }
  }

  const handleProcessWithAI = async () => {
    if (!moduleId) return
    
    setProcessingAI(true)
    try {
      // This would call the AI processing endpoint
      console.log('🤖 AI processing requested for module:', moduleId)
      // TODO: Implement actual AI processing
      setTimeout(() => {
        setProcessingAI(false)
      }, 2000)
    } catch (err) {
      console.error('AI processing error:', err)
      setProcessingAI(false)
    }
  }

  console.log('🎬 TrainingPage render state:', {
    moduleId,
    url,
    loading,
    error,
    steps: steps.length,
    stepsLoading,
    stepsError
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Training: {moduleId}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Player */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="aspect-video bg-black rounded-2xl flex items-center justify-center text-white">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 mx-auto animate-spin text-2xl">⏳</div>
                <p className="text-lg">Loading video...</p>
              </div>
            </div>
          ) : error ? (
            <div className="aspect-video bg-black rounded-2xl flex items-center justify-center text-red-400">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 mx-auto text-2xl">⚠️</div>
                <div>
                  <p className="text-lg font-semibold">Video Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            </div>
          ) : url ? (
            <video controls src={url} className="w-full rounded-2xl shadow-sm" ref={videoRef} />
          ) : (
            <div className="aspect-video bg-black rounded-2xl flex items-center justify-center text-white">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 mx-auto text-2xl">📹</div>
                <div>
                  <p className="text-lg font-semibold">Video Unavailable</p>
                  <p className="text-sm text-gray-400">Please check that the module exists and try again</p>
                </div>
              </div>
            </div>
          )}

          {/* Steps Display */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">📋 Training Steps</h2>
            </div>
            
            {/* Simplified conditional rendering for debugging */}
            {stepsLoading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 mx-auto animate-spin text-blue-600">⏳</div>
                <p className="text-gray-600 mt-2">Loading steps... Module ID: {moduleId}</p>
              </div>
            ) : stepsError ? (
              <div className="text-center py-8">
                <div className="text-red-500 mb-2">⚠️</div>
                <p className="text-red-600">{stepsError}</p>
                <button
                  onClick={handleProcessWithAI}
                  disabled={processingAI}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg"
                >
                  {processingAI ? '🤖 Processing...' : '🤖 Try AI Processing'}
                </button>
              </div>
            ) : steps && steps.length > 0 ? (
              <div className="space-y-4">
                <div className="text-sm text-gray-500 mb-2">
                  Found {steps.length} steps for this training
                </div>

                {/* Feedback Widgets */}
                <div className="flex gap-2 mb-4">
                  <StepGenerationFeedback 
                    moduleId={moduleId}
                    context={`${steps.length} steps generated`}
                    showImmediately={true}
                    className="text-xs"
                  />
                  <TranscriptionFeedback 
                    moduleId={moduleId}
                    context="Video transcription and step generation"
                    showImmediately={true}
                    className="text-xs"
                  />
                </div>
                
                <div className="bg-blue-50 p-3 rounded-lg mb-4">
                  <div className="text-xs text-blue-800">
                    <strong>Steps Summary:</strong> {steps.length} total steps
                    {steps.map((step, index) => (
                      <div key={index} className="ml-2 mt-1">
                        • Step {index + 1}: {step.title} ({step.duration}s)
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 mb-4">
                  <span className="text-xs text-gray-500 self-center">
                    Current: {steps.length} steps
                  </span>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="text-xs text-yellow-800">
                    <strong>💡 Inline Editing Available:</strong> Click "✏️ Edit" on any step to edit it directly while watching the video. Add aliases and AI hints to improve the training experience.
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-4 border rounded-lg p-4">
                  {steps.map((step, index) => (
                    <div 
                      key={index} 
                      className={`bg-white p-4 rounded-lg border shadow-sm transition-all hover:shadow-md ${
                        currentStepIndex === index 
                          ? 'ring-2 ring-blue-500 bg-blue-50' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                          currentStepIndex === index 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          Step {index + 1}
                        </span>
                        <span className="text-gray-500 text-sm">
                          {Math.floor(step.timestamp / 60)}:{(step.timestamp % 60).toString().padStart(2, '0')}
                        </span>
                        {currentStepIndex === index && (
                          <span className="text-blue-600 text-xs">▶️ Playing</span>
                        )}
                        <div className="ml-auto flex gap-2">
                          <button
                            onClick={() => handleStepClick(step, index)}
                            className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded"
                          >
                            ▶️ Seek
                          </button>
                          <button
                            onClick={() => handleEditStep(index)}
                            className="text-gray-600 hover:text-gray-800 text-xs px-2 py-1 rounded"
                          >
                            ✏️ Edit
                          </button>
                        </div>
                      </div>

                      {editingStepIndex === index ? (
                        <InlineStepEditor
                          step={convertStepToStepData(step)}
                          onSave={(updatedStep) => {
                            const newSteps = [...editedSteps]
                            newSteps[index] = {
                              ...newSteps[index],
                              title: updatedStep.title,
                              description: updatedStep.description,
                              timestamp: updatedStep.start,
                              duration: updatedStep.end - updatedStep.start,
                              aliases: updatedStep.aliases,
                              notes: updatedStep.notes
                            }
                            setEditedSteps(newSteps)
                            handleSaveStep(index)
                          }}
                          onCancel={handleCancelEdit}
                          onAIRewrite={() => handleAIRewrite(index)}
                        />
                      ) : (
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                          <p className="text-gray-600 text-sm">{step.description}</p>
                          {step.aliases && (
                            <p className="text-xs text-gray-500 italic mt-1">🧠 Aliases: {step.aliases.join(', ')}</p>
                          )}
                          {step.notes && (
                            <p className="text-xs text-gray-500 italic">🛠️ Notes: {step.notes}</p>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            Duration: {step.duration}s
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">📝</div>
                <p className="text-gray-600">No steps available for this training</p>
                <div className="text-xs text-gray-400 mt-2">
                  Debug: moduleId={moduleId}, url={url ? 'loaded' : 'not loaded'}, steps={steps.length}
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleLoadSteps}
                    disabled={stepsLoading}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    {stepsLoading ? '⏳ Loading...' : '📋 Load Steps'}
                  </button>
                  <button
                    onClick={handleProcessWithAI}
                    disabled={processingAI}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    {processingAI ? '🤖 Processing...' : '🤖 Generate Steps with AI'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Assistant Chat */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border flex flex-col h-[500px]">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🤖 AI Assistant</h3>
          
          {/* Chat History */}
          <div className="flex-1 space-y-4 overflow-y-auto mb-4">
            {chatHistory.map((chat, index) => (
              <div key={index} className={`flex ${chat.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs p-3 rounded-lg ${
                  chat.type === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  <p className="text-sm">{chat.message}</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Chat Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question..."
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSendMessage}
              className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              📤
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 