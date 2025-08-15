import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import { ErrorBoundary } from '@components/common/ErrorBoundary'
import App from './App'
import './index.css'
import { CLERK_PUBLISHABLE_KEY, IS_PROD } from './config/app'
import { ensureHttps } from './utils/secure-context'

// P0: Force HTTPS immediately (critical for microphone access)
ensureHttps()

// Disable console errors in production to prevent Sentry-like rate limiting
if (IS_PROD) {
  const originalError = console.error
  console.error = (...args) => {
    // Only log critical errors, suppress others
    if (args[0]?.includes?.('Sentry') || args[0]?.includes?.('rate limit')) {
      return
    }
    originalError(...args)
  }
}

// Get Clerk publishable key with fail-fast validation
const pk = CLERK_PUBLISHABLE_KEY
if (!pk) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable')
}

// Debug: Environment variables
console.log('🔧 Environment Check:', {
  VITE_CLERK_PUBLISHABLE_KEY: pk ? 'Set' : 'Missing',
  NODE_ENV: import.meta.env.MODE,
  pk_length: pk ? pk.length : 0,
  pk_prefix: pk ? pk.substring(0, 10) + '...' : 'N/A'
})

// Configuration Error Component
const ConfigurationError: React.FC = () => (
  <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
      <div className="text-red-500 text-5xl mb-4">⚠️</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Configuration Error</h1>
      <p className="text-gray-600 mb-6">
        The Clerk authentication service is not properly configured. 
        Please check that <code className="bg-gray-100 px-2 py-1 rounded">VITE_CLERK_PUBLISHABLE_KEY</code> environment variable is set.
      </p>
      <div className="text-sm text-gray-500">
        If you're a developer, check the console for more details.
      </div>
    </div>
  </div>
)

// Main App Wrapper with Error Handling
const AppWrapper: React.FC = () => {
  // Get the current domain for redirects
  const currentDomain = window.location.origin
  const dashboardUrl = `${currentDomain}/dashboard`
  
  console.log('🔧 Clerk Configuration:', {
    currentDomain,
    dashboardUrl,
    publishableKey: pk ? 'Set' : 'Missing'
  })

  return (
    <ErrorBoundary>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ClerkProvider 
          publishableKey={pk}
          appearance={{
            baseTheme: undefined,
            variables: {
              colorPrimary: "#2563eb"
            }
          }}
        >
          <App />
        </ClerkProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

// Create root and render with error boundary
const root = ReactDOM.createRoot(document.getElementById('root')!)

try {
  root.render(
    <React.StrictMode>
      <AppWrapper />
    </React.StrictMode>
  )
} catch (error) {
  console.error('❌ Failed to render app:', error)
  root.render(<ConfigurationError />)
} 