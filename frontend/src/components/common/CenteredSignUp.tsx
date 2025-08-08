import React from 'react'
import { SignUp } from '@clerk/clerk-react'

export const CenteredSignUp: React.FC = () => {
  // Get the current domain for redirects
  const currentDomain = window.location.origin
  const dashboardUrl = `${currentDomain}/dashboard`
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <SignUp 
          routing="path" 
          path="/sign-up" 
          redirectUrl={dashboardUrl}
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