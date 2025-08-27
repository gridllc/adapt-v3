import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { api, API_ENDPOINTS } from '../config/api'
import { AddStepForm } from '../components/AddStepForm'
import { StepEditor } from '../components/StepEditor'
import { FeedbackSection } from '../components/FeedbackSection'
import { ProcessingScreen } from '../components/ProcessingScreen'
import QRCodeGenerator from '../components/QRCodeGenerator'
import { useVoiceCoach } from '../voice/useVoiceCoach'

interface Step {
  id: string
  start: number
  end: number
  title: string
  description: string
  aliases?: string[]
  notes?: string
  isManual?: boolean
  originalText?: string  // Original transcript text
  aiRewrite?: string     // AI-rewritten version
  stepText?: string      // Currently displayed text (original or rewritten)
}

interface ChatMessage {
  type: 'user' | 'assistant'
  message: string
  isTyping?: boolean
}

export const TrainingPage: React.FC = () => {
  const { moduleId } = useParams()
  const [searchParams] = useSearchParams()
  const isProcessing = searchParams.get('processing') === 'true'
  // Video URL by module ID
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!moduleId) return
    fetch(`/api/video-url/module/${moduleId}`)
      .then(r => r.json())
      .then(d => setVideoUrl(d.url))
      .catch(e => console.error('Video URL fetch failed', e))
  }, [moduleId])

  // Module status polling (5-10s intervals for real-time updates)
  const [status, setStatus] = useState<any>(null)
  useEffect(() => {
    if (!moduleId) return
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/modules/${moduleId}`)
        const data = await r.json()
        setStatus(data.module)

        // If status changed to READY or FAILED, trigger steps reload
        if (data.module?.status === 'READY' || data.module?.status === 'FAILED') {
          console.log('Status changed, triggering steps reload:', data.module.status)
          setRetryCount(0)
          setHasTriedOnce(false)
        }
      } catch (e) {
        console.error('Status fetch failed', e)
      }
    }, 5000) // Poll every 5 seconds for better responsiveness
    return () => clearInterval(interval)
  }, [moduleId])
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const chatHistoryRef = useRef<HTMLDivElement>(null)
  
  const [steps, setSteps] = useState<Step[]>([])
  const [stepsLoading, setStepsLoading] = useState(false)
  const [stepsError, setStepsError] = useState<string | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [hasTriedOnce, setHasTriedOnce] = useState(false)
  const [isFallback, setIsFallback] = useState(false)
  const maxRetries = 5

  const [chatMessage, setChatMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      type: 'assistant',
      message: "Hi! I'm here to help you with this training. Ask me anything about the current step or the overall process."
    }
  ])

  const [processingAI, setProcessingAI] = useState(false)
  const [videoTime, setVideoTime] = useState(0)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)

  // 🎯 FETCH MODULE DATA FOR TITLE
  const [moduleData, setModuleData] = useState<any>(null)
  const [moduleDataLoading, setModuleDataLoading] = useState(false)


  // Video seeking function
  const seekToTime = (timeInSeconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeInSeconds
      videoRef.current.play()
      console.log(`🎬 Seeking to ${timeInSeconds}s`)
    }
  }

  // Voice coach hook
  const voice = useVoiceCoach({
    steps,
    currentIndex: currentStepIndex || 0,
    setCurrentIndex: setCurrentStepIndex,
    seekTo: seekToTime,
    pause: () => videoRef.current?.pause(),
    play: () => videoRef.current?.play(),
  });

  // Video event handlers for smart sync
  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setVideoTime(videoRef.current.currentTime)
    }
  }

  const handleVideoPlay = () => {
    setIsVideoPlaying(true)
  }

  const handleVideoPause = () => {
    setIsVideoPlaying(false)
  }

  // Auto-highlight current step based on video time
  const getCurrentStepIndex = (): number | null => {
    if (steps.length === 0) return null
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const stepStart = step.start
      const stepEnd = step.end
      
      if (videoTime >= stepStart && videoTime < stepEnd) {
        return i
      }
    }
    
    return null
  }

  // Handle step updates
  const handleStepUpdate = (index: number, updatedStep: Step) => {
    const newSteps = [...steps]
    newSteps[index] = updatedStep
    setSteps(newSteps)
  }

  const handleStepDelete = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index)
    setSteps(newSteps)
  }

  const handleAddStep = (newStep: Step) => {
    setSteps(prev => [...prev, newStep])
  }

  // Step reordering functions
  const handleMoveStepUp = async (index: number) => {
    if (index === 0) return // Can't move first step up
    
    const newSteps = [...steps]
    const [movedStep] = newSteps.splice(index, 1)
    newSteps.splice(index - 1, 0, movedStep)
    
    setSteps(newSteps)
    
    // Save reordered steps to backend
    try {
      await api(API_ENDPOINTS.STEPS(moduleId || ''), {
        method: 'POST',
        body: JSON.stringify({ 
          steps: newSteps,
          action: 'reorder'
        }),
      })
    } catch (error) {
      console.error('Failed to save reordered steps:', error)
      // Revert on error
      setSteps(steps)
    }
  }

  const handleMoveStepDown = async (index: number) => {
    if (index === steps.length - 1) return // Can't move last step down
    
    const newSteps = [...steps]
    const [movedStep] = newSteps.splice(index, 1)
    newSteps.splice(index + 1, 0, movedStep)
    
    setSteps(newSteps)
    
    // Save reordered steps to backend
    try {
      await api(API_ENDPOINTS.STEPS(moduleId || ''), {
        method: 'POST',
        body: JSON.stringify({ 
          steps: newSteps,
          action: 'reorder'
        }),
      })
    } catch (error) {
      console.error('Failed to save reordered steps:', error)
      // Revert on error
      setSteps(steps)
    }
  }

  // 🎯 FETCH MODULE DATA FOR TITLE
  useEffect(() => {
    if (!moduleId) return
    
    const fetchModuleData = async () => {
      setModuleDataLoading(true)
      try {
        const response = await fetch(`/api/modules/${moduleId}`)
        const data = await response.json()
        if (data.success) {
          setModuleData(data.module)
        }
      } catch (error) {
        console.error('Failed to fetch module data:', error)
      } finally {
        setModuleDataLoading(false)
      }
    }
    
    fetchModuleData()
  }, [moduleId])

  // Handle seek parameter from URL
  useEffect(() => {
    const seekTime = searchParams.get('seek')
    if (seekTime && videoRef.current && videoUrl) {
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
  }, [videoUrl, searchParams])

  // Fetch steps when video URL is ready AND module is ready
  useEffect(() => {
    if (!moduleId) return

    // Don't fetch steps if module is still processing
    if (status && status.status === 'PROCESSING') {
      console.log(`⏳ Module ${moduleId} still processing, waiting for completion...`)
      return
    }

    // If processing failed, don't auto-retry - let user manually retry
    if (status && status.status === 'FAILED') {
      console.log(`❌ Module ${moduleId} failed - waiting for manual retry`)
      return
    }

    // Prevent auto-retries after refresh unless user manually retries
    if (hasTriedOnce && retryCount === 0) {
      console.log(`🔄 Skipping auto-retry for ${moduleId} - already tried once`)
      return
    }

    const fetchSteps = async () => {
      console.log(`[AI DEBUG] Attempting to fetch steps for ${moduleId}, retry ${retryCount}`)
      setStepsLoading(true)
      setStepsError(null)
      try {
        const freshUrl = `${API_ENDPOINTS.STEPS(moduleId)}?t=${Date.now()}`
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 10000))
        const data = await Promise.race([api(freshUrl), timeoutPromise])
        
        if (!data.steps || data.steps.length === 0) {
          // If no steps and module is ready, this might be an error
          if (status && status.status === 'READY') {
            throw new Error('Steps not found - module processing may have failed')
          } else if (status && status.status === 'FAILED') {
            throw new Error(`Processing failed: ${status.errorMessage || 'Unknown error'}`)
          } else {
            throw new Error('Steps not ready yet - module still processing')
          }
        }
        
        console.log(`✅ Successfully loaded ${data.steps.length} steps for ${moduleId}`)
        
        // Load transcript and meta data if available
        if (data.transcript) {
          console.log(`📝 Transcript loaded: ${data.transcript.length} characters`)
        }
        if (data.meta) {
          console.log(`📊 Meta data loaded:`, data.meta)
        }

        // Check if these are fallback steps
        const isFallbackResponse = !!data?.meta?.source && data.meta.source.startsWith('fallback')
        setIsFallback(isFallbackResponse)

        // Enhance steps with transcript and duration info
        const enhancedSteps = data.steps.map((step: any, index: number) => ({
          ...step,
          originalText: data.transcript || '', // Add transcript to each step
          duration: data.meta?.durationSec ? Math.round(data.meta.durationSec / data.steps.length) : 15 // Calculate step duration
        }))

        setSteps(enhancedSteps)
        setRetryCount(0)
        setHasTriedOnce(true)
      } catch (err: any) {
        console.error(`❌ Error fetching steps for ${moduleId}:`, err)
        if (retryCount < maxRetries) {
          console.warn(`🔄 Retry ${retryCount + 1}/${maxRetries} for ${moduleId}...`)
          setTimeout(() => setRetryCount(prev => prev + 1), 2000)
        } else {
          console.error(`💥 Max retries reached for ${moduleId}`)
          setStepsError('Failed to load steps after multiple attempts')
          setSteps([])
          setHasTriedOnce(true)
        }
      } finally {
        setStepsLoading(false)
      }
    }

    fetchSteps()
  }, [moduleId, retryCount, status?.status, hasTriedOnce]) // Added hasTriedOnce as dependency

  const handleProcessWithAI = async () => {
    if (!moduleId) return

    console.log(`[AI DEBUG] Processing AI steps for ${moduleId}`)
    setProcessingAI(true)
    setStepsError(null) // Clear any previous errors

    try {
      console.log('🤖 AI processing requested for module:', moduleId)

      // Call the steps generation endpoint
      const result = await api(`/api/steps/generate/${moduleId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('✅ AI processing started:', result)

      // The pipeline will update status automatically via polling
      // No need to manually trigger reloads - polling will handle it

    } catch (err) {
      console.error('❌ AI processing error:', err)
      setStepsError(`AI processing failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setProcessingAI(false)
    }
  }

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return
    
    const userMessage = chatMessage.trim()
    
    // Add user message
    setChatHistory(prev => [...prev, { type: 'user', message: userMessage }])
    setChatMessage('')
    
    // Show typing indicator
    setChatHistory(prev => [...prev, { type: 'assistant', message: '...', isTyping: true }])
    
    try {
      // Get current step context
      const currentStep = currentStepIndex !== null ? steps[currentStepIndex] : null
      const stepContext = currentStep ? {
        stepNumber: currentStepIndex! + 1,
        title: currentStep.title,
        description: currentStep.description,
        start: currentStep.start,
        end: currentStep.end,
        aliases: currentStep.aliases,
        notes: currentStep.notes
      } : null
      
      // Generate AI response based on context
      const aiResponse = await generateAIResponse(userMessage, stepContext, steps)
      
      // Remove typing indicator and add real response
      setChatHistory(prev => prev.filter(msg => !msg.isTyping))
      setChatHistory(prev => [...prev, { type: 'assistant', message: aiResponse }])
    } catch (error) {
      console.error('AI response error:', error)
      // Remove typing indicator and add error response
      setChatHistory(prev => prev.filter(msg => !msg.isTyping))
      setChatHistory(prev => [...prev, { 
        type: 'assistant', 
        message: "I'm having trouble processing your request right now. Please try again in a moment." 
      }])
    }
  }

  const generateAIResponse = async (userMessage: string, currentStep: any, allSteps: Step[]) => {
    // Use the enhanced contextual AI service
    try {
      const data = await api(API_ENDPOINTS.AI_CONTEXTUAL_RESPONSE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage,
          currentStep,
          allSteps,
          videoTime,
          moduleId
        }),
      })

      return data.response || 'I apologize, but I\'m having trouble processing your request right now.'
    } catch (error) {
      console.error('AI response generation error:', error)
      return generateFallbackResponse(userMessage, currentStep, allSteps)
    }
  }

  const generateFallbackResponse = (userMessage: string, currentStep: any, allSteps: Step[]) => {
    // Simple AI response logic based on keywords and context
    const message = userMessage.toLowerCase()
    
    // Current step questions
    if (currentStep && (message.includes('current step') || message.includes('this step') || message.includes('what step'))) {
      return `You're currently on **Step ${currentStep.stepNumber}**: "${currentStep.title}". ${currentStep.description}`
    }
    
    // Step navigation
    if (message.includes('next step') || message.includes('previous step')) {
      const totalSteps = allSteps.length
      if (currentStep) {
        if (message.includes('next') && currentStep.stepNumber < totalSteps) {
          return `The next step is **Step ${currentStep.stepNumber + 1}**: "${allSteps[currentStep.stepNumber].title}". Click the "▶️ Seek" button to jump to it!`
        } else if (message.includes('previous') && currentStep.stepNumber > 1) {
          return `The previous step was **Step ${currentStep.stepNumber - 1}**: "${allSteps[currentStep.stepNumber - 2].title}". You can click "▶️ Seek" on any step to navigate.`
        }
      }
      return "You can click the '▶️ Seek' button on any step to navigate to it, or use the video controls to move around."
    }
    
    // Step count and overview
    if (message.includes('how many steps') || message.includes('total steps') || message.includes('overview')) {
      return `This training has **${allSteps.length} steps** total. You can see all steps listed below the video. Each step is clickable and will seek to that part of the video.`
    }
    
    // Editing help
    if (message.includes('edit') || message.includes('change') || message.includes('modify')) {
      return `To edit a step, click the "✏️ Edit" button on any step. You can modify the title, description, timing, aliases, and AI teaching notes. Changes auto-save as you type!`
    }
    
    // AI rewrite help
    if (message.includes('ai rewrite') || message.includes('rewrite') || message.includes('improve')) {
      return `Use the "✨ Rewrite" button in the editor to improve your step title. It will make it clearer, fix grammar, and add helpful details when needed - all while keeping it human and easy to understand!`
    }
    
    // Timing questions
    if (message.includes('time') || message.includes('duration') || message.includes('how long')) {
      if (currentStep) {
        const minutes = Math.floor(currentStep.timestamp / 60)
        const seconds = currentStep.timestamp % 60
        return `Step ${currentStep.stepNumber} starts at ${minutes}:${seconds.toString().padStart(2, '0')} and lasts ${currentStep.duration} seconds.`
      }
      return "Each step has specific timing. You can see the timestamp on each step, and click '▶️ Seek' to jump to that exact moment in the video."
    }
    
    // General help
    if (message.includes('help') || message.includes('how to') || message.includes('what can')) {
      return `I can help you with:
• **Navigation**: Ask about current, next, or previous steps
• **Editing**: Learn how to modify steps and use AI rewrite
• **Overview**: Get information about the training structure
• **Timing**: Find out when steps occur in the video

Just ask me anything about the training!`
    }
    
    // Default response
    return `I understand you're asking about "${userMessage}". I can help with step navigation, editing, timing, and general questions about this training. What would you like to know?`
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage()
    }
  }

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
    }
  }

  // Auto-scroll when chat history changes
  useEffect(() => {
    scrollToBottom()
  }, [chatHistory])

  // Update current step index when video time changes
  useEffect(() => {
    setCurrentStepIndex(getCurrentStepIndex())
  }, [videoTime, steps])

  console.log('🎬 TrainingPage render state:', {
    moduleId,
    videoUrl,
    status,
    steps: steps.length,
    stepsLoading,
    stepsError
  })

  // Show processing screen if module is still being processed
  if (isProcessing && (!status || status.status === 'processing')) {
    return (
      <ProcessingScreen 
        progress={status?.progress || 0} 
        message={status?.message}
        stuckAtZero={false}
        timeoutReached={false}
      />
    )
  }

  // Show error screen if processing failed
  if (status && status.status === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">
            Processing Failed
          </h2>
          <p className="text-gray-600 mb-4">{status.error || 'An error occurred during processing'}</p>
          <button 
            onClick={() => window.location.href = '/upload'}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-8">
              <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/upload" 
              className="text-blue-600 hover:text-blue-800 transition-colors"
            >
              ← Back to Upload
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              Training: {moduleDataLoading ? (
                <span className="text-gray-500">Loading...</span>
              ) : (
                moduleData?.title || moduleId
              )}
            </h1>
          </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Player */}
        <div className="lg:col-span-2">
          {!videoUrl ? (
            <div className="aspect-video bg-black rounded-2xl flex items-center justify-center text-white">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 mx-auto animate-spin text-2xl">⏳</div>
                <p className="text-lg">Loading video...</p>
              </div>
            </div>
          ) : false ? (
            <div className="aspect-video bg-black rounded-2xl flex items-center justify-center text-red-400">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 mx-auto text-2xl">⚠️</div>
                <div>
                  <p className="text-lg font-semibold">Video Error</p>
                  <p className="text-sm">Failed to load video</p>
                </div>
              </div>
            </div>
          ) : videoUrl ? (
            <video 
              key={videoUrl}  // Force re-render when URL changes
              controls 
              playsInline  // Better mobile compatibility
              preload="metadata"  // Load metadata for seeking
              crossOrigin="anonymous"  // Handle CORS properly
              className="w-full rounded-2xl shadow-sm" 
              ref={videoRef} 
              onTimeUpdate={handleVideoTimeUpdate}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
            >
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
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
            {stepsLoading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 mx-auto animate-spin text-blue-600">⏳</div>
                <p className="text-gray-600 mt-2">Loading steps... Module ID: {moduleId}</p>
                
                {/* Prominent AI Processing Message */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 mt-6 shadow-sm">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <div className="text-2xl animate-pulse">⏳</div>
                    <h3 className="text-lg font-bold text-blue-800">AI Processing in Progress</h3>
                  </div>
                  <p className="text-base text-blue-700 font-medium">
                    Give it a sec… your AI is being born. It can take up to 2 minutes to grow a brain.
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-2 text-sm text-blue-600">
                    <span className="animate-spin">🔄</span>
                    <span>Generating training steps and analyzing video content...</span>
                  </div>
                </div>
              </div>
            ) : stepsError ? (
              <div className="text-center py-8">
                <div className="text-red-500 mb-2">⚠️</div>
                <p className="text-red-600">{stepsError}</p>

                <div className="mt-4 flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      setRetryCount(0)
                      setHasTriedOnce(false) // Reset to allow fresh attempt
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                  >
                    🔁 Retry Loading Steps
                  </button>
                  <button
                    onClick={handleProcessWithAI}
                    disabled={processingAI || status?.status === 'processing'}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg"
                  >
                    🤖 Re-run AI Step Detection
                  </button>
                  
                  {/* Voice Controls */}
                  {import.meta.env.VITE_ENABLE_VOICE === 'true' && (
                    <div className="flex gap-2 mt-3">
                      <button
                        disabled={!voice.sttAvailable}
                        onClick={voice.listening ? voice.stop : voice.start}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          voice.listening 
                            ? 'bg-red-600 hover:bg-red-700 text-white' 
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={voice.listening ? 'Stop listening' : 'Start voice commands'}
                      >
                        {voice.listening ? '🎤 Stop' : '🎤 Voice Coach'}
                      </button>
                      
                      <button 
                        onClick={() => voice.speak(`You are on step ${(currentStepIndex || 0) + 1}`)}
                        disabled={!voice.ttsAvailable}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:cursor-not-allowed"
                        title="Read current step"
                      >
                        🔊 Read Step
                      </button>
                      
                      {voice.lastText && (
                        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          Last: "{voice.lastText}"
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {processingAI && (
                  <p className="text-sm text-blue-600 mt-2 animate-pulse">
                    ⏳ AI is working... give it a sec, it's growing a brain.
                  </p>
                )}
              </div>
            ) : steps && steps.length > 0 ? (
              <div className="space-y-4">
                {/* Transcript Display */}
                {steps[0]?.originalText && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      📝 <span>Video Transcript</span>
                      <span className="text-xs text-gray-500 font-normal">
                        ({steps[0].originalText.length} characters)
                      </span>
                    </h3>
                    <div className="text-sm text-gray-600 max-h-32 overflow-y-auto">
                      {steps[0].originalText}
                    </div>
                  </div>
                )}

                {/* Show transcribe button only for fallback steps when not processing/failed */}
                {isFallback && status?.status !== 'PROCESSING' && status?.status !== 'FAILED' && (
                  <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-amber-900">
                        ⚠️ You’re viewing placeholder steps. Run the AI pipeline to transcribe the video
                        and generate real steps.
                      </div>
                      <button
                        onClick={handleProcessWithAI}
                        disabled={processingAI}
                        className="ml-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        Transcribe now
                      </button>
                    </div>
                  </div>
                )}

                {/* Show processing status */}
                {status?.status === 'PROCESSING' && (
                  <div className="mb-4 rounded-xl border border-blue-300 bg-blue-50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-blue-900">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="animate-spin text-xl">⏳</div>
                          <span className="font-medium">AI Processing in Progress</span>
                        </div>
                        <div className="text-sm text-blue-700">
                          {status.message || 'Generating training steps...'} ({status.progress || 0}%)
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show error status with retry */}
                {status?.status === 'FAILED' && (
                  <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-red-900">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-xl">❌</div>
                          <span className="font-medium">Processing Failed</span>
                        </div>
                        <div className="text-sm text-red-700">
                          {status.lastError || 'An error occurred during processing'}
                        </div>
                      </div>
                      <button
                        onClick={handleProcessWithAI}
                        disabled={processingAI}
                        className="ml-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        Retry Processing
                      </button>
                    </div>
                  </div>
                )}

                {steps.map((step, index) => (
                  <StepEditor
                    key={step.id || index}
                    step={step}
                    stepIndex={index + 1}
                    moduleId={moduleId || ''}
                    onUpdate={(updatedStep) => handleStepUpdate(index, updatedStep)}
                    onDelete={() => handleStepDelete(index)}
                    onMoveUp={() => handleMoveStepUp(index)}
                    onMoveDown={() => handleMoveStepDown(index)}
                    isCurrentStep={currentStepIndex === index}
                    isVideoPlaying={isVideoPlaying}
                    onSeek={seekToTime}
                    canMoveUp={index > 0}
                    canMoveDown={index < steps.length - 1}
                    showRewrite={false}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">📝</div>
                <p className="text-gray-600">No steps available for this training</p>
                
                {/* Debug info for developers */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-gray-400 mt-2">
                    Debug: moduleId={moduleId}, videoUrl={videoUrl ? 'loaded' : 'not loaded'}, steps={steps.length}, hasTriedOnce={hasTriedOnce.toString()}
                  </div>
                )}
                
                <div className="mt-4 flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      setRetryCount(0)
                      setHasTriedOnce(false) // Reset to allow fresh attempt
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    🔁 Retry Loading Steps
                  </button>
                  <button
                    onClick={handleProcessWithAI}
                    disabled={processingAI || status?.status === 'processing'}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    🤖 Generate Steps with AI
                  </button>
                </div>
                
                {processingAI && (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 mt-4 shadow-sm">
                    <div className="flex items-center justify-center gap-3 mb-3">
                      <div className="text-2xl animate-pulse">⏳</div>
                      <h3 className="text-lg font-bold text-blue-800">AI Processing in Progress</h3>
                    </div>
                    <p className="text-base text-blue-700 font-medium">
                      Give it a sec… your AI is being born. It can take up to 2 minutes to grow a brain.
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-2 text-sm text-blue-600">
                      <span className="animate-spin">🔄</span>
                      <span>Generating training steps and analyzing video content...</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Add Step Form - Now at the bottom */}
            <AddStepForm 
              moduleId={moduleId || ''} 
              onAdd={handleAddStep}
              currentVideoTime={videoTime}
            />
          </div>

          {/* Feedback Section */}
          {steps.length > 0 && (
            <FeedbackSection 
              moduleId={moduleId || ''} 
              stepsCount={steps.length}
            />
          )}
        </div>

        {/* AI Assistant Chat */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border flex flex-col h-[500px]">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🤖 AI Assistant</h3>
          
          {/* Suggested Questions */}
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-1">
              {[
                "What step am I on?",
                "How many steps?",
                "How to edit?",
                "Next step?"
              ].map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setChatMessage(suggestion)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
          
          {/* Chat History */}
          <div 
            className="flex-1 space-y-4 overflow-y-auto mb-4 scroll-smooth" 
            ref={chatHistoryRef}
            style={{ scrollBehavior: 'smooth' }}
          >
            {chatHistory.map((chat, index) => (
              <div key={index} className={`flex ${chat.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs p-3 rounded-lg ${
                  chat.type === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  <p className="text-sm">
                    {chat.isTyping ? (
                      <span className="flex items-center gap-1">
                        <span className="animate-pulse">...</span>
                        <span className="text-xs">AI is typing</span>
                      </span>
                    ) : (
                      chat.message
                    )}
                  </p>
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