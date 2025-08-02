import React from 'react'
import { SignIn } from '@clerk/clerk-react'

export const CenteredSignIn: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <SignIn 
          routing="path" 
          path="/sign-in" 
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