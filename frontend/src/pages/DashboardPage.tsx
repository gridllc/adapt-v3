import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useModules } from '../hooks/useModules'

export const DashboardPage: React.FC = () => {
  const { modules, loading, error } = useModules()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const categories = ['all', 'Kitchen Appliances', 'Electronics', 'Technology']

  const filteredModules = modules.filter(mod => {
    const matchesSearch = mod.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || mod.description?.toLowerCase().includes(selectedCategory.toLowerCase())
    return matchesSearch && matchesCategory
  })

  const totalStats = {
    totalModules: modules.length,
    totalVideos: modules.length, // Using modules as videos since each module = 1 video
    avgAge: modules.length ? Math.round(modules.reduce((sum, m) => {
      const days = Math.floor((Date.now() - new Date(m.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      return sum + days
    }, 0) / modules.length) : 0,
    thisWeek: modules.filter(m => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      return new Date(m.createdAt) >= weekAgo
    }).length
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Training Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your training modules and track your progress
              </p>
            </div>
            <Link
              to="/upload"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <span className="mr-2">➕</span>
              Upload New Module
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard icon="📚" title="Total Modules" value={totalStats.totalModules} />
          <StatCard icon="🎬" title="Total Videos" value={totalStats.totalVideos} />
          <StatCard icon="📊" title="Avg. Age" value={`${totalStats.avgAge} days`} />
          <StatCard icon="🆕" title="This Week" value={totalStats.thisWeek} />
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg mb-6 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="Search modules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="block w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => setViewMode('grid')} 
              className={`px-4 py-2 rounded-md ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              🔳 Grid
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={`px-4 py-2 rounded-md ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              📋 List
            </button>
          </div>
        </div>

        {/* Module Cards */}
        {loading ? (
          <div className="text-center py-12 text-gray-600">
            <div className="w-10 h-10 mx-auto mb-4 animate-spin text-2xl">⏳</div>
            Loading modules...
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            <div className="w-10 h-10 mx-auto mb-4 text-2xl">⚠️</div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">Connection Error</h3>
            <p className="text-red-600 mb-4">Unable to load your training modules</p>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : filteredModules.length === 0 && modules.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <div className="w-16 h-16 mx-auto mb-6 text-4xl">📚</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">No Training Modules Yet</h3>
            <p className="text-gray-600 mb-6">
              Get started by uploading your first training video. Our AI will automatically create an interactive learning module.
            </p>
            <Link
              to="/upload"
              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold inline-flex items-center gap-2"
            >
              <span>➕</span>
              Upload Your First Module
            </Link>
          </div>
        ) : filteredModules.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <div className="w-10 h-10 mx-auto mb-4 text-2xl">🔍</div>
            No modules match your search criteria.
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-6'}>
            {filteredModules.map(mod => (
              <div key={mod.id} className="bg-white p-6 rounded-2xl shadow-sm border hover:shadow-lg hover:scale-[1.02] transition-all duration-200 group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <span className="text-2xl">▶️</span>
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <span>📅</span>
                    {new Date(mod.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{mod.title}</h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{mod.description || `Created: ${new Date(mod.createdAt).toLocaleString()}`}</p>
                <Link
                  to={`/training/${mod.id}`}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium inline-flex items-center gap-2 w-full justify-center"
                >
                  <span>▶️</span>
                  Start Training
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const StatCard = ({ icon, title, value }: { icon: string; title: string; value: string | number }) => (
  <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow">
    <div className="p-5">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="text-lg font-medium text-gray-900">{value}</dd>
          </dl>
        </div>
      </div>
    </div>
  </div>
) 