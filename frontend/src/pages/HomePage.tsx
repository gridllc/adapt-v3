import React from 'react'
import { Link } from 'react-router-dom'

export const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Welcome to Adapt
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            AI-powered interactive training platform where you learn real-world tasks
            through videos, step-by-step guidance, and intelligent assistance.
          </p>
          <div className="space-x-4">
            <Link
              to="/sign-up"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Get Started
            </Link>
            <Link
              to="/sign-in"
              className="bg-white text-blue-600 px-6 py-3 rounded-lg border border-blue-600 hover:bg-blue-50 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
} 