import React, { useState, useEffect } from 'react'


interface Module {
  id: string
  title: string
  filename: string
  status: string
  progress: number
  createdAt: string
  updatedAt: string
  userId?: string
  user?: {
    email: string
    name: string
  }
  stepCount: number
  feedbackCount: number
}

interface ModuleStats {
  total: number
  processing: number
  completed: number
  failed: number
  orphaned: number
}

interface OrphanedModule {
  id: string
  title: string
  filename: string
  videoUrl: string
  status: string
  progress: number
  createdAt: string
  updatedAt: string
  userId?: string
  user?: {
    email: string
    name: string
  }
}

export const ModuleDashboard: React.FC = () => {
  const [modules, setModules] = useState<Module[]>([])
  const [stats, setStats] = useState<ModuleStats | null>(null)
  const [orphanedModules, setOrphanedModules] = useState<OrphanedModule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchModules = async () => {
    try {
      const response = await fetch(`/api/modules`)
      const data = await response.json()
      
      if (data.success) {
        setModules(data.modules)
      } else {
        setError('Failed to fetch modules')
      }
    } catch (err) {
      setError('Error fetching modules')
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/modules/stats`)
      const data = await response.json()
      
      if (data.success) {
        setStats(data.stats)
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const fetchOrphanedModules = async () => {
    try {
      const response = await fetch(`/api/modules/orphaned`)
      const data = await response.json()
      
      if (data.success) {
        setOrphanedModules(data.orphanedModules)
      }
    } catch (err) {
      console.error('Error fetching orphaned modules:', err)
    }
  }

  const markOrphanedAsFailed = async () => {
    try {
      const response = await fetch(`/api/modules/orphaned/mark-failed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()
      
      if (data.success) {
        alert(`Marked ${data.updatedCount} orphaned modules as failed`)
        fetchOrphanedModules()
        fetchStats()
      } else {
        alert('Failed to mark orphaned modules as failed')
      }
    } catch (err) {
      alert('Error marking orphaned modules as failed')
    }
  }

  const cleanupOldFailed = async () => {
    try {
      const response = await fetch(`/api/modules/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ daysOld: 7 })
      })
      const data = await response.json()
      
      if (data.success) {
        alert(`Cleaned up ${data.deletedCount} old failed modules`)
        fetchModules()
        fetchStats()
      } else {
        alert('Failed to cleanup old failed modules')
      }
    } catch (err) {
      alert('Error cleaning up old failed modules')
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        fetchModules(),
        fetchStats(),
        fetchOrphanedModules()
      ])
      setLoading(false)
    }

    loadData()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'bg-blue-500'
      case 'ready': return 'bg-green-500'
      case 'failed': return 'bg-red-500'
      case 'orphaned': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Section */}
      {stats && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">Module Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-500">{stats.processing}</div>
              <div className="text-sm text-gray-600">Processing</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-500">{stats.completed}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-500">{stats.failed}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-500">{stats.orphaned}</div>
              <div className="text-sm text-gray-600">Orphaned</div>
            </div>
          </div>
        </div>
      )}

      {/* Orphaned Modules Section */}
      {orphanedModules.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-yellow-600">
              Orphaned Modules ({orphanedModules.length})
            </h2>
            <button
              onClick={markOrphanedAsFailed}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              Mark as Failed
            </button>
          </div>
          <div className="space-y-2">
            {orphanedModules.map((module) => (
              <div key={module.id} className="border border-yellow-200 bg-yellow-50 p-3 rounded">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{module.title}</h3>
                    <p className="text-sm text-gray-600">{module.filename}</p>
                    <p className="text-xs text-gray-500">Created: {formatDate(module.createdAt)}</p>
                  </div>
                  <span className="bg-yellow-500 text-white px-2 py-1 rounded text-xs">
                    Orphaned
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Actions</h2>
        <div className="space-x-4">
          <button
            onClick={cleanupOldFailed}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            Cleanup Old Failed Modules
          </button>
          <button
            onClick={() => {
              fetchModules()
              fetchStats()
              fetchOrphanedModules()
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* Modules List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">All Modules</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Module
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Steps
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {modules.map((module) => (
                <tr key={module.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{module.title}</div>
                      <div className="text-sm text-gray-500">{module.filename}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full text-white ${getStatusColor(module.status)}`}>
                      {module.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${module.progress}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-500">{module.progress}%</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {module.stepCount} steps
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(module.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
} 