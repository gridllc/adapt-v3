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
          <SignIn
            routing="path"
            path="/sign-in"
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "shadow-none p-0",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton: "w-full",
                formButtonPrimary: "w-full bg-blue-600 hover:bg-blue-700",
                footerActionLink: "text-blue-600 hover:text-blue-700"
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}