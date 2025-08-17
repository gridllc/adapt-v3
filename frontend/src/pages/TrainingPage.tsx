// frontend/src/pages/TrainingPage.tsx
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { logger } from "@utils/logger";
import { Navbar } from "@components/Navbar";
import { ChatTutor } from "@components/ChatTutor";

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
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const getCurrentStep = (): Step | null => {
    return steps.find(step => currentTime >= step.start && currentTime <= step.end) || null;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          <p className="text-gray-600">
            Follow along with the video and ask the AI for help anytime
          </p>
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
              <ChatTutor moduleId={moduleId!} />
              
              {/* Voice Activation Section */}
              <div className="mt-6 bg-white p-4 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  🎙️ Voice Training
                </h3>
                
                <div className="space-y-3">
                  <button className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                    <span className="text-xl">🎤</span>
                    Start Voice Training
                  </button>
                  
                  <p className="text-sm text-gray-600 text-center">
                    Ask "What do I do next?" or any question about the current step
                  </p>
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

export default TrainingPage;
