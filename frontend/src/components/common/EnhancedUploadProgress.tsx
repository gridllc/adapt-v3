import React from 'react'
import { Upload, CheckCircle, AlertCircle, XCircle, Pause, Play, RotateCcw } from 'lucide-react'

// 🎯 TypeScript interfaces for full type safety
interface UploadError {
  title: string
  message: string
  action?: string
  severity?: 'low' | 'medium' | 'high'
}

interface UploadStatus {
  type: 'uploading' | 'processing' | 'paused' | 'completed' | 'error' | 'cancelled'
  message: string
  icon: React.ReactNode
  color: string
}

interface Props {
  progress: number
  status: string
  error?: UploadError | null
  fileName?: string
  fileSize?: number
  onRetry: () => void
  onCancel: () => void
  onPause?: () => void
  onResume?: () => void
  className?: string
}

export const EnhancedUploadProgress: React.FC<Props> = ({
  progress,
  status,
  error,
  fileName,
  fileSize,
  onRetry,
  onCancel,
  onPause,
  onResume,
  className = ''
}) => {
  // 🎯 Status mapping for consistent UI
  const getStatusInfo = (status: string): UploadStatus => {
    const lowerStatus = status.toLowerCase()
    
    if (lowerStatus.includes('error') || lowerStatus.includes('failed')) {
      return {
        type: 'error',
        message: 'Upload failed',
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
        color: 'text-red-600'
      }
    }
    
    if (lowerStatus.includes('paused') || lowerStatus.includes('stopped')) {
      return {
        type: 'paused',
        message: 'Upload paused',
        icon: <Pause className="h-5 w-5 text-yellow-500" />,
        color: 'text-yellow-600'
      }
    }
    
    if (lowerStatus.includes('completed') || lowerStatus.includes('success')) {
      return {
        type: 'completed',
        message: 'Upload completed',
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        color: 'text-green-600'
      }
    }
    
    if (lowerStatus.includes('processing') || lowerStatus.includes('ai')) {
      return {
        type: 'processing',
        message: 'Processing video...',
        icon: <Upload className="h-5 w-5 text-blue-500 animate-pulse" />,
        color: 'text-blue-600'
      }
    }
    
    if (lowerStatus.includes('cancelled')) {
      return {
        type: 'cancelled',
        message: 'Upload cancelled',
        icon: <XCircle className="h-5 w-5 text-gray-500" />,
        color: 'text-gray-600'
      }
    }
    
    // Default uploading state
    return {
      type: 'uploading',
      message: 'Uploading...',
      icon: <Upload className="h-5 w-5 text-blue-500" />,
      color: 'text-blue-600'
    }
  }

  const statusInfo = getStatusInfo(status)
  const isPaused = statusInfo.type === 'paused'
  const isCompleted = statusInfo.type === 'completed'
  const isError = statusInfo.type === 'error'
  const isProcessing = statusInfo.type === 'processing'

  // 🎯 Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // 🎯 Get progress bar color based on status
  const getProgressColor = (): string => {
    if (isError) return 'bg-red-500'
    if (isCompleted) return 'bg-green-500'
    if (isProcessing) return 'bg-purple-500'
    if (isPaused) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  return (
    <div className={`p-6 bg-white rounded-lg border shadow-sm space-y-4 w-full max-w-lg ${className}`}>
      {/* 🎯 Header with file info */}
      {fileName && (
        <div className="flex items-center gap-3">
          <Upload className="h-5 w-5 text-gray-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
            {fileSize && (
              <p className="text-xs text-gray-500">{formatFileSize(fileSize)}</p>
            )}
          </div>
        </div>
      )}

      {/* 🎯 Progress Bar with Animation */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm text-gray-500">{progress.toFixed(1)}%</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ease-out ${getProgressColor()}`}
            style={{ 
              width: `${progress}%`,
              transition: 'width 0.5s ease-out'
            }}
          />
        </div>
      </div>

      {/* 🎯 Status Display */}
      <div className="flex items-center gap-2">
        {statusInfo.icon}
        <span className={`text-sm font-medium ${statusInfo.color}`}>
          {statusInfo.message}
        </span>
        {isProcessing && (
          <div className="ml-auto">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
          </div>
        )}
      </div>

      {/* 🎯 Error Message with Enhanced UX */}
      {error && (
        <div className={`mt-4 p-4 rounded-lg border space-y-3 ${
          error.severity === 'high' ? 'bg-red-50 border-red-300' :
          error.severity === 'medium' ? 'bg-yellow-50 border-yellow-300' :
          'bg-blue-50 border-blue-300'
        }`}>
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 font-semibold text-sm">{error.title}</p>
              <p className="text-red-600 text-sm mt-1">{error.message}</p>
              {error.action && (
                <p className="text-red-500 text-xs italic mt-1">{error.action}</p>
              )}
            </div>
          </div>
          
          {/* 🎯 Action Buttons with Accessibility */}
          <div className="flex gap-2 pt-2">
            <button 
              onClick={onRetry}
              className="inline-flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
              aria-label="Retry upload"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </button>
            <button 
              onClick={onCancel}
              className="inline-flex items-center gap-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-2 rounded text-sm font-medium transition-colors"
              aria-label="Cancel upload"
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 🎯 Control Buttons for Pause/Resume */}
      {!isCompleted && !isError && (onPause || onResume) && (
        <div className="flex gap-2 pt-2">
          {isPaused && onResume && (
            <button 
              onClick={onResume}
              className="inline-flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
              aria-label="Resume upload"
            >
              <Play className="h-4 w-4" />
              Resume
            </button>
          )}
          
          {!isPaused && onPause && (
            <button 
              onClick={onPause}
              className="inline-flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
              aria-label="Pause upload"
            >
              <Pause className="h-4 w-4" />
              Pause
            </button>
          )}
          
          <button 
            onClick={onCancel}
            className="inline-flex items-center gap-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-2 rounded text-sm font-medium transition-colors"
            aria-label="Cancel upload"
          >
            <XCircle className="h-4 w-4" />
            Cancel
          </button>
        </div>
      )}

      {/* 🎯 Success State */}
      {isCompleted && (
        <div className="mt-4 p-3 bg-green-50 border border-green-300 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-green-700 font-medium text-sm">Upload completed successfully!</span>
          </div>
        </div>
      )}
    </div>
  )
}

// 🎯 Convenience wrapper for simple progress display
export const SimpleUploadProgress: React.FC<{
  progress: number
  status: string
  className?: string
}> = ({ progress, status, className = '' }) => {
  return (
    <div className={`p-4 bg-white rounded-lg border ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{status}</span>
        <span className="text-sm text-gray-500">{progress.toFixed(1)}%</span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div 
          className="bg-blue-500 h-full transition-all duration-300 ease-out" 
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export default EnhancedUploadProgress 