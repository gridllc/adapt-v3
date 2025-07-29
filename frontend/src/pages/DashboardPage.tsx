import React from 'react'
import { Link } from 'react-router-dom'

export const DashboardPage: React.FC = () => {
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Placeholder for training modules */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Coffee Maker Training
          </h3>
          <p className="text-gray-600 mb-4">
            Learn how to use your coffee maker effectively
          </p>
          <Link
            to="/training/coffee-maker"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Start Training →
          </Link>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Fire TV Remote
          </h3>
          <p className="text-gray-600 mb-4">
            Master your Fire TV remote controls
          </p>
          <Link
            to="/training/firetv-remote"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Start Training →
          </Link>
        </div>
      </div>
    </div>
  )
} 