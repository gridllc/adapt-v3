import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useSignedVideoUrl } from '../hooks/useSignedVideoUrl'
import { useModuleStatus } from '../hooks/useModuleStatus'
import { useSteps, Step } from '../hooks/useSteps'
import { useStepIndexAtTime } from '../hooks/useStepIndexAtTime'
import { api, API_ENDPOINTS, DEBUG_UI } from '../config/api'
import { AddStepForm } from '../components/AddStepForm'
import { StepEditor } from '../components/StepEditor'
import { FeedbackSection } from '../components/FeedbackSection'
import { ProcessingScreen } from '../components/ProcessingScreen'
import QRCodeGenerator from '../components/QRCodeGenerator'
import { VoiceCoachOverlay } from '../components/voice/VoiceCoachOverlay'
import { VoiceCoachControls } from '../components/voice/VoiceCoachControls'
import { LoadingSpinner } from '../components/common/LoadingSpinner'

interface ChatMessage {
  type: 'user' | 'assistant'
  message: string
  isTyping?: boolean
}

export const TrainingPage: React.FC = () => {
  const { moduleId } = useParams()
  const [searchParams] = useSearchParams()
  const isProcessing = searchParams.get('processing') === 'true'
  const filename = moduleId ? `${moduleId}.mp4` : undefined
  const { url, loading, error } = useSignedVideoUrl(filename)
  
  // Use module status hook for processing state
  const { status, loading: statusLoading, error: statusError, stuckAtZero, timeoutReached } = useModuleStatus(moduleId || '', isProcessing)
  
  // Use the new useSteps hook with enhanced features
  const { 
    steps, 
    loading: stepsLoading, 
    error: stepsError, 
    reload: reloadSteps,
    reorder: reorderSteps,
    updateStep,
    deleteStep,
    addStep,
    getIndexAt,
    lastLoadedAt,
    nextRetryIn
  } = useSteps(moduleId, status)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const timeUpdateRaf = useRef<number | null>(null)
  
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null)
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
  const [showQRCode, setShowQRCode] = useState(false)
  const [showVoiceCoachOverlay, setShowVoiceCoachOverlay] = useState(false)

  // Efficient step tracking using binary search
  const getCurrentVideoTime = () => videoRef.current?.currentTime ?? 0
  const currentIdx = useStepIndexAtTime(getIndexAt, getCurrentVideoTime, Boolean(url))
  
  // Update local state when efficient tracking changes
  useEffect(() => {
    setCurrentStepIndex(currentIdx)
  }, [currentIdx])

  // Determine if we should show processing state
  const showProcessingState = isProcessing || (status && status.status === 'processing')
  const isReady = status && status.status === 'ready'
  const hasError = status && status.status === 'error'

  // Check if we should show voice coach overlay (when coming from upload)
  // Fixed: Show overlay when transitioning from processing to ready, not during processing
  const prevStatusRef = useRef(status?.status)
  useEffect(() => {
    if (prevStatusRef.current === 'processing' && status?.status === 'ready') {
      setShowVoiceCoachOverlay(true)
    }
    prevStatusRef.current = status?.status
  }, [status?.status])

  // Video seeking function
  const seekToTime = (timeInSeconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeInSeconds
      videoRef.current.play()
      console.log(`🎬 Seeking to ${timeInSeconds}s`)
    }
  }

  // Video event handlers with throttled time update
  const handleVideoTimeUpdate = () => {
    if (timeUpdateRaf.current) return
    timeUpdateRaf.current = requestAnimationFrame(() => {
      timeUpdateRaf.current = null
      if (videoRef.current) setVideoTime(videoRef.current.currentTime)
    })
  }

  const handleVideoPlay = () => {
    setIsVideoPlaying(true)
  }

  const handleVideoPause = () => {
    setIsVideoPlaying(false)
  }

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (timeUpdateRaf.current) {
        cancelAnimationFrame(timeUpdateRaf.current)
      }
    }
  }, [])

  // Handle step updates
  const handleStepUpdate = (index: number, updatedStep: Step) => {
    updateStep(index, updatedStep)
  }

  const handleStepDelete = (index: number) => {
    deleteStep(index)
  }

  const handleAddStep = (newStep: Step) => {
    addStep(newStep)
  }

  // Step reordering functions - now using the hook
  const handleMoveStepUp = async (index: number) => {
    if (index === 0) return
    try {
      await reorderSteps(index, index - 1)
    } catch (error) {
      console.error('Failed to move step up:', error)
    }
  }

  const handleMoveStepDown = async (index: number) => {
    if (index === steps.length - 1) return
    try {
      await reorderSteps(index, index + 1)
    } catch (error) {
      console.error('Failed to move step down:', error)
    }
  }

  // Handle seek parameter from URL with proper cleanup
  useEffect(() => {
    const seekTime = searchParams.get('seek')
    if (seekTime && videoRef.current && url) {
      const timeInSeconds = parseFloat(seekTime)
      if (!isNaN(timeInSeconds)) {
        const doSeek = () => seekToTime(timeInSeconds)
        
        // Wait for video to be ready, then seek
        const v = videoRef.current
        if (v.readyState >= 2) {
          doSeek()
        } else {
          v.addEventListener('canplay', doSeek, { once: true })
        }
        
        return () => v.removeEventListener('canplay', doSeek)
      }
    }
  }, [url, searchParams])

  const handleProcessWithAI = async () => {
    if (!moduleId) return
    
    console.log(`[AI DEBUG] Processing AI steps for ${moduleId}`)
    setProcessingAI(true)
    
    try {
      console.log('🤖 AI processing requested for module:', moduleId)
      
      // Call the steps generation endpoint
      const result = await api(`/api/steps/generate/${moduleId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      console.log('✅ AI processing completed:', result)
      
      // Reload steps after successful processing
      reloadSteps()
    } catch (err) {
      console.error('❌ AI processing error:', err)
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

  // Fixed fallback response logic with proper field access
  const generateFallbackResponse = (
    userMessage: string,
    currentStep: any,
    allSteps: Step[]
  ) => {
    const msg = userMessage.toLowerCase()
    const idx = currentStep ? steps.findIndex(s => s.id === currentStep.id) : -1

    if (currentStep && (msg.includes('current step') || msg.includes('this step') || msg.includes('what step'))) {
      return `You're currently on **Step ${idx + 1}**: "${currentStep.title}". ${currentStep.description}`
    }

    if (msg.includes('next step') || msg.includes('previous step')) {
      const total = allSteps.length
      if (idx >= 0) {
        if (msg.includes('next') && idx + 1 < total) {
          const nxt = allSteps[idx + 1]
          return `The next step is **Step ${idx + 2}**: "${nxt.title}". Click "▶️ Seek" on that step to jump to it.`
        } else if (msg.includes('previous') && idx - 1 >= 0) {
          const prev = allSteps[idx - 1]
          return `The previous step was **Step ${idx}**: "${prev.title}". You can click "▶️ Seek" on any step to navigate.`
        }
      }
      return `Use "▶️ Seek" on any step card to navigate, or the video controls.`
    }

    if (msg.includes('how many steps') || msg.includes('total steps') || msg.includes('overview')) {
      return `This training has **${allSteps.length} steps**. Each step is clickable and will seek to that part of the video.`
    }

    if (msg.includes('time') || msg.includes('duration') || msg.includes('how long')) {
      if (currentStep) {
        const start = Math.max(0, Math.floor(currentStep.start))
        const mins = Math.floor(start / 60)
        const secs = String(start % 60).padStart(2, '0')
        const dur = Math.max(0, Math.round(currentStep.end - currentStep.start))
        return `Step ${idx + 1} starts at ${mins}:${secs} and runs for ~${dur}s.`
      }
      return `Each step shows its timestamp; click "▶️ Seek" to jump to that moment.`
    }

    if (msg.includes('edit') || msg.includes('change') || msg.includes('modify')) {
      return `Click the "✏️ Edit" button on any step to modify title, description, timing, aliases, or notes—changes auto‑save.`
    }

    if (msg.includes('ai rewrite') || msg.includes('rewrite') || msg.includes('improve')) {
      return `Use "✨ Rewrite" in the editor to improve a step title—clearer phrasing, grammar fixes, and helpful detail while keeping it human.`
    }

    if (msg.includes('help') || msg.includes('how to') || msg.includes('what can')) {
      return `I can help with navigation, editing, overview, and timing. Ask "what step am I on?", "next step", or "how to edit a step".`
    }

    return `You asked: "${userMessage}". I can help with step navigation, editing, timing, and overview—what would you like to know?`
  }

  // Fixed: Use onKeyDown instead of deprecated onKeyPress
  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    setCurrentStepIndex(currentIdx)
  }, [currentIdx])

  // Keyboard shortcuts for step navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in chat
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return
      }

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          if (currentStepIndex !== null && currentStepIndex < steps.length - 1) {
            const nextStep = steps[currentStepIndex + 1]
            if (nextStep) {
              setCurrentStepIndex(currentStepIndex + 1)
              seekToTime(nextStep.start)
            }
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (currentStepIndex !== null && currentStepIndex > 0) {
            const prevStep = steps[currentStepIndex - 1]
            if (prevStep) {
              setCurrentStepIndex(currentStepIndex - 1)
              seekToTime(prevStep.start)
            }
          }
          break
        case 'r':
        case 'R':
          e.preventDefault()
          if (currentStepIndex !== null) {
            const currentStep = steps[currentStepIndex]
            if (currentStep) {
              seekToTime(currentStep.start)
            }
          }
          break
        case '?':
          e.preventDefault()
          // Focus chat input
          const chatInput = document.querySelector('input[placeholder="Ask a question..."]') as HTMLInputElement
          if (chatInput) {
            chatInput.focus()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentStepIndex, steps])

  console.log('🎬 TrainingPage render state:', {
    moduleId,
    url,
    loading,
    error,
    steps: steps.length,
    stepsLoading,
    stepsError
  })

  // Show processing screen if module is still being processed
  if (isProcessing && (statusLoading || (status && status.status === 'processing'))) {
    return (
      <ProcessingScreen 
        progress={0} 
        message="Processing video..."
        stuckAtZero={false}
        timeoutReached={false}
      />
    )
  }

  // Show error screen if processing failed
  if (status && status.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">
            Processing Failed
          </h2>
          <p className="text-gray-600 mb-4">An error occurred during processing</p>
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
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Training: {moduleId}</h1>
          
          {/* Processing Status Header */}
          {showProcessingState && !isReady && (
            <div className="flex items-center gap-2 text-sm text-slate-500 mt-2">
              <span className="animate-spin h-4 w-4 rounded-full border border-slate-300 border-t-transparent" />
              {status?.status === 'processing' ? 'Processing video (transcribe → steps)…' : 'Starting processing...'}
            </div>
          )}
          
          {/* Error Status */}
          {hasError && (
            <div className="flex items-center gap-2 text-sm text-red-500 mt-2">
              <span>⚠️</span>
              <span>Processing failed. Please try again.</span>
            </div>
          )}
          
          {/* Status Hints from useSteps hook */}
          {lastLoadedAt && (
            <span className="text-xs text-slate-500 ml-2">
              • loaded {new Date(lastLoadedAt).toLocaleTimeString()}
            </span>
          )}
          {nextRetryIn !== undefined && (
            <span className="text-xs text-slate-500 ml-2">
              • retrying in {Math.ceil(nextRetryIn / 1000)}s…
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowQRCode(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            title="Share this training module via QR code"
          >
            📱 Share QR Code
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Player */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="aspect-video bg-black rounded-2xl flex items-center justify-center text-white">
              <LoadingSpinner message="Loading video..." fullScreen={false} />
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
            <video 
              controls 
              src={url} 
              className="w-full rounded-2xl shadow-sm" 
              ref={videoRef} 
              onTimeUpdate={handleVideoTimeUpdate}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
            />
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
                <LoadingSpinner message="Loading steps..." fullScreen={false} />
                
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
                    type="button"
                    onClick={() => {
                      reloadSteps() // Use reloadSteps from useSteps
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                  >
                    🔁 Retry Loading Steps
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessWithAI}
                    disabled={processingAI || status?.status === 'processing'}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg"
                  >
                    🤖 Re-run AI Step Detection
                  </button>
                </div>

                {processingAI && (
                  <p className="text-sm text-blue-600 mt-2 animate-pulse">
                    ⏳ AI is working... give it a sec, it's growing a brain.
                  </p>
                )}
              </div>
            ) : steps && steps.length > 0 ? (
              <div className="space-y-4">
                {/* Voice Coach Controls */}
                <VoiceCoachControls
                  steps={steps}
                  currentStepIndex={currentStepIndex || 0}
                  onStepChange={setCurrentStepIndex}
                  onSeek={seekToTime}
                  onPause={() => videoRef.current?.pause()}
                  onPlay={() => videoRef.current?.play()}
                />

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
                {DEBUG_UI && (
                  <div className="text-xs text-gray-400 mt-2">
                    Debug: moduleId={moduleId}, url={url ? 'loaded' : 'not loaded'}, steps={steps.length}, hasTriedOnce={false} // Removed hasTriedOnce as it's not used in the new code
                  </div>
                )}
                
                <div className="mt-4 flex gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      reloadSteps() // Use reloadSteps from useSteps
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    🔁 Retry Loading Steps
                  </button>
                  <button
                    type="button"
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
                  type="button"
                  onClick={() => {
                    setChatMessage(suggestion)
                    // Optional: auto-send on click for better UX
                    // handleSendMessage()
                  }}
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
                <div 
                  className={`max-w-xs p-3 rounded-lg ${
                    chat.type === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700'
                  }`}
                  aria-live={chat.type === 'assistant' ? 'polite' : undefined}
                >
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
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              title="Send message"
            >
              📤
            </button>
          </div>
        </div>
      </div>
      
      {/* QR Code Modal */}
      {showQRCode && moduleId && (
        <QRCodeGenerator
          moduleId={moduleId}
          moduleTitle={`Training: ${moduleId}`}
          onClose={() => setShowQRCode(false)}
        />
      )}

      {/* Voice Coach Overlay */}
      <VoiceCoachOverlay
        isVisible={showVoiceCoachOverlay}
        onStart={() => {
          setShowVoiceCoachOverlay(false);
          // Synchronous event => still in the click gesture
          // This keeps the action inside the same user gesture for mobile compatibility
          window.dispatchEvent(new Event('vc-start'));
        }}
        onDismiss={() => setShowVoiceCoachOverlay(false)}
      />
    </div>
  )
} 