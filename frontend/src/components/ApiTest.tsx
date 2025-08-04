import React, { useState, useEffect } from 'react'
import { api, testApiConnection, API_BASE_URL } from '../config/api'

export const ApiTest: React.FC = () => {
  const [testResults, setTestResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runTests = async () => {
    setLoading(true)
    setError(null)
    setTestResults(null)

    try {
      console.log('🧪 Starting API tests...')
      
      // Test 1: Health endpoint
      const healthResult = await api('/api/health')
      console.log('✅ Health test:', healthResult)
      
      // Test 2: Modules endpoint
      const modulesResult = await api('/api/modules')
      console.log('✅ Modules test:', modulesResult)
      
      // Test 3: Feedback stats endpoint
      const feedbackResult = await api('/api/feedback/stats')
      console.log('✅ Feedback test:', feedbackResult)
      
      setTestResults({
        health: healthResult,
        modules: modulesResult,
        feedback: feedbackResult,
        apiBaseUrl: API_BASE_URL,
        environment: import.meta.env.MODE
      })
      
    } catch (err) {
      console.error('❌ API test failed:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runTests()
  }, [])

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">🔧 API Connection Test</h3>
      
      {loading && (
        <div className="text-blue-600">⏳ Testing API connection...</div>
      )}
      
      {error && (
        <div className="text-red-600 mb-4">
          ❌ Error: {error}
        </div>
      )}
      
      {testResults && (
        <div className="space-y-4">
          <div className="text-sm">
            <strong>Environment:</strong> {testResults.environment}
          </div>
          <div className="text-sm">
            <strong>API Base URL:</strong> {testResults.apiBaseUrl || 'Using proxy'}
          </div>
          
          <div className="space-y-2">
            <div className="text-sm">
              <strong>Health Endpoint:</strong> ✅ Working
            </div>
            <div className="text-sm">
              <strong>Modules Endpoint:</strong> ✅ Working ({testResults.modules?.modules?.length || 0} modules)
            </div>
            <div className="text-sm">
              <strong>Feedback Endpoint:</strong> ✅ Working
            </div>
          </div>
          
          <button
            onClick={runTests}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            🔄 Run Tests Again
          </button>
        </div>
      )}
    </div>
  )
}