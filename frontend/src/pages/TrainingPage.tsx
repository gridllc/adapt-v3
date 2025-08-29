import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { api, API_ENDPOINTS } from '../config/api'
import { AddStepForm } from '../components/AddStepForm'
import { StepEditor } from '../components/StepEditor'
import { FeedbackSection } from '../components/FeedbackSection'
import { ProcessingScreen } from '../components/ProcessingScreen'
import QRCodeGenerator from '../components/QRCodeGenerator'
import ChatAssistant from '../components/ChatAssistant'

import { useSignedVideoUrl } from '../hooks/useSignedVideoUrl'

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
  // Video URL by module ID with auto-refresh
  const { url: videoUrl, loading: videoUrlLoading, refreshOnError } = useSignedVideoUrl(moduleId)

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
  
  const [steps, setSteps] = useState<Step[]>([])
  const [stepsMeta, setStepsMeta] = useState<any>(null)
  const [stepsLoading, setStepsLoading] = useState(false)
  const [stepsError, setStepsError] = useState<string | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [hasTriedOnce, setHasTriedOnce] = useState(false)
  const maxRetries = 5




  const [videoTime, setVideoTime] = useState(0)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)

  // 🎯 FETCH MODULE DATA FOR TITLE
  const [moduleData, setModuleData] = useState<any>(null)
  const [moduleDataLoading, setModuleDataLoading] = useState(false)
  const [isRealData, setIsRealData] = useState<boolean>(false)


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
  // Treat either steps or videoUrl as completion
  const isCompleted = (status?.status === "READY" || status?.status === "COMPLETED") ||
                      (steps.length > 0 && Boolean(videoUrl));

  if (isProcessing && !isCompleted && (!status || status.status === 'processing')) {
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
          {videoUrl ? (
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
              onError={async (e) => {
                const mediaErr = (e.currentTarget.error?.code ?? 0);
                console.warn('[Video] Playback error code:', mediaErr);
                // 3 = decode, 4 = src not supported; also handle 403 from S3 (network)
                if (mediaErr === 3 || mediaErr === 4 || mediaErr === 2) {
                  await refreshOnError(); // refetch a fresh signed URL and re-mount
                }
              }}
            >
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : isProcessing ? (
            <div className="aspect-video bg-black rounded-2xl flex items-center justify-center text-white">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 mx-auto animate-spin text-2xl">⏳</div>
                <p className="text-lg">Processing video...</p>
              </div>
            </div>
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

        {/* AI Assistant Chat */}
        <div className="order-1 lg:order-2 lg:col-span-1">
          <ChatAssistant
            moduleId={moduleId || ''}
            currentStep={currentStepIndex !== null ? steps[currentStepIndex] : undefined}
            allSteps={steps}
            videoTime={videoTime}
          />

        </div>
      </div>
      

    </div>
  )
} 