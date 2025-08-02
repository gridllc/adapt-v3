import React, { useEffect, useState } from 'react'
import { API_BASE_URL, api, API_ENDPOINTS } from '../config/api'

export const ApiTest: React.FC = () => {
  const [testResult, setTestResult] = useState<string>('')

  useEffect(() => {
    const runTest = async () => {
      try {
        console.log('🧪 API Test Starting...')
        console.log('🔍 API_BASE_URL:', API_BASE_URL)
        console.log('🔍 Environment:', import.meta.env.MODE)
        console.log('🔍 VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL)
        
        const result = await api(API_ENDPOINTS.MODULES)
        setTestResult(JSON.stringify(result, null, 2))
        console.log('✅ API Test Success:', result)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        setTestResult(`Error: ${errorMessage}`)
        console.error('❌ API Test Failed:', error)
      }
    }

    runTest()
  }, [])

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="text-lg font-bold mb-2">API Test Results</h3>
      <pre className="text-sm bg-white p-2 rounded border overflow-auto max-h-40">
        {testResult || 'Running test...'}
      </pre>
    </div>
  )
}