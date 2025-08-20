import React, { useState, useEffect } from 'react'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pollingCount, setPollingCount] = useState(0)

  // Fetch module data
  const fetchModule = async () => {
    if (!moduleId) return

    try {
      console.log(`Fetching module ${moduleId}, attempt ${pollingCount + 1}`)
      
      const response = await fetch(`/api/modules/${moduleId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch module: ${response.status}`)
      }
      
      const moduleData = await response.json()
      console.log('Module data received:', moduleData)
      
      setModule(moduleData)
      setLoading(false)
      setPollingCount(prev => prev + 1)
      
      // Stop polling if module is ready or error
      if (moduleData.status === 'ready' || moduleData.status === 'error') {
        console.log(`Module ${moduleId} is ${moduleData.status}, stopping polling`)
        return true // Signal to stop polling
      }
      
      return false // Continue polling
    } catch (err) {
      console.error('Error fetching module:', err)
      setError(err instanceof Error ? err.message : 'Failed to load module')
      setLoading(false)
      setPollingCount(prev => prev + 1)
      
      // Stop polling on error after 5 attempts
      if (pollingCount >= 5) {
        console.log('Max polling attempts reached, stopping')
        return true
      }
      
      return false
    }
  }

  useEffect(() => {
    if (!moduleId) {
      setError('No module ID provided')
      setLoading(false)
      return
    }

    let pollInterval: NodeJS.Timeout | null = null
    let maxAttempts = 20 // Maximum 20 attempts (2 minutes at 6 second intervals)

    const startPolling = async () => {
      // Initial fetch
      const shouldStop = await fetchModule()
      
      if (shouldStop) {
        return
      }

      // Set up polling interval
      pollInterval = setInterval(async () => {
        console.log(`Polling attempt ${pollingCount + 1}/${maxAttempts}`)
        
        if (pollingCount >= maxAttempts) {
          console.log('Max polling attempts reached, stopping')
          clearInterval(pollInterval!)
          setError('Processing is taking longer than expected. Please try again later.')
          return
        }

        const shouldStop = await fetchModule()
        
        if (shouldStop && pollInterval) {
          clearInterval(pollInterval)
        }
      }, 6000) // Poll every 6 seconds
    }

    startPolling()

    // Cleanup on unmount
    return () => {
      if (pollInterval) {
        console.log('Cleaning up polling interval')
        clearInterval(pollInterval)
      }
    }
  }, [moduleId]) // Only depend on moduleId

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
              fetchModule()
            }}
            className="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!module) {
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
        <h1 className="text-3xl font-bold text-gray-900">{module.title}</h1>
        
        {/* Status indicator */}
        <div className="flex items-center space-x-2">
          {module.status === 'processing' && (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-blue-600 font-medium">Processing... ({pollingCount} checks)</span>
            </>
          )}
          {module.status === 'ready' && (
            <span className="text-green-600 font-medium">✓ Ready</span>
          )}
          {module.status === 'error' && (
            <span className="text-red-600 font-medium">✗ Error</span>
          )}
        </div>
      </div>

      <p className="text-gray-600">{module.description}</p>
      
      {/* Show processing message */}
      {module.status === 'processing' && (
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
      {module.status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">
            ❌ There was an error processing your video: {module.error || 'Unknown error'}
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Player */}
        <div className="lg:col-span-2">
          <div className="bg-black rounded-lg aspect-video">
            {module.videoUrl && module.status === 'ready' ? (
              <video 
                controls 
                className="w-full h-full rounded-lg"
                src={module.videoUrl}
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="flex items-center justify-center h-full text-white">
                {module.status === 'processing' ? 'Video Processing...' : 'Video Player Placeholder'}
              </div>
            )}
          </div>
          
          {/* Training Steps */}
          {module.steps && module.steps.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Training Steps</h3>
              {module.steps.map((step, index) => (
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
                {module.status === 'processing' 
                  ? "I'm analyzing your video right now. Once processing is complete, I'll be able to help you with specific questions about the training steps!"
                  : "Hi! I'm here to help you with this training. Ask me anything about the current step or the overall process."
                }
              </p>
            </div>
            <input
              type="text"
              placeholder={module.status === 'processing' ? 'Chat will be available after processing...' : 'Ask a question...'}
              disabled={module.status === 'processing'}
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
            {JSON.stringify({ moduleId, module, pollingCount }, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
} 