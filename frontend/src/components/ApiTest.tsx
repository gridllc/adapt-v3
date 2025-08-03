import React, { useState } from 'react'

export const ApiTest: React.FC = () => {
  const [testResults, setTestResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const runTests = async () => {
    setLoading(true)
    setTestResults(null)

    const results = {
      health: null,
      test: null,
      modules: null,
      cors: null,
      rewrite: null
    }

    try {
      // Test health endpoint
      const healthResponse = await fetch('/api/health')
      results.health = {
        status: healthResponse.status,
        ok: healthResponse.ok,
        data: await healthResponse.json()
      }
    } catch (error) {
      results.health = { error: error instanceof Error ? error.message : 'Unknown error' }
    }

    try {
      // Test general endpoint
      const testResponse = await fetch('/api/test')
      results.test = {
        status: testResponse.status,
        ok: testResponse.ok,
        data: await testResponse.json()
      }
    } catch (error) {
      results.test = { error: error instanceof Error ? error.message : 'Unknown error' }
    }

    try {
      // Test modules endpoint
      const modulesResponse = await fetch('/api/modules')
      results.modules = {
        status: modulesResponse.status,
        ok: modulesResponse.ok,
        data: await modulesResponse.json()
      }
    } catch (error) {
      results.modules = { error: error instanceof Error ? error.message : 'Unknown error' }
    }

    try {
      // Test CORS endpoint
      const corsResponse = await fetch('/api/test-cors')
      results.cors = {
        status: corsResponse.status,
        ok: corsResponse.ok,
        data: await corsResponse.json()
      }
    } catch (error) {
      results.cors = { error: error instanceof Error ? error.message : 'Unknown error' }
    }

    try {
      // Test AI rewrite endpoint
      const rewriteResponse = await fetch('/api/test-rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'Test step title',
          style: 'polished'
        }),
      })
      results.rewrite = {
        status: rewriteResponse.status,
        ok: rewriteResponse.ok,
        data: await rewriteResponse.json()
      }
    } catch (error) {
      results.rewrite = { error: error instanceof Error ? error.message : 'Unknown error' }
    }

    setTestResults(results)
    setLoading(false)
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <h2 className="text-xl font-semibold mb-4">🔧 API Connectivity Test</h2>
      
      <button
        onClick={runTests}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg mb-4"
      >
        {loading ? 'Running Tests...' : 'Run API Tests'}
      </button>

      {testResults && (
        <div className="space-y-4">
          <h3 className="font-semibold">Test Results:</h3>
          
          {Object.entries(testResults).map(([testName, result]) => (
            <div key={testName} className="border rounded p-3">
              <h4 className="font-medium capitalize">{testName} Test:</h4>
              {(result as any)?.error ? (
                <div className="text-red-600 text-sm">
                  ❌ Error: {(result as any).error}
                </div>
              ) : (result as any)?.ok ? (
                <div className="text-green-600 text-sm">
                  ✅ Success (Status: {(result as any).status})
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded">
                    {JSON.stringify((result as any).data, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="text-yellow-600 text-sm">
                  ⚠️ Failed (Status: {(result as any)?.status})
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}