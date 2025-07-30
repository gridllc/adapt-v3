import React, { useState } from 'react'

export const ApiTest: React.FC = () => {
  const [result, setResult] = useState<string>('')

  const testLocalhost = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/health')
      const data = await response.json()
      setResult(`Localhost: ${JSON.stringify(data)}`)
    } catch (error) {
      setResult(`Localhost Error: ${error}`)
    }
  }

  const testRailway = async () => {
    try {
      const response = await fetch('https://adapt-v3-production.up.railway.app/api/health')
      const data = await response.json()
      setResult(`Railway: ${JSON.stringify(data)}`)
    } catch (error) {
      setResult(`Railway Error: ${error}`)
    }
  }

  const testCurrent = async () => {
    try {
      const response = await fetch('/api/health')
      const data = await response.json()
      setResult(`Current: ${JSON.stringify(data)}`)
    } catch (error) {
      setResult(`Current Error: ${error}`)
    }
  }

  return (
    <div className="fixed bottom-4 left-4 bg-white p-4 border rounded shadow">
      <h3 className="font-bold mb-2">API Test</h3>
      <div className="space-x-2 mb-2">
        <button onClick={testLocalhost} className="bg-blue-500 text-white px-2 py-1 rounded text-sm">
          Test Localhost
        </button>
        <button onClick={testRailway} className="bg-green-500 text-white px-2 py-1 rounded text-sm">
          Test Railway
        </button>
        <button onClick={testCurrent} className="bg-red-500 text-white px-2 py-1 rounded text-sm">
          Test Current
        </button>
      </div>
      <div className="text-xs max-w-xs">
        {result}
      </div>
    </div>
  )
}