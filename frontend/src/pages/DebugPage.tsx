import React, { useState, useEffect } from 'react'
import { api } from '../config/api'
import { NetworkStatusBadge } from '../components/common/NetworkStatusBadge'

interface Module {
  id: string
  title: string
  status: string
  steps: number
  feedbacks: number
  questions: number
  createdAt: string
  updatedAt: string
  userId: string
  isStuck: boolean
  needsAttention: boolean
  trainingUrl: string
}

interface HealthStatus {
  postgres: string
  s3: string
  qstash: string
  timestamp: string
  environment: string
  uptime: string
  version: string
}

interface DebugResponse {
  modules: Module[]
  total: number
  filters: {
    status?: string
    stuck: boolean
    limit: number
  }
  helpful_queries: Record<string, string>
}

export default function DebugPage() {
  const [modules, setModules] = useState<Module[]>([])
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'failed' | 'stuck'>('all')
  const [refreshing, setRefreshing] = useState(false)

  const fetchHealth = async () => {
    try {
      const response = await api.get('/api/health')
      setHealth(response)
    } catch (error) {
      console.error('Failed to fetch health:', error)
    }
  }

  const fetchModules = async (filterType: string = 'all') => {
    try {
      setRefreshing(true)
      let url = '/api/debug/modules/debug?limit=50'
      
      if (filterType === 'failed') {
        url += '&status=failed'
      } else if (filterType === 'stuck') {
        url += '&stuck=true'
      }
      
      const response: DebugResponse = await api.get(url)
      setModules(response.modules)
    } catch (error) {
      console.error('Failed to fetch modules:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const retryModule = async (moduleId: string) => {
    try {
      await api.post(`/api/reprocess/${moduleId}`, {})
      alert('Retry initiated! Check back in a few minutes.')
      fetchModules(filter)
    } catch (error) {
      console.error('Failed to retry module:', error)
      alert('Failed to retry module')
    }
  }

  const deleteModule = async (moduleId: string) => {
    if (!confirm('Are you sure you want to delete this module?')) return
    
    try {
      await api.post(`/api/modules/${moduleId}`, { method: 'DELETE' })
      alert('Module deleted successfully')
      fetchModules(filter)
    } catch (error) {
      console.error('Failed to delete module:', error)
      alert('Failed to delete module')
    }
  }

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(window.location.origin + url)
    alert('URL copied to clipboard!')
  }

  useEffect(() => {
    Promise.all([fetchHealth(), fetchModules()]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchModules(filter)
  }, [filter])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'text-green-600 bg-green-100'
      case 'processing': return 'text-blue-600 bg-blue-100'
      case 'failed': return 'text-red-600 bg-red-100'
      case 'orphaned': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getHealthColor = (status: string) => {
    if (status.includes('✅')) return 'text-green-600'
    if (status.includes('❌')) return 'text-red-600'
    if (status.includes('⚠️')) return 'text-yellow-600'
    return 'text-gray-600'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading debug information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🔧 Debug Dashboard</h1>
          <p className="text-gray-600">Internal testing and monitoring dashboard</p>
          
          {/* Network Status */}
          <div className="mt-4">
            <NetworkStatusBadge variant="detailed" showRefresh={true} />
          </div>
        </div>

        {/* Health Status */}
        <div className="bg-white rounded-lg shadow mb-8 p-6">
          <h2 className="text-xl font-bold mb-4">🏥 System Health</h2>
          {health ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3">
                <span className="font-medium">Database:</span>
                <span className={getHealthColor(health.postgres)}>{health.postgres}</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="font-medium">S3 Storage:</span>
                <span className={getHealthColor(health.s3)}>{health.s3}</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="font-medium">QStash:</span>
                <span className={getHealthColor(health.qstash)}>{health.qstash}</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="font-medium">Environment:</span>
                <span className="text-gray-600">{health.environment}</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="font-medium">Uptime:</span>
                <span className="text-gray-600">{health.uptime}</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="font-medium">Version:</span>
                <span className="text-gray-600">{health.version}</span>
              </div>
            </div>
          ) : (
            <p className="text-red-600">Failed to load health status</p>
          )}
          <button
            onClick={fetchHealth}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Refresh Health
          </button>
        </div>

        {/* Module Filters */}
        <div className="bg-white rounded-lg shadow mb-8 p-6">
          <h2 className="text-xl font-bold mb-4">📊 Modules Overview</h2>
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All Modules ({modules.length})
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'failed' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Failed Only
            </button>
            <button
              onClick={() => setFilter('stuck')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'stuck' 
                  ? 'bg-yellow-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Stuck Modules
            </button>
            <button
              onClick={() => fetchModules(filter)}
              disabled={refreshing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Showing {modules.length} modules. 
            Stuck = status "ready" but no steps. 
            Failed = processing failed.
          </p>
        </div>

        {/* Modules List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Module
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Content
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {modules.map((module) => (
                  <tr key={module.id} className={module.needsAttention ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {module.title}
                        </div>
                        <div className="text-sm text-gray-500 font-mono">
                          {module.id}
                        </div>
                        <div className="text-xs text-gray-400">
                          User: {module.userId}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(module.status)}`}>
                        {module.status}
                      </span>
                      {module.isStuck && (
                        <div className="text-xs text-yellow-600 mt-1">⚠️ Stuck</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>Steps: {module.steps}</div>
                      <div>Questions: {module.questions}</div>
                      <div>Feedback: {module.feedbacks}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(module.createdAt).toLocaleDateString()}
                      <br />
                      {new Date(module.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 text-sm space-y-2">
                      <div className="flex flex-col space-y-1">
                        <button
                          onClick={() => copyUrl(module.trainingUrl)}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                        >
                          📋 Copy URL
                        </button>
                        <a
                          href={module.trainingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-800 text-xs"
                        >
                          👀 View Training
                        </a>
                        {module.needsAttention && (
                          <button
                            onClick={() => retryModule(module.id)}
                            className="text-orange-600 hover:text-orange-800 text-xs"
                          >
                            🔄 Retry AI
                          </button>
                        )}
                        <button
                          onClick={() => deleteModule(module.id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {modules.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No modules found for current filter</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Internal Debug Dashboard - For Testing & Support Use Only</p>
          <p>Last updated: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}