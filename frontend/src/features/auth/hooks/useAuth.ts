import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react'

export const useAuth = () => {
  const { isLoaded, isSignedIn } = useClerkAuth()
  const { user } = useUser()

  return {
    isLoaded,
    isSignedIn,
    user,
  }
} 