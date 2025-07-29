import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react'

export const useAuth = () => {
  const { isLoaded, isSignedIn } = useClerkAuth()
  const { user } = useUser()

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('Auth State:', { isLoaded, isSignedIn, user: user?.id })
  }

  return {
    isLoaded,
    isSignedIn,
    user,
  }
} 