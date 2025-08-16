import React from 'react'
import { useAuth, SignInButton } from '@clerk/clerk-react'
import { UploadManager } from '../components/upload/UploadManager'

export const UploadPage: React.FC = () => {
  const { isSignedIn, isLoaded } = useAuth()

  if (!isLoaded) {
  return (
      <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
                </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-16 px-4">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Upload Training Videos
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Sign in to upload and process your training videos with AI-powered step generation
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
            <SignInButton redirectUrl="/upload">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg font-medium transition-colors">
                Sign In to Upload
              </button>
            </SignInButton>
        </div>
      </div>
    </div>
  )
  }

  return <UploadManager />
}
