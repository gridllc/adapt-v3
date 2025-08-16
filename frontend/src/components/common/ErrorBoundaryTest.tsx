import React, { useState } from 'react'
import SmartErrorBoundary from './SmartErrorBoundary'

// 🧪 Test component that throws errors
const BuggyComponent: React.FC<{ errorType: 'render' | 'effect' | 'event' }> = ({ errorType }) => {
  const [shouldThrow, setShouldThrow] = useState(false)

  // 🚨 Simulate different types of errors
  if (errorType === 'render' && shouldThrow) {
    throw new Error('🚨 Render Error: This is a simulated render error')
  }

  React.useEffect(() => {
    if (errorType === 'effect' && shouldThrow) {
      throw new Error('🚨 Effect Error: This is a simulated effect error')
    }
  }, [errorType, shouldThrow])

  const handleClick = () => {
    if (errorType === 'event') {
      throw new Error('🚨 Event Error: This is a simulated event error')
    }
    setShouldThrow(true)
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold mb-2">🧪 Error Test Component</h3>
      <p className="text-sm text-gray-600 mb-3">
        Testing error boundary with: <code>{errorType}</code> error
      </p>
      <button
        onClick={handleClick}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Trigger {errorType} Error
      </button>
    </div>
  )
}

// 🎯 Error Boundary Test Page
export const ErrorBoundaryTest: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">🧪 Error Boundary Testing</h1>
        <p className="text-gray-600">Test different error scenarios and error boundary behavior</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 🚨 Render Error Test */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Render Error</h3>
          <SmartErrorBoundary showDetails={true}>
            <BuggyComponent errorType="render" />
          </SmartErrorBoundary>
        </div>

        {/* 🚨 Effect Error Test */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Effect Error</h3>
          <SmartErrorBoundary showDetails={true}>
            <BuggyComponent errorType="effect" />
          </SmartErrorBoundary>
        </div>

        {/* 🚨 Event Error Test */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Event Error</h3>
          <SmartErrorBoundary showDetails={true}>
            <BuggyComponent errorType="event" />
          </SmartErrorBoundary>
        </div>
      </div>

      {/* 📊 Error Boundary Features Demo */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">🎯 Error Boundary Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-semibold mb-2">✅ What Error Boundaries Catch:</h4>
            <ul className="space-y-1 text-gray-700">
              <li>• JavaScript errors in render</li>
              <li>• JavaScript errors in lifecycle methods</li>
              <li>• JavaScript errors in constructors</li>
              <li>• JavaScript errors in event handlers</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">❌ What Error Boundaries Don't Catch:</h4>
            <ul className="space-y-1 text-gray-700">
              <li>• Event handlers (use try/catch)</li>
              <li>• Asynchronous code (use try/catch)</li>
              <li>• Server-side rendering</li>
              <li>• Errors thrown in the error boundary itself</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 🔧 Custom Error Handler Demo */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">🔧 Custom Error Handler</h3>
        <p className="text-sm text-gray-700 mb-3">
          Error boundaries can call custom error handlers for logging, analytics, or other side effects.
        </p>
        <SmartErrorBoundary
          onError={(error, errorInfo) => {
            console.group('🎯 Custom Error Handler')
            console.log('Error:', error.message)
            console.log('Component Stack:', errorInfo.componentStack)
            console.log('Timestamp:', new Date().toISOString())
            console.groupEnd()
          }}
          showDetails={false}
        >
          <div className="p-4 border rounded">
            <button
              onClick={() => {
                throw new Error('🎯 Custom handler test error')
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Test Custom Error Handler
            </button>
          </div>
        </SmartErrorBoundary>
      </div>
    </div>
  )
}

export default ErrorBoundaryTest 
