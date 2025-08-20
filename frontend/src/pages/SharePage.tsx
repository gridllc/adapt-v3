import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../config/api'

interface Step {
  id: string
  title: string
  description: string
  timestamp?: number
  duration?: number
  aliases?: string[]
  notes?: string
}

interface ModuleData {
  id: string
  title: string
  filename: string
  createdAt: string
  steps: Step[]
  stats?: any
  transcript?: any
}

export default function SharePage() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [data, setData] = useState<ModuleData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState<Step | null>(null)

  useEffect(() => {
    const loadModule = async () => {
      if (!moduleId) {
        setError('No module ID provided')
        setLoading(false)
        return
      }

      try {
        console.log(`🔗 Loading shared module: ${moduleId}`)
        const response = await api.get(`/share/${moduleId}`)
        
        if (response.data.success) {
          setData(response.data.module)
          console.log(`✅ Loaded shared module: ${response.data.module.title}`)
        } else {
          setError('Failed to load module')
        }
      } catch (err: any) {
        console.error('❌ Error loading shared module:', err)
        if (err.response?.status === 404) {
          setError('This training module could not be found or is no longer available.')
        } else {
          setError('Could not load training module. Please try again.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadModule()
  }, [moduleId])

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || !data?.steps) return

    const currentTime = videoRef.current.currentTime
    const step = data.steps.find(s => {
      const start = s.timestamp || 0
      const end = start + (s.duration || 30)
      return currentTime >= start && currentTime <= end
    })

    setCurrentStep(step || null)
  }

  const seekToStep = (step: Step) => {
    if (videoRef.current && step.timestamp !== undefined) {
      videoRef.current.currentTime = step.timestamp
    }
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading training module...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Module Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No module data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{data.title}</h1>
              <p className="text-sm text-gray-500">
                Shared training module • {new Date(data.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border">
              <video
                ref={videoRef}
                controls
                className="w-full rounded-t-lg"
                onTimeUpdate={handleVideoTimeUpdate}
                src={`/api/video-url/${moduleId}`}
              >
                Your browser does not support the video tag.
              </video>
              
              {/* Current Step Indicator */}
              {currentStep && (
                <div className="p-4 border-t bg-blue-50">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 font-semibold">Current Step:</span>
                    <span className="font-medium">{currentStep.title}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{currentStep.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Steps List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h2 className="text-lg font-semibold mb-4">Training Steps</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {data.steps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      currentStep?.id === step.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => seekToStep(step)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-500">
                            {index + 1}
                          </span>
                          <h3 className="font-medium text-gray-900">{step.title}</h3>
                        </div>
                        <p className="text-sm text-gray-600">{step.description}</p>
                        {step.timestamp !== undefined && (
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTime(step.timestamp)}
                          </p>
                        )}
                      </div>
                      {currentStep?.id === step.id && (
                        <span className="text-blue-600 text-sm">▶️</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 rounded-lg p-4 mt-4">
              <h3 className="font-semibold text-blue-900 mb-2">How to Use</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Click any step to jump to that part of the video</li>
                <li>• Follow along with the highlighted current step</li>
                <li>• No login required - just press play and learn!</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 