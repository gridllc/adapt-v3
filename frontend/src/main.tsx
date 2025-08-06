import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import { ErrorBoundary } from '@components/common/ErrorBoundary'
import App from './App'
import './index.css'

// Disable console errors in production to prevent Sentry-like rate limiting
if (import.meta.env.PROD) {
  const originalError = console.error
  console.error = (...args) => {
    // Only log critical errors, suppress others
    if (args[0]?.includes?.('Sentry') || args[0]?.includes?.('rate limit')) {
      return
    }
    originalError(...args)
  }
}

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

// Configuration Error Component
const ConfigurationError: React.FC = () => (
  <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
      <div className="text-red-500 text-5xl mb-4">⚠️</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Configuration Error</h1>
      <p className="text-gray-600 mb-6">
        The Clerk authentication service is not properly configured. 
        Please check that either <code className="bg-gray-100 px-2 py-1 rounded">VITE_CLERK_PUBLISHABLE_KEY</code> or <code className="bg-gray-100 px-2 py-1 rounded">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> environment variable is set.
      </p>
      <div className="text-sm text-gray-500">
        If you're a developer, check the console for more details.
      </div>
    </div>
  </div>
)

// Main App Wrapper with Error Handling
const AppWrapper: React.FC = () => {
  if (!CLERK_PUBLISHABLE_KEY) {
    console.error('❌ Missing Clerk Publishable Key')
    return <ConfigurationError />
  }

  return (
    <ErrorBoundary>
      <ClerkProvider 
        publishableKey={CLERK_PUBLISHABLE_KEY}
        afterSignInUrl="/dashboard"
        afterSignUpUrl="/dashboard"
        appearance={{
          baseTheme: undefined,
          variables: {
            colorPrimary: "#2563eb"
          }
        }}
      >
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <App />
        </BrowserRouter>
      </ClerkProvider>
    </ErrorBoundary>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
) 