import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useSignedVideoUrl } from '../hooks/useSignedVideoUrl'
import { api, API_ENDPOINTS } from '../config/api'

interface Step {
  timestamp: number
  title: string
  description: string
  duration?: number
}

export const TrainingPage: React.FC = () => {
  const { moduleId } = useParams()
  const filename = moduleId ? `${moduleId}.mp4` : undefined
  const { url, loading, error } = useSignedVideoUrl(filename)
  
  const [steps, setSteps] = useState<Step[]>([])
  const [stepsLoading, setStepsLoading] = useState(false)
  const [stepsError, setStepsError] = useState<string | null>(null)
  const [processingAI, setProcessingAI] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [chatHistory, setChatHistory] = useState([
    {
      type: 'assistant',
      message: "Hi! I'm here to help you with this training. Ask me anything about the current step or the overall process."
    }
  ])

  // Fetch steps when video URL is ready
  useEffect(() => {
    if (!moduleId || !url) {
      console.log('🔄 Skipping steps fetch:', { moduleId, url })
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

    api(freshUrl)
      .then(data => {
        console.log('📋 Steps data received:', data)
        console.log('📋 Steps array:', data.steps)
        setSteps(data.steps || [])
      })
      .catch(err => {
        console.error('❌ Error fetching steps:', err)
        setStepsError('Failed to load steps')
        setSteps([])
      })
      .finally(() => {
        console.log('✅ Steps loading finished')
        setStepsLoading(false)
      })
  }, [moduleId, url])

  const handleRefreshSteps = async () => {
    if (!moduleId) return
    
    console.log('🔄 Manually refreshing steps for module:', moduleId)
    setStepsLoading(true)
    setStepsError(null)

    try {
      const freshUrl = `${API_ENDPOINTS.STEPS(moduleId)}?t=${Date.now()}`
      const data = await api(freshUrl)
      console.log('📋 Refreshed steps data:', data)
      setSteps(data.steps || [])
    } catch (err) {
      console.error('❌ Error refreshing steps:', err)
      setStepsError('Failed to refresh steps')
    } finally {
      setStepsLoading(false)
    }
  }

  const handleLoadSteps = async () => {
    if (!moduleId) return
    
    console.log('🔄 Manually loading steps for module:', moduleId)
    setStepsLoading(true)
    setStepsError(null)

    try {
      const freshUrl = `${API_ENDPOINTS.STEPS(moduleId)}?t=${Date.now()}`
      console.log('📡 Loading from URL:', freshUrl)
      const data = await api(freshUrl)
      console.log('📋 Loaded steps data:', data)
      console.log('📋 Steps array length:', data.steps?.length || 0)
      setSteps(data.steps || [])
    } catch (err) {
      console.error('❌ Error loading steps:', err)
      setStepsError('Failed to load steps')
      setSteps([])
    } finally {
      setStepsLoading(false)
    }
  }

  const handleProcessWithAI = async () => {
    if (!moduleId) return
    
    console.log('🤖 Starting AI processing for module:', moduleId)
    setProcessingAI(true)
    try {
      const response = await api(`/api/ai/process-video/${moduleId}`, {
        method: 'POST',
      })
      
      console.log('🤖 AI processing response:', response)
      
      if (response.success && response.steps) {
        console.log('🤖 Setting new steps:', response.steps)
        setSteps(response.steps)
        setStepsError(null)
      }
    } catch (err) {
      console.error('❌ AI processing error:', err)
      setStepsError('Failed to process video with AI')
    } finally {
      setProcessingAI(false)
    }
  }

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

  console.log('🎬 TrainingPage render state:', {
    moduleId,
    url,
    loading,
    error,
    steps: steps.length,
    stepsLoading,
    stepsError,
    processingAI
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
            <video controls src={url} className="w-full rounded-2xl shadow-sm" />
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
          {url && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">📋 Training Steps</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleRefreshSteps}
                    disabled={stepsLoading}
                    className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-sm"
                  >
                    {stepsLoading ? '⏳' : '🔄'}
                  </button>
                  {steps.length === 0 && !stepsLoading && (
                    <button
                      onClick={handleProcessWithAI}
                      disabled={processingAI}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm"
                    >
                      {processingAI ? '🤖 Processing...' : '🤖 Generate Steps with AI'}
                    </button>
                  )}
                </div>
              </div>
              
              {stepsLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 mx-auto animate-spin text-blue-600">⏳</div>
                  <p className="text-gray-600 mt-2">Loading steps...</p>
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
              ) : steps.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-500 mb-2">
                    Found {steps.length} steps for this training
                  </div>
                  {steps.map((step, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                          Step {index + 1}
                        </span>
                        <span className="text-gray-500 text-sm">
                          {Math.floor(step.timestamp / 60)}:{(step.timestamp % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                      <p className="text-gray-600 text-sm">{step.description}</p>
                    </div>
                  ))}
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
          )}
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