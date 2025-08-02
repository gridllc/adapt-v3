import React from 'react'
import { SignUp } from '@clerk/clerk-react'

export const CenteredSignUp: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <SignUp 
          routing="path" 
          path="/sign-up" 
          redirectUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-lg rounded-lg"
            }
          }}
        />
      </div>
    </div>
  )
} 