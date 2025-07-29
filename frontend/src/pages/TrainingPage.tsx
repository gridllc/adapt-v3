import React from 'react'
import { useParams } from 'react-router-dom'

export const TrainingPage: React.FC = () => {
  const { moduleId } = useParams()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">
        Training: {moduleId}
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Player */}
        <div className="lg:col-span-2">
          <div className="bg-black rounded-lg aspect-video">
            <div className="flex items-center justify-center h-full text-white">
              Video Player Placeholder
            </div>
          </div>
        </div>
        
        {/* Chat Interface */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            AI Assistant
          </h3>
          <div className="space-y-4">
            <div className="bg-gray-100 p-3 rounded-lg">
              <p className="text-sm text-gray-700">
                Hi! I'm here to help you with this training. Ask me anything about the current step or the overall process.
              </p>
            </div>
            <input
              type="text"
              placeholder="Ask a question..."
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  )
} 