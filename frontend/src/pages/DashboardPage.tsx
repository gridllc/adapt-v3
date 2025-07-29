import React from 'react'
import { Link } from 'react-router-dom'
import { useModules } from '@/hooks/useModules'

export const DashboardPage: React.FC = () => {
  const { modules, loading, error } = useModules()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <Link
          to="/upload"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Upload New Module
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-600">Loading modules...</p>
      ) : error ? (
        <p className="text-red-600">Error: {error}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map(mod => (
            <div key={mod.id} className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {mod.title}
              </h3>
              <p className="text-gray-600 mb-4 text-sm">
                Created: {new Date(mod.createdAt).toLocaleString()}
              </p>
              <Link
                to={`/training/${mod.id}`}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Start Training →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 