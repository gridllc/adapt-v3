// ✅ DashboardPage.tsx with Edit and Delete buttons wired into module cards
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useModules } from '../hooks/useModules'
import { ApiTest } from '../components/ApiTest'
import { api } from '../config/api'
import { FeedbackDashboard } from '../components/common/FeedbackDashboard'

export const DashboardPage: React.FC = () => {
  const { modules, loading, error } = useModules()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [deleted, setDeleted] = useState<string[]>([])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this module?')) return
    try {
      await api(`/api/modules/${id}`, { method: 'DELETE' })
      setDeleted(prev => [...prev, id])
    } catch (error) {
      console.error('Error deleting module:', error)
    }
  }

  const filteredModules = modules.filter(m => {
    if (deleted.includes(m.id)) return false
    const match = m.title.toLowerCase().includes(searchTerm.toLowerCase())
    return match
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Training Dashboard</h1>
        <Link
          to="/upload"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          ➕ Upload New Module
        </Link>
      </div>

      {/* View toggle + search */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search modules..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border px-3 py-2 rounded-md w-full sm:w-1/2"
        />
        <button
          onClick={() => setViewMode('grid')}
          className={`text-sm px-4 py-2 rounded-md ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}
        >Grid</button>
        <button
          onClick={() => setViewMode('list')}
          className={`text-sm px-4 py-2 rounded-md ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}
        >List</button>
      </div>

      {loading && <p className="text-gray-500">Loading modules...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {/* Feedback Dashboard */}
      <div className="mb-6">
        <FeedbackDashboard />
      </div>

      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-6'}>
        {filteredModules.map(mod => (
          <div key={mod.id} className="bg-white p-6 rounded-2xl border shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900 mb-1">{mod.title}</h3>
            <p className="text-sm text-gray-600 mb-3">Created: {new Date(mod.createdAt).toLocaleString()}</p>
            <div className="flex gap-2 flex-wrap">
              <Link
                to={`/training/${mod.id}`}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >▶️ Start Training</Link>
              <Link
                to={`/edit-steps/${mod.id}`}
                className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600"
              >✏️ Edit</Link>
              <button
                onClick={() => handleDelete(mod.id)}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >🗑️ Delete</button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Temporary API Test */}
      <div className="mt-8">
        <ApiTest />
      </div>
    </div>
  )
}