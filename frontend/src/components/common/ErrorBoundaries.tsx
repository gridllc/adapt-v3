import React from 'react'
import SmartErrorBoundary from './SmartErrorBoundary'
import { AlertTriangle, RefreshCw, Upload, Video, Brain } from 'lucide-react'
import { DEBUG_UI } from '../../config/app'

// 🎯 Upload-specific error boundary
export const UploadErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const handleUploadError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('📤 Upload Error Boundary caught:', error.message)
    // 🎯 Could send to analytics: "upload_error", { error: error.message }
  }

  const uploadFallback = (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center gap-3 mb-4">
        <Upload className="h-6 w-6 text-red-500" />
        <div>
          <h3 className="text-lg font-semibold text-red-800">Upload Error</h3>
          <p className="text-sm text-red-600">Something went wrong during upload</p>
        </div>
      </div>
      <div className="space-y-2 text-sm text-red-700">
        <p>• Check your internet connection</p>
        <p>• Try a smaller video file</p>
        <p>• Make sure the video format is supported</p>
      </div>
    </div>
  )

  return (
    <SmartErrorBoundary
      fallback={uploadFallback}
      onError={handleUploadError}
      showDetails={false}
    >
      {children}
    </SmartErrorBoundary>
  )
}

// 🎯 Video processing error boundary
export const VideoProcessingErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const handleProcessingError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('🎬 Video Processing Error Boundary caught:', error.message)
    // 🎯 Could send to analytics: "processing_error", { error: error.message }
  }

  const processingFallback = (
    <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-center gap-3 mb-4">
        <Video className="h-6 w-6 text-yellow-600" />
        <div>
          <h3 className="text-lg font-semibold text-yellow-800">Processing Issue</h3>
          <p className="text-sm text-yellow-600">Video processing encountered a problem</p>
        </div>
      </div>
      <div className="space-y-2 text-sm text-yellow-700">
        <p>• The video may be corrupted or in an unsupported format</p>
        <p>• Try uploading a different video file</p>
        <p>• Contact support if the issue persists</p>
      </div>
    </div>
  )

  return (
    <SmartErrorBoundary
      fallback={processingFallback}
      onError={handleProcessingError}
      showDetails={false}
    >
      {children}
    </SmartErrorBoundary>
  )
}

// 🎯 AI/ML processing error boundary
export const AIProcessingErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const handleAIError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('🧠 AI Processing Error Boundary caught:', error.message)
    // 🎯 Could send to analytics: "ai_error", { error: error.message }
  }

  const aiFallback = (
    <div className="p-6 bg-purple-50 border border-purple-200 rounded-lg">
      <div className="flex items-center gap-3 mb-4">
        <Brain className="h-6 w-6 text-purple-600" />
        <div>
          <h3 className="text-lg font-semibold text-purple-800">AI Processing Error</h3>
          <p className="text-sm text-purple-600">AI analysis encountered an issue</p>
        </div>
      </div>
      <div className="space-y-2 text-sm text-purple-700">
        <p>• The AI service may be temporarily unavailable</p>
        <p>• Your video will be processed when service resumes</p>
        <p>• No data has been lost</p>
      </div>
    </div>
  )

  return (
    <SmartErrorBoundary
      fallback={aiFallback}
      onError={handleAIError}
      showDetails={false}
    >
      {children}
    </SmartErrorBoundary>
  )
}

// 🎯 Navigation error boundary (catches routing issues)
export const NavigationErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const handleNavigationError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('🧭 Navigation Error Boundary caught:', error.message)
    // 🎯 Could send to analytics: "navigation_error", { error: error.message }
  }

  const navigationFallback = (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-blue-600" />
        <span className="text-sm text-blue-800">Page navigation issue detected</span>
        <button
          onClick={() => window.location.reload()}
          className="ml-auto text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>
    </div>
  )

  return (
    <SmartErrorBoundary
      fallback={navigationFallback}
      onError={handleNavigationError}
      showDetails={false}
    >
      {children}
    </SmartErrorBoundary>
  )
}

// 🎯 Form error boundary (catches form-related issues)
export const FormErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const handleFormError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('📝 Form Error Boundary caught:', error.message)
    // 🎯 Could send to analytics: "form_error", { error: error.message }
  }

  const formFallback = (
    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <span className="text-sm text-orange-800">Form interaction issue</span>
        <button
          onClick={() => window.location.reload()}
          className="ml-auto text-xs bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700"
        >
          Reload
        </button>
      </div>
    </div>
  )

  return (
    <SmartErrorBoundary
      fallback={formFallback}
      onError={handleFormError}
      showDetails={false}
    >
      {children}
    </SmartErrorBoundary>
  )
}

// 🎯 Global app error boundary (catches everything else)
export const GlobalErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const handleGlobalError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('🌍 Global Error Boundary caught:', error.message)
    // 🎯 Could send to analytics: "global_error", { error: error.message }
  }

  return (
    <SmartErrorBoundary
      onError={handleGlobalError}
      showDetails={DEBUG_UI}
    >
      {children}
    </SmartErrorBoundary>
  )
}

// 🎯 Debug error boundary (shows all details in development)
export const DebugErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const handleDebugError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('🐛 Debug Error Boundary caught:', error.message)
    // 🎯 Enhanced logging for development
    console.group('🐛 Debug Error Details')
    console.log('Error:', error)
    console.log('Error Info:', errorInfo)
    console.log('Component Stack:', errorInfo.componentStack)
    console.groupEnd()
  }

  return (
    <SmartErrorBoundary
      onError={handleDebugError}
      showDetails={true}
      className="border-2 border-red-300"
    >
      {children}
    </SmartErrorBoundary>
  )
} 