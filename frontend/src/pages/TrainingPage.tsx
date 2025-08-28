import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { api, API_ENDPOINTS } from '../config/api'
import { AddStepForm } from '../components/AddStepForm'
import { StepEditor } from '../components/StepEditor'
import { FeedbackSection } from '../components/FeedbackSection'
import { ProcessingScreen } from '../components/ProcessingScreen'
import QRCodeGenerator from '../components/QRCodeGenerator'
import VoiceTrainer from '../components/voice/VoiceTrainer'

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
  const prevStatusRef = useRef<string | null>(null)

  useEffect(() => {
    if (!moduleId) return
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/modules/${moduleId}`)
        const data = await r.json()
        setStatus(data.module)

        // Only trigger reload on actual status change
        const newStatus = data.module?.status ?? null
        if (newStatus !== prevStatusRef.current) {
          prevStatusRef.current = newStatus

          if (newStatus === 'READY' || newStatus === 'FAILED') {
            console.log('Status changed, triggering steps reload:', newStatus)
            // Small debounce to let S3 consistency settle
            setTimeout(() => {
              setRetryCount(0)
              setHasTriedOnce(false)
            }, 750)
          }
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
  const [stepsMeta, setStepsMeta] = useState<any>(null)
  const [stepsLoading, setStepsLoading] = useState(false)
  const [stepsError, setStepsError] = useState<string | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [hasTriedOnce, setHasTriedOnce] = useState(false)
  const maxRetries = 5

  const [chatMessage, setChatMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      type: 'assistant',
      message: `Hi! I'm your AI training assistant. I can help you with step-by-step guidance and answer questions about this training.`
    }
  ])


  const [videoTime, setVideoTime] = useState(0)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)

  // 🎯 FETCH MODULE DATA FOR TITLE
  const [moduleData, setModuleData] = useState<any>(null)
  const [moduleDataLoading, setModuleDataLoading] = useState(false)
  const [isRealData, setIsRealData] = useState<boolean>(false)
  const [aiLearningMetrics, setAiLearningMetrics] = useState<any>(null)
  const [showLearningProgress, setShowLearningProgress] = useState<boolean>(false)


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
        if (data.success && data.module) {
          setModuleData(data.module)

          // Detect if we have real processed data
          const hasRealSteps = data.module.steps &&
            Array.isArray(data.module.steps) &&
            data.module.steps.length > 0 &&
            data.module.steps.some((step: any) =>
              step.title &&
              !step.title.includes('ERROR') &&
              !step.title.includes('Failed') &&
              !step.title.includes('Database Not Configured') &&
              step.start !== undefined
            )

          const isCompleted = data.module.status === 'READY' || data.module.status === 'COMPLETED'
          const hasValidDuration = data.module.totalDuration && data.module.totalDuration > 0

          setIsRealData(hasRealSteps && isCompleted && hasValidDuration)

          console.log('🔍 Module data analysis:', {
            hasSteps: !!data.module.steps,
            stepsCount: data.module.steps?.length || 0,
            hasRealSteps,
            status: data.module.status,
            isCompleted,
            duration: data.module.totalDuration,
            hasValidDuration,
            isRealData: hasRealSteps && isCompleted && hasValidDuration
          })
        }
      } catch (error) {
        console.error('Failed to fetch module data:', error)
        setIsRealData(false)
      } finally {
        setModuleDataLoading(false)
      }
    }

    fetchModuleData()
  }, [moduleId])

  // 🎯 FETCH AI LEARNING METRICS
  useEffect(() => {
    const fetchLearningMetrics = async () => {
      try {
        const response = await api(API_ENDPOINTS.AI_LEARNING_METRICS)
        if (response.success) {
          setAiLearningMetrics(response.metrics)

          // Update welcome message based on learning metrics (keep it concise)
          if (response.metrics.totalInteractions > 0) {
            const welcomeMessage = `Hi! I'm your AI training assistant with ${response.metrics.knowledgeBaseSize} learned answers. I can help you with step-by-step guidance.`
            setChatHistory([{
              type: 'assistant',
              message: welcomeMessage
            }])
          }
        }
      } catch (error) {
        console.warn('Failed to fetch AI learning metrics:', error)
        // Set default metrics if API fails
        setAiLearningMetrics({
          totalInteractions: 0,
          reusedCount: 0,
          reuseRate: 0,
          totalQuestions: 0,
          knowledgeBaseSize: 0,
          learningEfficiency: 0
        })
      }
    }

    fetchLearningMetrics()
  }, [])

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

        // Set meta data
        setStepsMeta(data.meta)

        // Real data detection is now handled in the module data fetch

        // Normalize step data structure to match UI expectations
        const normalizedSteps = (data.steps || []).map((step: any, index: number) => ({
          id: step.id ?? `s-${index + 1}`,
          title: step.title ??
                 step.heading ??
                 (typeof step.text === 'string' ? step.text.split('\n')[0].slice(0, 80) : `Step ${index + 1}`),
          description: step.description ?? step.text ?? '',
          start: step.start ?? step.startTime ?? index * 10,
          end: step.end ?? step.endTime ?? (index + 1) * 10,
          originalText: data.transcript || '', // Add transcript to each step
          duration: data.meta?.durationSec ? Math.round(data.meta.durationSec / data.steps.length) : 15 // Calculate step duration
        }))

        setSteps(normalizedSteps)
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
      
      // Remove typing indicator and add concise response
      setChatHistory(prev => prev.filter(msg => !msg.isTyping))

      // Clean up the response - remove redundant learning messages
      let cleanResponse = aiResponse
        .replace(/\*Thanks for the question.*$/gm, '')
        .replace(/\*This answer was drawn from.*$/gm, '')
        .replace(/\*I've learned from this interaction.*$/gm, '')
        .replace(/📈|🧠|♻️|📚/g, '')
        .trim()

      setChatHistory(prev => [...prev, { type: 'assistant', message: cleanResponse }])

      // Update learning metrics after successful interaction
      if (aiLearningMetrics) {
        setAiLearningMetrics(prev => prev ? {
          ...prev,
          totalInteractions: prev.totalInteractions + 1
        } : null)
      }
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

    // Numbered step requests (e.g., "second step", "step 3", "what's step 1")
    const numberWords = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']
    const numberMap: { [key: string]: number } = {
      'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
      'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10
    }

    // Check for "what's the X step" or "what is step X"
    for (const [word, number] of Object.entries(numberMap)) {
      if (message.includes(`${word} step`) || message.includes(`step ${number}`)) {
        const stepIndex = number - 1
        if (stepIndex < allSteps.length) {
          const step = allSteps[stepIndex]
          const minutes = Math.floor(step.start / 60)
          const seconds = step.start % 60
          return `**Step ${number}**: "${step.title}"\n\n${step.description}\n\nStarts at ${minutes}:${seconds.toString().padStart(2, '0')} in the video.`
        } else {
          return `Sorry, there are only ${allSteps.length} steps in this training.`
        }
      }
    }

    // Check for digit-based step requests (e.g., "step 2", "tell me about step 3")
    const digitMatch = message.match(/step\s+(\d+)/i)
    if (digitMatch) {
      const stepNumber = parseInt(digitMatch[1])
      const stepIndex = stepNumber - 1
      if (stepIndex >= 0 && stepIndex < allSteps.length) {
        const step = allSteps[stepIndex]
        const minutes = Math.floor(step.start / 60)
        const seconds = step.start % 60
        return `**Step ${stepNumber}**: "${step.title}"\n\n${step.description}\n\nStarts at ${minutes}:${seconds.toString().padStart(2, '0')} in the video.`
      } else {
        return `Sorry, there are only ${allSteps.length} steps in this training.`
      }
    }

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
    
    // Summary/overview questions
    if (message.includes('summary') || message.includes('overview') || message.includes('what is this') || message.includes('what does this')) {
      const totalDuration = allSteps.length > 0 ? Math.max(...allSteps.map(s => s.end)) : 0
      const minutes = Math.floor(totalDuration / 60)
      const seconds = totalDuration % 60
      return `This training module has **${allSteps.length} steps** and runs for **${minutes}:${seconds.toString().padStart(2, '0')} minutes**.\n\nIt covers: ${allSteps.slice(0, 3).map((s, i) => `${i + 1}. ${s.title}`).join(', ')}${allSteps.length > 3 ? `, and ${allSteps.length - 3} more steps` : ''}.`
    }

    // Step count questions
    if (message.includes('how many steps') || message.includes('total steps') || message.includes('number of steps')) {
      return `This training has **${allSteps.length} steps** total. You can see all steps listed below the video. Each step is clickable and will seek to that part of the video.`
    }

    // Specific step patterns (e.g., "tell me about step 2", "explain step 3")
    const specificStepMatch = message.match(/(?:tell me about|explain|describe|what about)\s+step\s+(\d+)/i)
    if (specificStepMatch) {
      const stepNumber = parseInt(specificStepMatch[1])
      const stepIndex = stepNumber - 1
      if (stepIndex >= 0 && stepIndex < allSteps.length) {
        const step = allSteps[stepIndex]
        return `**Step ${stepNumber}: ${step.title}**\n\n${step.description}\n\nThis step appears at ${Math.floor(step.start / 60)}:${(step.start % 60).toString().padStart(2, '0')} in the video.`
      }
    }

    // General help
    if (message.includes('help') || message.includes('how to') || message.includes('what can')) {
      return `I can help you with:
• **Specific steps**: Ask "what's the second step?" or "tell me about step 3"
• **Navigation**: Ask about current, next, or previous steps
• **Overview**: Ask for summary or how many steps there are
• **Timing**: Find out when steps occur in the video

Try asking me questions like:
- "What's the second step?"
- "How many steps are there?"
- "What's the current step?"
- "What's next?"`
    }

    // Default response with better guidance
    return `I can help you learn about this training! Try asking me questions like:
• "What's the second step?"
• "How many steps are there?"
• "What's the current step?"
• "What's next?"

What would you like to know about this training?`
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
        <div className="lg:col-span-2 order-2 lg:order-1">
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
          )

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

                  

                </div>


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
                </div>

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

        {/* AI Assistant Chat (Top on mobile) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border flex flex-col h-[500px] order-1 lg:order-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">🤖 AI Assistant</h3>
            {aiLearningMetrics && aiLearningMetrics.totalInteractions > 0 && (
              <button
                onClick={() => setShowLearningProgress(!showLearningProgress)}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded transition-colors"
              >
                {showLearningProgress ? 'Hide Progress' : 'View Progress'}
              </button>
            )}
          </div>

          {/* AI Learning Progress (hidden by default) */}
          {aiLearningMetrics && aiLearningMetrics.totalInteractions > 0 && showLearningProgress && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">AI Learning Progress</span>
                <span className="text-xs text-blue-700">
                  {aiLearningMetrics.reuseRate}% efficiency
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(aiLearningMetrics.reuseRate, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-blue-700 mt-1">
                <span>{aiLearningMetrics.knowledgeBaseSize} learned answers</span>
                <span>{aiLearningMetrics.totalModules} training modules</span>
              </div>
            </div>
          )}
          
          {/* Suggested Questions (max 3) */}
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-1">
              {[
                "What's the second step?",
                "How many steps?",
                "What's next?"
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

          {/* Voice Assistant */}
          <div className="mb-4">
            <VoiceTrainer
              moduleId={moduleId || ''}
              onQuestionAsked={(question) => setChatMessage(question)}
              autoStart={status?.status === 'READY' && steps.length > 0 && !isProcessing}
            />
          </div>

          {/* Chat History */}
          <div
            className="flex-1 space-y-4 overflow-y-auto mb-4 scroll-smooth max-h-80"
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
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      chat.type === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {chat.type === 'user' ? '👤 You' : '🤖 AI'}
                    </span>
                    {chat.type === 'assistant' && chat.message.includes('learning database') && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                        📚 Learned
                      </span>
                    )}
                    {chat.type === 'assistant' && chat.message.includes('learned from this interaction') && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                        🧠 Learning
                      </span>
                    )}
                  </div>
                  <p className="text-sm">
                    {chat.isTyping ? (
                      <span className="flex items-center gap-1">
                        <span className="animate-pulse">...</span>
                        <span className="text-xs">AI is thinking</span>
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