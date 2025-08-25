import { useCallback } from 'react'
import { authenticatedApi, apiUrl } from '../config/api'
import { useAuth } from '@clerk/clerk-react'

export function useAuthenticatedApi() {
  const { getToken } = useAuth()
  const authenticatedFetch = useCallback(async <T = any>(
      endpoint: string,
      init: RequestInit = {}
    ): Promise<T> => {
    // Grab a Clerk JWT
    let token: string | null = null;
    try {
      token = await getToken();
      console.log('🧩 [useAuthenticatedApi] JWT token:', token);
    } catch (tokenError) {
      console.error('❌ [useAuthenticatedApi] Failed to get token:', tokenError);
    }
    if (!token) throw new Error('No authentication token available');
    const res = await fetch(apiUrl(endpoint), {
      ...init,
      credentials: init.credentials ?? 'include', // include cookies if needed
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json()
  }, [getToken])

  return { authenticatedFetch }
}
