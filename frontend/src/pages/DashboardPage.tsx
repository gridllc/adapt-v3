import React from 'react'
import { Link } from 'react-router-dom'
import { Plus, Play, Calendar, Loader, AlertTriangle, BookOpen } from 'lucide-react'
import { useModules } from '@/hooks/useModules'

export const DashboardPage: React.FC = () => {
  const { modules, loading, error } = useModules()

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600">Manage your training modules and track your progress</p>
          </div>
          <Link
            to="/upload"
            className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            Upload New Module
          </Link>
        </div>
      </div>

      {/* Content Section */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-200 text-center">
          <Loader className="w-12 h-12 text-blue-600 mx-auto animate-spin mb-4" />
          <p className="text-lg text-gray-600">Loading your modules...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-2 border-red-200 p-8 rounded-2xl text-center">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Connection Error</h3>
          <p className="text-red-600 mb-4">Unable to load your training modules</p>
          <p className="text-sm text-red-500">{error}</p>
        </div>
      ) : modules.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-200 text-center">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-gray-800 mb-4">No Training Modules Yet</h3>
          <p className="text-gray-600 mb-6">
            Get started by uploading your first training video. Our AI will automatically create an interactive learning module.
          </p>
          <Link
            to="/upload"
            className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Upload Your First Module
          </Link>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-semibold text-gray-800">Your Training Modules</h2>
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {modules.length} module{modules.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map(mod => (
              <div key={mod.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-200 group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <Play className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    {new Date(mod.createdAt).toLocaleDateString()}
                  </div>
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                  {mod.title}
                </h3>
                
                <p className="text-gray-600 mb-6 text-sm">
                  Created: {new Date(mod.createdAt).toLocaleString()}
                </p>
                
                <Link
                  to={`/training/${mod.id}`}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium inline-flex items-center gap-2 w-full justify-center"
                >
                  <Play className="w-4 h-4" />
                  Start Training
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 