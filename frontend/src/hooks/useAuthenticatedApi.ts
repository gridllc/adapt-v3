import { useCallback } from 'react'
import { authenticatedApi } from '../config/api'

export function useAuthenticatedApi() {
  const authenticatedFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    return await authenticatedApi(endpoint, options)
  }, [])

  return { authenticatedFetch }
}
