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

interface ChatMessage {
  type: 'user' | 'assistant'
  message: string
  isTyping?: boolean
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
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      type: 'assistant',
      message: "Hi! I'm here to help you with this training. Ask me anything about the current step or the overall process."
    }
  ])

  const [processingAI, setProcessingAI] = useState(false)
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)
  const [editedSteps, setEditedSteps] = useState<Step[]>([])
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [selectedSteps, setSelectedSteps] = useState<Set<number>>(new Set())
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const [videoTime, setVideoTime] = useState(0)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const stepsContainerRef = useRef<HTMLDivElement>(null)

  // Video seeking function
  const seekToTime = (timeInSeconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeInSeconds
      videoRef.current.play()
      console.log(`🎬 Seeking to ${timeInSeconds}s`)
    }
  }

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
      const stepStart = step.timestamp
      const stepEnd = step.timestamp + (step.duration || 30)
      
      if (videoTime >= stepStart && videoTime < stepEnd) {
        return i
      }
    }
    
    return null
  }

  // Calculate training progress
  const getTrainingProgress = (): number => {
    if (steps.length === 0) return 0
    
    const totalDuration = steps.reduce((sum, step) => sum + (step.duration || 30), 0)
    const currentStepIndex = getCurrentStepIndex()
    
    if (currentStepIndex === null) return 0
    
    let completedDuration = 0
    for (let i = 0; i < currentStepIndex; i++) {
      completedDuration += steps[i].duration || 30
    }
    
    // Add progress within current step
    const currentStep = steps[currentStepIndex]
    const stepProgress = Math.min(videoTime - currentStep.timestamp, currentStep.duration || 30)
    completedDuration += Math.max(0, stepProgress)
    
    return Math.min((completedDuration / totalDuration) * 100, 100)
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

  const handleAutoSave = async (updatedStep: StepData) => {
    if (!moduleId) return
    
    try {
      setAutoSaveStatus('saving')
      
      // Convert StepData back to Step format
      const updatedStepForBackend = {
        ...editedSteps[editingStepIndex!],
        title: updatedStep.title,
        description: updatedStep.description,
        timestamp: updatedStep.start,
        duration: updatedStep.end - updatedStep.start,
        aliases: updatedStep.aliases,
        notes: updatedStep.notes
      }
      
      const newEditedSteps = [...editedSteps]
      newEditedSteps[editingStepIndex!] = updatedStepForBackend
      setEditedSteps(newEditedSteps)
      
      // Auto-save to backend
      await api(API_ENDPOINTS.STEPS(moduleId), {
        method: 'POST',
        body: JSON.stringify({ steps: newEditedSteps }),
      })
      
      setAutoSaveStatus('saved')
      console.log(`💾 Auto-saved step ${editingStepIndex! + 1}`)
      
      // Clear saved status after 3 seconds
      setTimeout(() => setAutoSaveStatus('idle'), 3000)
    } catch (err) {
      console.error('❌ Auto-save error:', err)
      setAutoSaveStatus('error')
      throw err // Re-throw so the component can show error state
    }
  }

  // Bulk operations
  const handleSelectStep = (index: number) => {
    const newSelected = new Set(selectedSteps)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedSteps(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedSteps.size === steps.length) {
      setSelectedSteps(new Set())
    } else {
      setSelectedSteps(new Set(steps.map((_, index) => index)))
    }
  }

  const handleBulkDelete = async () => {
    if (!moduleId || selectedSteps.size === 0) return
    
    if (!confirm(`Are you sure you want to delete ${selectedSteps.size} step(s)?`)) return
    
    try {
      const newSteps = steps.filter((_, index) => !selectedSteps.has(index))
      await api(API_ENDPOINTS.STEPS(moduleId), {
        method: 'POST',
        body: JSON.stringify({ steps: newSteps }),
      })
      setSteps(newSteps)
      setSelectedSteps(new Set())
      console.log(`🗑️ Deleted ${selectedSteps.size} steps`)
    } catch (err) {
      console.error('❌ Bulk delete error:', err)
      alert('Failed to delete steps')
    }
  }

  const handleBulkEdit = () => {
    setBulkEditMode(true)
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

  const handleAIRewrite = async (index: number, style: string = 'polished') => {
    if (!moduleId) return
    
    try {
      const res = await fetch(`/api/steps/${moduleId}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: editedSteps[index].title,
          style: style
        }),
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
        timestamp: currentStep.timestamp,
        duration: currentStep.duration,
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
      const response = await fetch(API_ENDPOINTS.AI_CONTEXTUAL_RESPONSE, {
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

      if (!response.ok) {
        throw new Error('AI service unavailable')
      }

      const data = await response.json()
      return data.response || 'I apologize, but I\'m having trouble processing your request right now.'
    } catch (error) {
      console.error('AI response error:', error)
      // Fallback to simple keyword-based responses
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
      return `Use the "✨ AI Rewrite" button in the editor to get different versions of your step title. Choose from polished, casual, detailed, or concise styles!`
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

  // Auto-scroll to current step when it changes
  useEffect(() => {
    const currentStepIndex = getCurrentStepIndex()
    if (stepsContainerRef.current && currentStepIndex !== null) {
      const currentStepElement = stepsContainerRef.current.children[currentStepIndex] as HTMLElement;
      if (currentStepElement) {
        currentStepElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [videoTime, steps]);

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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Training: {moduleId}</h1>
        <div className="flex items-center gap-4">
          {/* Training Progress */}
          {steps.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${getTrainingProgress()}%` }}
                />
              </div>
              <span className="text-sm text-gray-600">
                {Math.round(getTrainingProgress())}% complete
              </span>
            </div>
          )}
          {/* Auto-save Status */}
          {autoSaveStatus !== 'idle' && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              autoSaveStatus === 'saved' ? 'bg-green-100 text-green-700' :
              autoSaveStatus === 'error' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {autoSaveStatus === 'saving' && '⏳'}
              {autoSaveStatus === 'saved' && '✅'}
              {autoSaveStatus === 'error' && '❌'}
              <span>
                {autoSaveStatus === 'saving' && 'Auto-saving...'}
                {autoSaveStatus === 'saved' && 'Auto-saved!'}
                {autoSaveStatus === 'error' && 'Auto-save failed'}
              </span>
            </div>
          )}
        </div>
      </div>

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
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded border hover:bg-blue-50 transition"
                  >
                    {selectedSteps.size === steps.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="text-xs text-yellow-800">
                    <strong>💡 Inline Editing Available:</strong> Click "✏️ Edit" on any step to edit it directly while watching the video. Add aliases and AI hints to improve the training experience.
                  </div>
                </div>
                
                {/* Bulk Operations */}
                {selectedSteps.size > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-blue-800">
                        <strong>Bulk Operations:</strong> {selectedSteps.size} step(s) selected
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleBulkDelete}
                          className="text-red-600 hover:text-red-800 text-xs px-3 py-1 rounded border hover:bg-red-50 transition"
                        >
                          🗑️ Delete Selected
                        </button>
                        <button
                          onClick={handleBulkEdit}
                          className="text-blue-600 hover:text-blue-800 text-xs px-3 py-1 rounded border hover:bg-blue-50 transition"
                        >
                          ✏️ Edit Selected
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="max-h-96 overflow-y-auto space-y-4 border rounded-lg p-4" ref={stepsContainerRef}>
                  {steps.map((step, index) => (
                    <div 
                      key={index} 
                      className={`bg-white p-4 rounded-lg border shadow-sm transition-all hover:shadow-md ${
                        getCurrentStepIndex() === index 
                          ? 'ring-2 ring-blue-500 bg-blue-50' 
                          : selectedSteps.has(index)
                          ? 'ring-2 ring-green-500 bg-green-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <input
                          type="checkbox"
                          checked={selectedSteps.has(index)}
                          onChange={() => handleSelectStep(index)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                          getCurrentStepIndex() === index 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          Step {index + 1}
                        </span>
                        <span className="text-gray-500 text-sm">
                          {Math.floor(step.timestamp / 60)}:{(step.timestamp % 60).toString().padStart(2, '0')}
                        </span>
                        {getCurrentStepIndex() === index && (
                          <span className="text-blue-600 text-xs flex items-center gap-1">
                            {isVideoPlaying ? '▶️ Playing' : '⏸️ Paused'}
                          </span>
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
                          onAIRewrite={(style) => handleAIRewrite(index, style)}
                          onAutoSave={handleAutoSave}
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