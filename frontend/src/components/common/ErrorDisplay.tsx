import React from 'react'
import { AlertCircle, RefreshCw, X, Wifi, WifiOff, Clock, Shield, HardDrive } from 'lucide-react'
import { UploadErrorType, ErrorResponse } from '../../utils/uploadErrors'

interface ErrorDisplayProps {
  error: ErrorResponse
  errorType: UploadErrorType
  onRetry?: () => void
  onDismiss?: () => void
  fileName?: string
  showDetails?: boolean
}

const getErrorIcon = (errorType: UploadErrorType) => {
  switch (errorType) {
    case UploadErrorType.NETWORK_TIMEOUT:
      return <WifiOff className="h-6 w-6" />
    case UploadErrorType.FILE_TOO_LARGE:
      return <HardDrive className="h-6 w-6" />
    case UploadErrorType.INVALID_FORMAT:
      return <AlertCircle className="h-6 w-6" />
    case UploadErrorType.AUTHENTICATION:
      return <Shield className="h-6 w-6" />
    case UploadErrorType.COMPRESSION_FAILED:
      return <AlertCircle className="h-6 w-6" />
    case UploadErrorType.STORAGE_FULL:
      return <HardDrive className="h-6 w-6" />
    case UploadErrorType.SERVER_ERROR:
      return <AlertCircle className="h-6 w-6" />
    default:
      return <AlertCircle className="h-6 w-6" />
  }
}

const getSeverityStyles = (severity: 'low' | 'medium' | 'high') => {
  switch (severity) {
    case 'low':
      return 'bg-yellow-50 border-yellow-200 text-yellow-800'
    case 'medium':
      return 'bg-orange-50 border-orange-200 text-orange-800'
    case 'high':
      return 'bg-red-50 border-red-200 text-red-800'
    default:
      return 'bg-gray-50 border-gray-200 text-gray-800'
  }
}

const getButtonStyles = (severity: 'low' | 'medium' | 'high') => {
  switch (severity) {
    case 'low':
      return 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-300'
    case 'medium':
      return 'bg-orange-100 hover:bg-orange-200 text-orange-800 border-orange-300'
    case 'high':
      return 'bg-red-100 hover:bg-red-200 text-red-800 border-red-300'
    default:
      return 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300'
  }
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  errorType,
  onRetry,
  onDismiss,
  fileName,
  showDetails = false
}) => {
  const severityStyles = getSeverityStyles(error.severity)
  const buttonStyles = getButtonStyles(error.severity)

  return (
    <div className={`rounded-lg border-2 p-4 ${severityStyles}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {getErrorIcon(errorType)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">{error.title}</h3>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="flex-shrink-0 p-1 rounded-full hover:bg-black/10"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <p className="text-sm mb-2">{error.message}</p>
          
          {fileName && (
            <p className="text-xs opacity-75 mb-3">
              File: {fileName}
            </p>
          )}
          
          <p className="text-sm font-medium mb-4">
            💡 {error.action}
          </p>
          
          <div className="flex gap-2 flex-wrap">
            {error.retryable && onRetry && (
              <button
                onClick={onRetry}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${buttonStyles}`}
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
            )}
            
            {errorType === UploadErrorType.AUTHENTICATION && (
              <button
                onClick={() => window.location.href = '/sign-in'}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${buttonStyles}`}
              >
                <Shield className="h-4 w-4" />
                Sign In
              </button>
            )}
            
            <button
              onClick={() => window.location.href = 'mailto:support@adaptord.com'}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
            >
              Contact Support
            </button>
          </div>
          
          {showDetails && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs opacity-75 hover:opacity-100">
                Technical Details
              </summary>
              <div className="mt-2 p-2 bg-black/5 rounded text-xs font-mono">
                <div>Error Type: {errorType}</div>
                <div>Severity: {error.severity}</div>
                <div>Retryable: {error.retryable ? 'Yes' : 'No'}</div>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}

// Toast-style error notification
export const ErrorToast: React.FC<{
  error: ErrorResponse
  errorType: UploadErrorType
  onRetry?: () => void
  onDismiss: () => void
  autoHide?: boolean
  duration?: number
}> = ({ 
  error, 
  errorType, 
  onRetry, 
  onDismiss, 
  autoHide = true, 
  duration = 5000 
}) => {
  React.useEffect(() => {
    if (autoHide && !error.retryable) {
      const timer = setTimeout(() => {
        onDismiss()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [autoHide, duration, onDismiss, error.retryable])

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-slide-up">
      <ErrorDisplay
        error={error}
        errorType={errorType}
        onRetry={onRetry}
        onDismiss={onDismiss}
        showDetails={false}
      />
    </div>
  )
}
