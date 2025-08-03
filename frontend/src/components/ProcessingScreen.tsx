import React from 'react'

interface ProcessingScreenProps {
  progress: number
  message?: string
}

export const ProcessingScreen: React.FC<ProcessingScreenProps> = ({ progress, message }) => {
  const getProgressMessage = (progress: number) => {
    if (progress < 10) return "Starting AI analysis..."
    if (progress < 30) return "Analyzing video content..."
    if (progress < 50) return "Extracting learning steps..."
    if (progress < 70) return "Enhancing with AI..."
    if (progress < 90) return "Finalizing training module..."
    return "Almost ready..."
  }

  const getProgressColor = (progress: number) => {
    if (progress < 30) return 'from-blue-500 to-blue-600'
    if (progress < 60) return 'from-indigo-500 to-indigo-600'
    if (progress < 90) return 'from-purple-500 to-purple-600'
    return 'from-green-500 to-green-600'
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="text-6xl mb-6 animate-pulse">🧠</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            AI is Processing Your Video
          </h2>
          <p className="text-lg text-gray-600 mb-6">
            {message || getProgressMessage(progress)}
          </p>
        </div>

        <div className="space-y-4">
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div 
              className={`bg-gradient-to-r ${getProgressColor(progress)} h-4 rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-500">
              {progress}% complete • This usually takes 30-60 seconds
            </p>
          </div>
        </div>

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Processing in background</span>
          </div>
          <p className="text-xs text-gray-400">
            You can close this page and come back later
          </p>
        </div>

        {/* Processing steps indicator */}
        <div className="bg-white/50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Processing Steps:</h4>
          <div className="space-y-1 text-xs text-gray-600">
            <div className={`flex items-center gap-2 ${progress >= 10 ? 'text-green-600' : 'text-gray-400'}`}>
              <span>{progress >= 10 ? '✅' : '⏳'}</span>
              <span>Upload & validation</span>
            </div>
            <div className={`flex items-center gap-2 ${progress >= 30 ? 'text-green-600' : 'text-gray-400'}`}>
              <span>{progress >= 30 ? '✅' : '⏳'}</span>
              <span>AI video analysis</span>
            </div>
            <div className={`flex items-center gap-2 ${progress >= 60 ? 'text-green-600' : 'text-gray-400'}`}>
              <span>{progress >= 60 ? '✅' : '⏳'}</span>
              <span>Step extraction</span>
            </div>
            <div className={`flex items-center gap-2 ${progress >= 90 ? 'text-green-600' : 'text-gray-400'}`}>
              <span>{progress >= 90 ? '✅' : '⏳'}</span>
              <span>AI enhancement</span>
            </div>
            <div className={`flex items-center gap-2 ${progress >= 100 ? 'text-green-600' : 'text-gray-400'}`}>
              <span>{progress >= 100 ? '✅' : '⏳'}</span>
              <span>Finalizing module</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 