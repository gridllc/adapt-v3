import React from 'react'
import { useAuth, SignInButton, SignUpButton } from '@clerk/clerk-react'

export const ClerkDebug: React.FC = () => {
  const { isSignedIn, isLoaded, userId } = useAuth()

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm z-50">
      <h3 className="font-bold text-sm mb-2">🔍 Clerk Debug</h3>
      <div className="text-xs space-y-1">
        <div>Loaded: {isLoaded ? '✅' : '⏳'}</div>
        <div>Signed In: {isSignedIn ? '✅' : '❌'}</div>
        <div>User ID: {userId || 'N/A'}</div>
        <div className="mt-2">
          <SignInButton mode="modal">
            <button className="bg-blue-500 text-white px-2 py-1 rounded text-xs">
              Test Sign In
            </button>
          </SignInButton>
        </div>
        <div className="mt-1">
          <SignUpButton mode="modal">
            <button className="bg-green-500 text-white px-2 py-1 rounded text-xs">
              Test Sign Up
            </button>
          </SignUpButton>
        </div>
      </div>
    </div>
  )
}
