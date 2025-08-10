import { useAuth } from '@clerk/clerk-react'
import { useCallback } from 'react'

export const useAuthToken = () => {
  const { getToken, isSignedIn, userId } = useAuth()

  const getAuthToken = useCallback(async (): Promise<string> => {
    try {
      if (!isSignedIn) {
        console.warn('❌ User is not signed in')
        return ''
      }

      const token = await getToken()
      if (token) {
        console.log('✅ Got Clerk token successfully')
        return token
      }

      console.warn('❌ Failed to get token from Clerk')
      return ''
    } catch (error) {
      console.error('❌ Failed to get auth token:', error)
      return ''
    }
  }, [getToken, isSignedIn])

  return {
    getAuthToken,
    isSignedIn,
    userId
  }
}
