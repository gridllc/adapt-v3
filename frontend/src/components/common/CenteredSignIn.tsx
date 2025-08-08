import React from 'react'
import { SignIn } from '@clerk/clerk-react'

export const CenteredSignIn: React.FC = () => {
  // Get the current domain for redirects
  const currentDomain = window.location.origin
  const dashboardUrl = `${currentDomain}/dashboard`
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <SignIn 
          routing="path" 
          path="/sign-in" 
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