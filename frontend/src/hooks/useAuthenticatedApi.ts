import { useCallback } from 'react'
import { authenticatedApi } from '../config/api'

export function useAuthenticatedApi() {
  const authenticatedFetch = useCallback(async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    return await authenticatedApi<T>(endpoint, options)
  }, [])

  return { authenticatedFetch }
}
