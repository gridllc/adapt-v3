import React from 'react'
import { SignUp } from '@clerk/clerk-react'

export const SignUpPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Get Started</h1>
          <p className="text-gray-600">Create your account to start learning</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <SignUp redirectUrl={import.meta.env.VITE_CLERK_REDIRECT_URL} />
        </div>
      </div>
    </div>
  )
}
