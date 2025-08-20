import React, { useState, useEffect } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { API_CONFIG, API_ENDPOINTS, api } from '../config/api'

export const ApiDebug: React.FC = () => {
  const [apiInfo, setApiInfo] = useState<any>({})
  const [testResults, setTestResults] = useState<any>({})
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()

  useEffect(() => {
    setApiInfo({
      isDev: import.meta.env.MODE === 'development',
      mode: import.meta.env.MODE,
      baseURL: API_CONFIG.baseURL,
      proxy: 'Vercel will proxy /api/* to Render backend',
      modulesUrl: API_CONFIG.getApiUrl(API_ENDPOINTS.MODULES),
      healthUrl: API_CONFIG.getApiUrl(API_ENDPOINTS.HEALTH),
      origin: window.location.origin,
          clerkKey: (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) ? 'Set' : 'Missing',
    clerkKeyPrefix: (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)?.substring(0, 20) + '...',
    clerkKeyLength: (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)?.length || 0,
      clerkLoaded: isLoaded,
      clerkSignedIn: isSignedIn,
      clerkUser: user?.emailAddresses?.[0]?.emailAddress || 'None',
    })
  }, [])

  const testDirect = async () => {
    try {
      const response = await fetch('/api/health')
      const data = await response.json()
      setTestResults(prev => ({ ...prev, direct: { success: true, data } }))
    } catch (error) {
      setTestResults(prev => ({ ...prev, direct: { success: false, error: error.message } }))
    }
  }

  const testViaConfig = async () => {
    try {
      const data = await api.get('/api/health')
      setTestResults(prev => ({ ...prev, config: { success: true, data } }))
    } catch (error) {
      setTestResults(prev => ({ ...prev, config: { success: false, error: error.message } }))
    }
  }

  const testModules = async () => {
    try {
      const url = API_CONFIG.getApiUrl(API_ENDPOINTS.MODULES)
      const response = await fetch(url)
      const data = await response.json()
      setTestResults(prev => ({ ...prev, modules: { success: true, data } }))
    } catch (error) {
      setTestResults(prev => ({ ...prev, modules: { success: false, error: error.message } }))
    }
  }

  return (
    <div className="fixed top-4 right-4 bg-white border-2 border-blue-500 p-4 rounded shadow-lg max-w-md text-xs z-50 max-h-96 overflow-y-auto">
      <h3 className="font-bold mb-2 text-blue-600">🔧 API Debug Panel</h3>
      
      <div className="mb-3">
        <strong>Config Info:</strong>
        <pre className="bg-gray-100 p-2 rounded mt-1 whitespace-pre-wrap text-xs">
          {JSON.stringify(apiInfo, null, 2)}
        </pre>
      </div>

      <div className="space-y-2 mb-3">
        <button onClick={testDirect} className="bg-green-500 text-white px-2 py-1 rounded text-xs w-full">
          Test Direct Render
        </button>
        <button onClick={testViaConfig} className="bg-blue-500 text-white px-2 py-1 rounded text-xs w-full">
          Test Via Config
        </button>
        <button onClick={testModules} className="bg-purple-500 text-white px-2 py-1 rounded text-xs w-full">
          Test Modules API
        </button>
      </div>

      {Object.keys(testResults).length > 0 && (
        <div>
          <strong>Test Results:</strong>
          <pre className="bg-gray-100 p-2 rounded mt-1 whitespace-pre-wrap text-xs">
            {JSON.stringify(testResults, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}