import React from 'react'
import { Link } from 'react-router-dom'

export const HomePage: React.FC = () => {
  const clerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Tailwind Test */}
      <div className="bg-red-500 text-white p-4 text-center">
        🔴 TAILWIND TEST - If this is red, Tailwind is working!
      </div>
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            Welcome to <span className="text-blue-600">Adapt</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            AI-powered interactive training platform where you learn real-world tasks
            through videos, step-by-step guidance, and intelligent assistance.
          </p>
          
          {!clerkConfigured && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-8 max-w-md mx-auto">
              <p className="text-yellow-800 text-sm">
                ⚠️ Authentication not configured. Set VITE_CLERK_PUBLISHABLE_KEY to enable sign-in.
              </p>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {clerkConfigured ? (
              <>
                <Link
                  to="/sign-up"
                  className="bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Get Started <span className="text-lg">→</span>
                </Link>
                <Link
                  to="/sign-in"
                  className="bg-white text-blue-600 px-8 py-4 rounded-xl border-2 border-blue-600 hover:bg-blue-50 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Sign In
                </Link>
              </>
            ) : (
              <Link
                to="/dashboard"
                className="bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Go to Dashboard <span className="text-lg">→</span>
              </Link>
            )}
          </div>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center hover:shadow-lg transition-all duration-200">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">▶️</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Video Learning</h3>
            <p className="text-gray-600">
              Upload your training videos and let AI automatically extract key learning points and create structured modules.
            </p>
          </div>
          
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center hover:shadow-lg transition-all duration-200">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">⚡</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">AI Assistance</h3>
            <p className="text-gray-600">
              Get real-time help from our AI tutor that understands your training content and answers questions instantly.
            </p>
          </div>
          
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center hover:shadow-lg transition-all duration-200">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">👥</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Interactive Training</h3>
            <p className="text-gray-600">
              Step-by-step guidance with timestamped videos, progress tracking, and hands-on learning experiences.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 