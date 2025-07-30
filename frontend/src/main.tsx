import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import { ErrorBoundary } from '@components/common/ErrorBoundary'
import App from './App'
import './index.css'

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

console.log('Clerk Key Debug:', {
  keyExists: !!CLERK_PUBLISHABLE_KEY,
  keyLength: CLERK_PUBLISHABLE_KEY?.length,
  keyPrefix: CLERK_PUBLISHABLE_KEY?.substring(0, 20),
  allEnvVars: Object.keys(import.meta.env).filter(key => key.includes('CLERK'))
})

if (!CLERK_PUBLISHABLE_KEY) {
  console.error('❌ Missing Clerk Publishable Key')
  throw new Error('Missing Clerk Publishable Key')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
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
  </React.StrictMode>,
) 