import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSignedVideoUrl } from '../hooks/useSignedVideoUrl'

export const TrainingPage: React.FC = () => {
  const { moduleId } = useParams()
  const filename = moduleId ? `${moduleId}.mp4` : undefined
  const { url, loading, error } = useSignedVideoUrl(filename)
  const [chatMessage, setChatMessage] = useState('')
  const [chatHistory, setChatHistory] = useState([
    {
      type: 'assistant',
      message: "Hi! I'm your AI training assistant. I can help you understand the steps, answer questions about the process, or clarify anything you see in the video. What would you like to know?"
    }
  ])

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return
    
    // Add user message
    setChatHistory(prev => [...prev, { type: 'user', message: chatMessage }])
    
    // Simulate AI response (replace with real API call)
    setTimeout(() => {
      setChatHistory(prev => [...prev, { 
        type: 'assistant', 
        message: "I understand your question. This feature is coming soon - for now, you can watch the video and follow along with the training steps."
      }])
    }, 1000)
    
    setChatMessage('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Professional Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link to="/dashboard" className="text-blue-600 hover:text-blue-700 transition-colors">
                  ← Dashboard
                </Link>
                <span className="text-gray-300">/</span>
                <Link to={`/edit-steps/${moduleId}`} className="text-blue-600 hover:text-blue-700 transition-colors">
                  Edit Steps
                </Link>
                <span className="text-gray-300">/</span>
                <span className="text-gray-500">Training</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Training Module</h1>
              <p className="mt-1 text-sm text-gray-500">
                Interactive learning experience with AI assistance
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                🎬 Live Training
              </div>
              <Link 
                to={`/edit-steps/${moduleId}`}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Edit Steps
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Video Player Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  🎬 Training Video
                </h2>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="bg-gray-900 rounded-2xl aspect-video flex items-center justify-center text-white">
                    <div className="text-center space-y-4">
                      <div className="w-12 h-12 mx-auto animate-spin text-2xl">⏳</div>
                      <p className="text-lg">Loading video...</p>
                    </div>
                  </div>
                ) : error ? (
                  <div className="bg-gray-900 rounded-2xl aspect-video flex items-center justify-center text-red-400">
                    <div className="text-center space-y-4">
                      <div className="w-12 h-12 mx-auto text-2xl">⚠️</div>
                      <div>
                        <p className="text-lg font-semibold">Video Error</p>
                        <p className="text-sm">{error}</p>
                      </div>
                    </div>
                  </div>
                ) : url ? (
                  <video 
                    controls 
                    src={url} 
                    className="w-full rounded-2xl shadow-sm"
                    poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgZmlsbD0iIzM3NDE1MSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic3lzdGVtLXVpLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+VHJhaW5pbmcgVmlkZW88L3RleHQ+PC9zdmc+"
                  />
                ) : (
                  <div className="bg-gray-900 rounded-2xl aspect-video flex items-center justify-center text-white">
                    <div className="text-center space-y-4">
                      <div className="w-12 h-12 mx-auto text-2xl">📹</div>
                      <div>
                        <p className="text-lg font-semibold">Video Unavailable</p>
                        <p className="text-sm text-gray-400">Please check that the module exists and try again</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Training Progress */}
            <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  📊 Progress Overview
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">0%</div>
                    <div className="text-sm text-gray-500">Complete</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">0:00</div>
                    <div className="text-sm text-gray-500">Time Spent</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">0/5</div>
                    <div className="text-sm text-gray-500">Steps Done</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* AI Assistant Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-[600px] flex flex-col">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  🤖 AI Training Assistant
                </h3>
              </div>
              
              {/* Chat History */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                {chatHistory.map((chat, index) => (
                  <div key={index} className={`flex ${chat.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs p-3 rounded-2xl ${
                      chat.type === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <p className="text-sm">{chat.message}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Chat Input */}
              <div className="p-6 border-t border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about this training..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <span className="text-sm">📤</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Ask questions about the steps, get clarification, or request help with the process.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 