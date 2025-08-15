import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react'
import { useEffect } from 'react'
import { IS_DEV } from '../../../config/app'

export const useAuth = () => {
  const { isLoaded, isSignedIn } = useClerkAuth()
  const { user } = useUser()

  // Enhanced debug logging with timestamps
  useEffect(() => {
    console.log(`[useAuth] State changed at ${new Date().toISOString()}:`, { 
      isLoaded, 
      isSignedIn, 
      user: user?.id,
      timestamp: Date.now()
    })
  }, [isLoaded, isSignedIn, user])

  // Immediate debug logging
  if (IS_DEV) {
    console.log(`[useAuth] Current state:`, { 
      isLoaded, 
      isSignedIn, 
      user: user?.id,
      timestamp: Date.now()
    })
  }

  return {
    isLoaded,
    isSignedIn,
    user,
  }
} 