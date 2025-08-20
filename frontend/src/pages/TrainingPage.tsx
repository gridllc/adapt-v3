import React, { useState } from 'react'
import { useParams } from 'react-router-dom'

interface Module {
  id: string
  title: string
  description: string
  videoUrl?: string
  status: 'processing' | 'ready' | 'error'
  steps: Step[]
  error?: string
}

interface Step {
  timestamp: number
  title: string
  description: string
  duration: number
}

export const TrainingPage: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>()
  const [module, setModule] = useState<Module | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pollingCount, setPollingCount] = useState(0)

  console.log('TrainingPage loaded - POLLING DISABLED VERSION')

  // Mock module data for display purposes
  const mockModule: Module = {
    id: moduleId || 'unknown',
    title: 'Training Module (Polling Disabled)',
    description: 'This is a static version with polling disabled to prevent infinite loops',
    status: 'ready',
    videoUrl: 'https://example.com/video.mp4',
    steps: [
      {
        timestamp: 0,
        title: 'Introduction',
        description: 'Welcome to the training - this is mock data',
        duration: 30,
      },
      {
        timestamp: 30,
        title: 'Main Content',
        description: 'The main content of your training',
        duration: 60,
      },
      {
        timestamp: 90,
        title: 'Conclusion',
        description: 'Wrapping up the training session',
        duration: 30,
      }
    ],
  }

  // Use mock module instead of fetched data
  const displayModule = module || mockModule

  // Fetch module data - DISABLED TO PREVENT POLLING
  const fetchModule = async () => {
    console.log('fetchModule called but DISABLED to prevent infinite polling')
    return true // Always return true to prevent polling
  }

  // NO useEffect - this is what was causing the infinite polling!

  if (loading && !module) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Loading Training Module...</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (error && !module) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Error Loading Module</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => {
              setError(null)
              setLoading(true)
              setPollingCount(0)
              // fetchModule() - DISABLED
              console.log('Retry button clicked but polling is disabled')
            }}
            className="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Try Again (Disabled)
          </button>
        </div>
      </div>
    )
  }

  if (!displayModule) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Module Not Found</h1>
        <p className="text-gray-600">The requested training module could not be found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{displayModule.title}</h1>

        {/* Status indicator */}
        <div className="flex items-center space-x-2">
          {displayModule.status === 'processing' && (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-blue-600 font-medium">Processing... ({pollingCount} checks)</span>
            </>
          )}
          {displayModule.status === 'ready' && (
            <span className="text-green-600 font-medium">✓ Ready</span>
          )}
          {displayModule.status === 'error' && (
            <span className="text-red-600 font-medium">✗ Error</span>
          )}
        </div>
      </div>

      <p className="text-gray-600">{displayModule.description}</p>

      {/* Development notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-700">
          🚨 <strong>Development Notice:</strong> Polling has been disabled to prevent infinite API calls.
        </p>
        <p className="text-yellow-600 text-sm mt-2">
          Module ID: {moduleId} | This page shows mock data for UI testing.
        </p>
      </div>

      {/* Show processing message */}
      {displayModule.status === 'processing' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-700">
            🤖 AI is analyzing your video and extracting training steps. This usually takes 1-2 minutes.
          </p>
          <p className="text-blue-600 text-sm mt-2">
            Polling attempt {pollingCount} - Page will update automatically when ready.
          </p>
        </div>
      )}

      {/* Show error message */}
      {displayModule.status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">
            ❌ There was an error processing your video: {displayModule.error || 'Unknown error'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Player */}
        <div className="lg:col-span-2">
          <div className="bg-black rounded-lg aspect-video">
            {displayModule.videoUrl && displayModule.status === 'ready' ? (
              <video
                controls
                className="w-full h-full rounded-lg"
                src={displayModule.videoUrl}
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="flex items-center justify-center h-full text-white">
                {displayModule.status === 'processing' ? 'Video Processing...' : 'Video Player Placeholder'}
              </div>
            )}
          </div>

          {/* Training Steps */}
          {displayModule.steps && displayModule.steps.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Training Steps</h3>
              {displayModule.steps.map((step, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border">
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-100 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{step.title}</h4>
                      <p className="text-gray-600 text-sm mt-1">{step.description}</p>
                      <p className="text-gray-500 text-xs mt-2">
                        {Math.floor(step.timestamp / 60)}:{(step.timestamp % 60).toString().padStart(2, '0')} - Duration: {step.duration}s
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat Interface */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Assistant</h3>
          <div className="space-y-4">
            <div className="bg-gray-100 p-3 rounded-lg">
              <p className="text-sm text-gray-700">
                {displayModule.status === 'processing'
                  ? "I'm analyzing your video right now. Once processing is complete, I'll be able to help you with specific questions about the training steps!"
                  : "Hi! I'm here to help you with this training. Ask me anything about the current step or the overall process. (Demo mode - polling disabled)"
                }
              </p>
            </div>
            <input
              type="text"
              placeholder={displayModule.status === 'processing' ? 'Chat will be available after processing...' : 'Ask a question... (disabled in dev mode)'}
              disabled={true}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Debug info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="bg-gray-100 p-4 rounded-lg">
          <summary className="cursor-pointer font-medium">Debug Info</summary>
          <pre className="mt-2 text-xs overflow-auto">
            {JSON.stringify({ moduleId, module: displayModule, pollingCount, pollingDisabled: true }, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}