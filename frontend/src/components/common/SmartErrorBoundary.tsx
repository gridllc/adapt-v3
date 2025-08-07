import React from 'react'
import { AlertTriangle, RefreshCw, Home, Bug, XCircle } from 'lucide-react'

interface Props {
  fallback?: React.ReactNode
  children: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  showDetails?: boolean
  className?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  errorId: string | null
  retryCount: number
}

class SmartErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    return { 
      hasError: true, 
      error,
      errorId
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    
    // 🧠 Enhanced error logging
    console.error('🚨 SmartErrorBoundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    })

    // 📊 Call custom error handler if provided
    this.props.onError?.(error, errorInfo)

    // 🎯 Optional: Send to error tracking service
    this.logErrorToService(error, errorInfo)
  }

  logErrorToService = (error: Error, errorInfo: React.ErrorInfo) => {
    // 🚀 Example: Send to your error tracking service
    // In production, you might send to Sentry, LogRocket, etc.
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorId: this.state.errorId,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      }
      
      // 📝 Log to console for now, but could send to API
      console.group('📊 Error Report')
      console.log('Error ID:', this.state.errorId)
      console.log('Error Data:', errorData)
      console.groupEnd()
      
      // 🎯 Future: Send to your backend
      // fetch('/api/errors', { method: 'POST', body: JSON.stringify(errorData) })
      
    } catch (logError) {
      console.warn('Failed to log error:', logError)
    }
  }

  handleRetry = () => {
    const { retryCount } = this.state
    const maxRetries = 3
    
    if (retryCount >= maxRetries) {
      // 🚨 Too many retries - suggest page refresh
      if (confirm('Multiple retries failed. Would you like to refresh the page?')) {
        window.location.reload()
      }
      return
    }

    console.log(`🔄 Retrying component (attempt ${retryCount + 1}/${maxRetries})`)
    
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }))
  }

  handleRefresh = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  handleDismiss = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  getErrorSeverity = (error: Error): 'low' | 'medium' | 'high' => {
    const message = error.message.toLowerCase()
    
    // 🎯 Classify errors by severity
    if (message.includes('network') || message.includes('fetch')) {
      return 'medium' // Network errors are often temporary
    }
    if (message.includes('syntax') || message.includes('parsing')) {
      return 'high' // Syntax errors are usually serious
    }
    if (message.includes('timeout')) {
      return 'medium' // Timeouts might resolve
    }
    
    return 'high' // Default to high severity
  }

  getErrorMessage = (error: Error): string => {
    const message = error.message.toLowerCase()
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network connection issue detected'
    }
    if (message.includes('timeout')) {
      return 'Request timed out - please try again'
    }
    if (message.includes('syntax') || message.includes('parsing')) {
      return 'Application encountered a technical issue'
    }
    if (message.includes('unauthorized') || message.includes('401')) {
      return 'Authentication required - please sign in again'
    }
    
    return 'Something unexpected happened'
  }

  render() {
    const { hasError, error, errorInfo, errorId, retryCount } = this.state
    const { fallback, showDetails = false, className = '' } = this.props

    if (hasError) {
      // 🎨 Custom fallback UI
      if (fallback) {
        return fallback
      }

      const severity = error ? this.getErrorSeverity(error) : 'high'
      const userMessage = error ? this.getErrorMessage(error) : 'An unexpected error occurred'

      return (
        <div className={`p-6 rounded-lg border shadow-sm ${className}`}>
          {/* 🎨 Severity-based styling */}
          <div className={`
            ${severity === 'high' ? 'bg-red-50 border-red-200 text-red-800' : ''}
            ${severity === 'medium' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : ''}
            ${severity === 'low' ? 'bg-blue-50 border-blue-200 text-blue-800' : ''}
            border rounded-lg p-4
          `}>
            
            {/* 🚨 Error Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0">
                {severity === 'high' && <XCircle className="h-6 w-6 text-red-500" />}
                {severity === 'medium' && <AlertTriangle className="h-6 w-6 text-yellow-500" />}
                {severity === 'low' && <Bug className="h-6 w-6 text-blue-500" />}
              </div>
              
              <div className="flex-1">
                <h2 className="text-lg font-semibold mb-1">
                  {severity === 'high' ? '🚨 Critical Error' : 
                   severity === 'medium' ? '⚠️ Temporary Issue' : '🐛 Minor Issue'}
                </h2>
                <p className="text-sm opacity-90">{userMessage}</p>
                {errorId && (
                  <p className="text-xs opacity-60 mt-1">
                    Error ID: {errorId}
                  </p>
                )}
              </div>
            </div>

            {/* 📋 Error Details (if enabled) */}
            {showDetails && error && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm font-medium mb-2">
                  Technical Details
                </summary>
                <div className="bg-black/5 rounded p-3 text-xs font-mono overflow-auto max-h-40">
                  <div className="mb-2">
                    <strong>Error:</strong> {error.message}
                  </div>
                  {error.stack && (
                    <div className="mb-2">
                      <strong>Stack:</strong>
                      <pre className="whitespace-pre-wrap mt-1">{error.stack}</pre>
                    </div>
                  )}
                  {errorInfo?.componentStack && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="whitespace-pre-wrap mt-1">{errorInfo.componentStack}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* 🎯 Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={this.handleRetry}
                disabled={retryCount >= 3}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                {retryCount >= 3 ? 'Max Retries' : 'Try Again'}
              </button>
              
              <button
                onClick={this.handleRefresh}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Page
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Home className="h-4 w-4" />
                Go Home
              </button>
              
              {severity === 'low' && (
                <button
                  onClick={this.handleDismiss}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-transparent text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Dismiss
                </button>
              )}
            </div>

            {/* 📊 Retry Counter */}
            {retryCount > 0 && (
              <div className="mt-3 text-xs opacity-60">
                Retry attempts: {retryCount}/3
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default SmartErrorBoundary

// 🎯 Convenience wrapper for common use cases
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: React.ReactNode
    showDetails?: boolean
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  }
) => {
  return (props: P) => (
    <SmartErrorBoundary {...options}>
      <Component {...props} />
    </SmartErrorBoundary>
  )
} 