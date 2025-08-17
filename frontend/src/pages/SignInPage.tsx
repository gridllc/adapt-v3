import React from 'react'
import { SignIn } from '@clerk/clerk-react'

export const SignInPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to continue to Adapt</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <SignIn redirectUrl={import.meta.env.VITE_CLERK_REDIRECT_URL} />
        </div>
      </div>
    </div>
  )
}
