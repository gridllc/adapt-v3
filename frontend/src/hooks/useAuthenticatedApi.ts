import { useCallback } from 'react'
import { authenticatedApi } from '../config/api'

export function useAuthenticatedApi() {
  const authenticatedFetch = useCallback(async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const { method = 'GET', body, ...restOptions } = options
    
    if (method === 'GET') {
      return await authenticatedApi.get<T>(endpoint)
    } else if (method === 'POST') {
      return await authenticatedApi.post<T>(endpoint, body)
    } else if (method === 'DELETE') {
      return await authenticatedApi.delete<T>(endpoint)
    } else if (method === 'PUT') {
      return await authenticatedApi.put<T>(endpoint, body)
    } else {
      throw new Error(`Unsupported HTTP method: ${method}`)
    }
  }, [])

  return { authenticatedFetch }
}
