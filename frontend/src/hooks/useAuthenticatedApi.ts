import { useCallback } from 'react'
import { apiGet, apiPost, apiUrl } from '../lib/api'

export function useAuthenticatedApi() {
  const authenticatedFetch = useCallback(async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const { method = 'GET', body, ...restOptions } = options
    
    if (method === 'GET') {
      return await apiGet<T>(endpoint)
    } else if (method === 'POST') {
      return await apiPost<T>(endpoint, body)
    } else {
      throw new Error(`Unsupported HTTP method: ${method}`)
    }
  }, [])

  return { authenticatedFetch }
}
