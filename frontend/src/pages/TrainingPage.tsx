// frontend/src/pages/TrainingPage.tsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { logger } from "@utils/logger";
import { Navbar } from "@/components/Navbar";
import { ChatTutor } from "@components/chat/ChatTutor";
import { useMic } from "@hooks/useMic";

// Error Boundary Component
class TrainingPageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('TrainingPage Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-4">
              There was an error loading the training page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface ModuleData {
  id: string;
  status: "UPLOADING" | "PROCESSING" | "READY" | "ERROR";
  s3Key?: string;
  stepsKey?: string;
  title?: string;
}

interface Step {
  id: string;
  start: number;
  end: number;
  text: string;
  title: string;
  description: string;
  aliases?: string[];
  notes?: string;
}

const TrainingPage: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const [module, setModule] = useState<ModuleData | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [voiceQuestion, setVoiceQuestion] = useState("");
  const [isVoiceTrainingActive, setIsVoiceTrainingActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Voice functionality
  const { isRecording, error: micError, start: startRecording, stop: stopRecording, audioBlob } = useMic();

  // Add progress tracking state
  const [userProgress, setUserProgress] = useState({
    completedSteps: [] as string[],
    currentStepIndex: 0,
    timeSpent: 0,
    questionsAsked: 0,
    performanceScore: 0,
    lastActiveStep: undefined as string | undefined,
    learningPace: 'normal' as 'slow' | 'normal' | 'fast',
    difficultyLevel: 'beginner' as 'beginner' | 'intermediate' | 'advanced'
  })

  // Calculate current step based on video time
  const getCurrentStep = useCallback(() => {
    if (!steps || steps.length === 0) return null
    
    const videoTime = currentTime || 0
    
    // Find the step that matches the current video time
    let currentStep = steps.find(step => 
      videoTime >= step.start && videoTime <= step.end
    )

    if (currentStep) return currentStep

    // If no exact match, find the closest upcoming step
    currentStep = steps.find(step => step.start > videoTime)
    if (currentStep) return currentStep

    // If past all steps, return the last step
    return steps[steps.length - 1] || null
  }, [steps, currentTime])

  // Update progress when video time changes
  useEffect(() => {
    if (!steps || steps.length === 0) return

    const currentStep = getCurrentStep()
    if (!currentStep) return

    // Calculate completed steps
    const completedSteps = steps
      .filter(step => currentTime > step.end)
      .map(step => step.id)

    // Calculate performance score
    const completionRate = completedSteps.length / steps.length
    const performanceScore = Math.round(completionRate * 100)

    // Determine learning pace
    const expectedTimePerStep = 30 // 30 seconds per step (adjustable)
    const expectedTotalTime = steps.length * expectedTimePerStep
    let learningPace: 'slow' | 'normal' | 'fast' = 'normal'
    if (currentTime < expectedTotalTime * 0.7) learningPace = 'fast'
    else if (currentTime > expectedTotalTime * 1.3) learningPace = 'slow'

    // Determine difficulty level
    let difficultyLevel: 'beginner' | 'intermediate' | 'advanced' = 'beginner'
    if (performanceScore > 80) difficultyLevel = 'advanced'
    else if (performanceScore > 50) difficultyLevel = 'intermediate'

    setUserProgress(prev => ({
      ...prev,
      completedSteps,
      currentStepIndex: completedSteps.length,
      timeSpent: currentTime,
      performanceScore,
      lastActiveStep: currentStep.id,
      learningPace,
      difficultyLevel
    }))
  }, [currentTime, steps, getCurrentStep])

  // Build training context for AI
  const trainingContext = useMemo(() => ({
    moduleId: moduleId || '',
    currentStep: getCurrentStep() ? {
      id: getCurrentStep()!.id,
      title: getCurrentStep()!.title || getCurrentStep()!.text,
      start: getCurrentStep()!.start,
      end: getCurrentStep()!.end,
      description: getCurrentStep()!.description || getCurrentStep()!.text,
      notes: getCurrentStep()!.notes
    } : undefined,
    allSteps: steps.map(step => ({
      id: step.id,
      title: step.title || step.text,
      start: step.start,
      end: step.end,
      description: step.description || step.text,
      notes: step.notes
    })) || [],
    videoTime: currentTime || 0,
    userProgress,
    moduleMetadata: {
      title: module?.title || 'Training Module',
      description: `Interactive training with ${steps?.length || 0} steps`,
      difficulty: userProgress.difficultyLevel,
      estimatedDuration: steps && steps.length > 0 ? Math.ceil((steps[steps.length - 1]?.end || 0) / 60) : 0,
      prerequisites: [],
      learningObjectives: steps?.map(step => step.title || step.text) || [],
      targetAudience: ['All levels']
    }
  }), [moduleId, getCurrentStep, steps, currentTime, userProgress, module?.title])

  // Handle step guidance requests
  const handleStepGuidance = useCallback((stepId: string) => {
    const step = steps?.find(s => s.id === stepId)
    if (step) {
      // Seek to the step in the video
      if (videoRef.current) {
        videoRef.current.currentTime = step.start
      }
    }
  }, [steps])

  // Handle progress analysis
  const handleProgressAnalysis = useCallback(() => {
    // This will be handled by the ChatTutor component
    console.log('Progress analysis requested')
  }, [])

  useEffect(() => {
    const fetchModule = async () => {
      try {
        const res = await fetch(`/api/modules/${moduleId}`);
        if (!res.ok) throw new Error("Failed to load module");
        const data: ModuleData = await res.json();
        setModule(data);

        if (data.status === "READY") {
          // Get video URL
          if (data.s3Key) {
            try {
              const videoRes = await fetch(`/api/video/${moduleId}/play`);
              if (videoRes.ok) {
                const { url } = await videoRes.json();
                setVideoUrl(url);
              }
            } catch (err) {
              logger.warn("Could not get video URL:", err);
            }
          }

          // Get steps
          if (data.stepsKey) {
            try {
              const stepsRes = await fetch(data.stepsKey);
              if (stepsRes.ok) {
                const stepsData: Step[] = await stepsRes.json();
                setSteps(stepsData);
              }
            } catch (err) {
              logger.warn("Could not load steps from S3, trying database:", err);
              // Fallback to database
              try {
                const stepsRes = await fetch(`/api/steps/${moduleId}`);
                if (stepsRes.ok) {
                  const stepsData: Step[] = await stepsRes.json();
                  setSteps(stepsData);
                }
              } catch (dbErr) {
                logger.error("Failed to load steps from database:", dbErr);
              }
            }
          }
        }
      } catch (err) {
        logger.error("Error loading module:", err);
        setModule({ id: moduleId!, status: "ERROR" });
      } finally {
        setLoading(false);
      }
    };

    if (moduleId) fetchModule();
  }, [moduleId]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const seekToStep = (startTime: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime;
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start voice training mode (like V1)
  const startVoiceTrainingMode = async () => {
    try {
      setIsVoiceTrainingActive(true);
      await startRecording();
      logger.info("🎙️ Voice training mode activated - microphone is now listening!");
    } catch (error) {
      logger.error("❌ Failed to start voice training mode:", error);
      setIsVoiceTrainingActive(false);
    }
  };

  // Stop voice training mode
  const stopVoiceTrainingMode = () => {
    stopRecording();
    setIsVoiceTrainingActive(false);
    setVoiceQuestion("");
    logger.info("⏹️ Voice training mode deactivated");
  };

  // Handle voice recording
  const handleVoiceTraining = async () => {
    if (isRecording) {
      stopVoiceTrainingMode();
    } else {
      await startVoiceTrainingMode();
    }
  };

  // Handle voice transcription and AI question
  useEffect(() => {
    if (audioBlob && !isRecording) {
      handleVoiceTranscription(audioBlob);
    }
  }, [audioBlob, isRecording]);

  const handleVoiceTranscription = async (audioBlob: Blob) => {
    try {
      logger.info("🎙️ Processing voice recording...");
      
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const { transcript } = await response.json();
      logger.info("📝 Voice transcribed:", transcript);
      
      if (transcript) {
        setVoiceQuestion(transcript);
        // Auto-send the transcribed question to AI using the working service
        await askAIQuestion(transcript);
      }
    } catch (error) {
      logger.error("❌ Voice transcription error:", error);
      alert('Failed to transcribe voice. Please try again.');
    }
  };

  const askAIQuestion = async (question: string) => {
    try {
      logger.info("🤖 Asking AI:", question);
      
      // Use the working AI service
      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          moduleId, 
          question,
          context: trainingContext
        }),
      });

      if (!response.ok) {
        throw new Error(`AI request failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        logger.info("✅ AI Response:", data.answer);
        // Display AI response in the chat or show notification
        alert(`AI Response: ${data.answer.substring(0, 100)}...`);
      } else {
        throw new Error(data.error || 'AI request failed');
      }
    } catch (error) {
      logger.error("❌ AI question error:", error);
      alert('Failed to get AI response. Please try again.');
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading training module...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!module) {
    return (
      <>
        <Navbar />
        <div className="p-6">
          <div className="text-center text-red-600">Module not found</div>
        </div>
      </>
    );
  }

  if (module.status !== "READY") {
    return (
      <>
        <Navbar />
        <div className="p-6">
          <div className="text-center">
            <p className="text-gray-500 text-lg">
              This module is currently {module.status.toLowerCase()}.
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Please wait for processing to complete.
            </p>
          </div>
        </div>
      </>
    );
  }

  const currentStep = getCurrentStep();

  return (
    <>
      <Navbar />
      <div className="p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {module.title || "Training Module"}
          </h1>
          <p className="text-gray-600 mb-4">
            Follow along with the video and ask the AI for help anytime
          </p>
          
          {/* V1 Style: Big Start Training Button */}
          {!isVoiceTrainingActive ? (
            <button 
              onClick={startVoiceTrainingMode}
              disabled={loading}
              className="bg-green-600 text-white py-3 px-8 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-3 text-lg font-semibold shadow-lg"
            >
              <span className="text-2xl">🎤</span>
              Start Training
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <button 
                onClick={stopVoiceTrainingMode}
                className="bg-red-600 text-white py-3 px-8 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-3 text-lg font-semibold shadow-lg"
              >
                <span className="text-2xl">⏹️</span>
                Stop Training
              </button>
              <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-medium">
                🎙️ Microphone Active - Speak Now!
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player - Left Column */}
          <div className="lg:col-span-2">
            <div className="bg-black rounded-lg overflow-hidden shadow-lg">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  className="w-full h-auto"
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                >
                  <source src={videoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="aspect-video bg-gray-800 flex items-center justify-center">
                  <div className="text-center text-white">
                    <div className="text-6xl mb-4">🎬</div>
                    <p className="text-lg">Video not available</p>
                    <p className="text-sm text-gray-400">Check your video upload</p>
                  </div>
                </div>
              )}
            </div>

            {/* Current Step Display */}
            {currentStep && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">
                  🎯 Current Step: {currentStep.text}
                </h3>
                <div className="flex items-center justify-between text-sm text-blue-700">
                  <span>Time: {formatTime(currentStep.start)} - {formatTime(currentStep.end)}</span>
                  <span>Duration: {formatTime(currentStep.end - currentStep.start)}</span>
                </div>
                {currentStep.notes && (
                  <p className="mt-2 text-blue-800 text-sm">
                    💡 {currentStep.notes}
                  </p>
                )}
              </div>
            )}

            {/* Steps List */}
            <div className="mt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Training Steps ({steps.length})
              </h2>
              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div
                    key={step.id || idx}
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      currentStep?.id === step.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    onClick={() => seekToStep(step.start)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-500">
                            Step {idx + 1}
                          </span>
                          <span className="text-sm text-gray-600">
                            {formatTime(step.start)} - {formatTime(step.end)}
                          </span>
                        </div>
                        <p className="text-gray-900 mt-1">{step.text}</p>
                        {step.aliases && step.aliases.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-500">Aliases: </span>
                            {step.aliases.map((alias, i) => (
                              <span key={i} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded mr-1 mb-1">
                                {alias}
                              </span>
                            ))}
                          </div>
                        )}
                        {step.notes && (
                          <p className="text-sm text-gray-600 mt-2">
                            💡 {step.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">
                          {formatTime(step.end - step.start)}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            seekToStep(step.start);
                          }}
                          className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                        >
                          ▶️ Seek
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI Chat & Voice - Right Column */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <ChatTutor 
          moduleId={moduleId!} 
          context={trainingContext}
          onStepGuidance={handleStepGuidance}
          onProgressAnalysis={handleProgressAnalysis}
        />
              
              {/* Voice Activation Section - V1 Style */}
              <div className="mt-6 bg-white p-4 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  🎙️ Voice Training
                </h3>
                
                {/* Voice Status */}
                {micError && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    ❌ {micError}
                  </div>
                )}
                
                <div className="space-y-3">
                  {/* Main Start Training Button - V1 Style */}
                  {!isVoiceTrainingActive ? (
                    <button 
                      onClick={startVoiceTrainingMode}
                      disabled={loading}
                      className="w-full bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-3 text-lg font-semibold"
                    >
                      <span className="text-2xl">🎤</span>
                      Start Training
                    </button>
                  ) : (
                    <button 
                      onClick={stopVoiceTrainingMode}
                      className="w-full bg-red-600 text-white py-4 px-6 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-3 text-lg font-semibold"
                    >
                      <span className="text-2xl">⏹️</span>
                      Stop Training
                    </button>
                  )}
                  
                  {/* Voice Training Status */}
                  {isVoiceTrainingActive && (
                    <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="animate-pulse text-green-700 text-lg font-medium mb-2">
                        🎙️ MICROPHONE ACTIVE
                      </div>
                      <div className="text-green-600 text-sm">
                        Just speak your question now!
                      </div>
                      <div className="mt-3 text-xs text-green-500">
                        Try: "What do I do next?" or "How do I do this step?"
                      </div>
                    </div>
                  )}
                  
                  {/* Last Voice Question */}
                  {voiceQuestion && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm text-blue-800">
                        <strong>You asked:</strong> "{voiceQuestion}"
                      </p>
                    </div>
                  )}
                  
                  {/* Instructions */}
                  <div className="text-center">
                    <p className="text-sm text-gray-600">
                      {!isVoiceTrainingActive 
                        ? "Click 'Start Training' to activate your microphone"
                        : "Your microphone is listening - just speak naturally!"
                      }
                    </p>
                  </div>
                </div>

                {/* Quick Voice Commands */}
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Try saying:
                  </h4>
                  <div className="space-y-2">
                    {[
                      "What step am I on?",
                      "How do I do this?",
                      "What's next?",
                      "Can you explain this step?",
                      "I'm stuck, help me"
                    ].map((command, i) => (
                      <div key={i} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        🎯 "{command}"
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Wrap with error boundary
const TrainingPageWithErrorBoundary: React.FC = () => (
  <TrainingPageErrorBoundary>
    <TrainingPage />
  </TrainingPageErrorBoundary>
);

export default TrainingPageWithErrorBoundary;
