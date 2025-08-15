import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useSignedVideoUrl } from '../hooks/useSignedVideoUrl'
import { useModuleStatus } from '../hooks/useModuleStatus'
import { useSteps, Step } from '../hooks/useSteps'
import { useStepIndexAtTime } from '../hooks/useStepIndexAtTime'
import { api, API_ENDPOINTS, DEBUG_UI } from '../config/api'
// TEMP: imports disabled to isolate React #310 error
// import { AddStepForm } from '../components/AddStepForm'
// import { StepEditor } from '../components/StepEditor'
// import { FeedbackSection } from '../components/FeedbackSection'
// import { ProcessingScreen } from '../components/ProcessingScreen'
import ChatTutor from '../components/ChatTutor'

// import { LoadingSpinner } from '../components/common/LoadingSpinner'


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
  const timeUpdateRaf = useRef<number | null>(null)
  
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null)

  const [processingAI, setProcessingAI] = useState(false)
  const [videoTime, setVideoTime] = useState(0)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)

  // TEMP: re-enable ChatTutor with stub to test isolation
  const ENABLE_CHAT_TUTOR = true;
  
  // TEMP: disable video block to isolate React #310
  const ENABLE_VIDEO = false;


  // Camera/mic functionality for Start Training
  const requestSensors = async () => {
    try {
      // Ask once and keep tracks around; you can pipe audio to your transcription endpoint in chunks
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      // Optional: show a small PIP preview
      const preview = document.querySelector<HTMLVideoElement>('#watchme-preview');
      if (preview) {
        preview.srcObject = stream;
        preview.muted = true;   // avoid echo
        await preview.play();
      }

      // TODO: if you want continuous STT:
      // - Use MediaRecorder on 'audio/webm' and POST 3–5s chunks to /api/ai/transcribe-stream
      // - Or switch to WebRTC/WS to your backend for low-latency Google STT streaming
    } catch (e) {
      console.error('getUserMedia failed', e);
    }
  };

  // attach to a user gesture (e.g., video play or a dedicated button)
  const handleStartTraining = async () => {
    await requestSensors();              // prompt once
    // Note: videoRef.current?.play() is not needed here since this is called from onPlay
  };

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
          // Focus AI Tutor input (mobile) or desktop sidebar
          const aiInput = document.querySelector('input[placeholder="Type your question..."]') as HTMLInputElement
          if (aiInput) {
            aiInput.focus()
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
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold text-blue-600 mb-2">
            Processing Video
          </h2>
          <p className="text-gray-600 mb-4">Processing video...</p>
        </div>
      </div>
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Player */}
        <div className="lg:col-span-2">
          {ENABLE_VIDEO ? (
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
              <h2 className="text-xl font-semibold mb-4">Training Video</h2>
              <div>Video player would go here</div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
              <h2 className="text-xl font-semibold mb-4">Training Video</h2>
              <div>[video stub]</div>
            </div>
          )}

          {/* Steps Display */}
          <div className="mt-6">
            {stepsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading steps...</p>
                
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
                  <div key={step.id || index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="text-sm font-semibold text-gray-700 mb-2">
                      Step {index + 1}: {step.title || 'Untitled Step'}
                    </div>
                    <div className="text-sm text-gray-600">
                      {step.description || 'No description'}
                    </div>
                  </div>
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

          </div>

          {/* AI Tutor – mobile (below video/steps) */}
          {ENABLE_CHAT_TUTOR && (
            <div className="lg:hidden mt-6">
              {moduleId && <ChatTutor moduleId={moduleId} />}
            </div>
          )}

          {/* TEMP: Feedback section disabled to isolate React #310 */}
        </div>

                  {/* AI Tutor – desktop sidebar */}
          {ENABLE_CHAT_TUTOR && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border flex-col h-[500px] hidden lg:flex">
              {moduleId && <ChatTutor moduleId={moduleId} />}
            </div>
          )}
      </div>


    </div>
  )
} 