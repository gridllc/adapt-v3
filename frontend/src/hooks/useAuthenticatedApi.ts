import { useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { apiUrl } from '@config/api'

export function useAuthenticatedApi() {
  const { getToken } = useAuth()

  const authenticatedFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const url = apiUrl(endpoint)
    
    console.log('🔗 Authenticated API call to:', url)
    
    try {
      // Get Clerk token
      const token = await getToken()
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      }
      
      // Add Authorization header if token is available
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
        console.log('🔐 Added Authorization header')
      } else {
        console.warn('⚠️ No authentication token available')
      }
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
        credentials: 'include',
      })
      
      clearTimeout(timeoutId)
      console.log('📡 API response status:', response.status, response.statusText)
      
      // HTML Response Guard
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        const text = await response.text()
        console.error('❌ Received non-JSON response:', text.slice(0, 200))
        throw new Error(`Unexpected response format. Expected JSON, got: ${text.slice(0, 100)}...`)
      }
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ API Error:', response.status, response.statusText)
        console.error('❌ Response body:', errorText)
        
        // Check if we got HTML instead of JSON
        if (errorText.startsWith('<!DOCTYPE html') || errorText.includes('<html')) {
          console.error('❌ Received HTML instead of JSON - possible wrong API endpoint or server error')
          throw new Error(`Server returned HTML instead of JSON. Check API endpoint: ${url}`)
        }
        
        // Special handling for 404 errors - return empty data instead of throwing
        if (response.status === 404 && endpoint.includes('/api/steps/')) {
          console.warn('⚠️ Steps not found, returning empty steps array')
          return { steps: [], success: false, error: 'Steps not found' }
        }
        
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      // Try to parse as JSON
      try {
        const parsed = await response.json()
        console.log('📦 API response data:', parsed)
        return parsed
      } catch (err) {
        console.error('❌ Failed to parse response as JSON')
        throw new Error('Invalid JSON returned by server')
      }
      
    } catch (error) {
      console.error('❌ Network error:', error)
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout - server may be unavailable')
        } else if (error.message.includes('ECONNREFUSED') || error.message.includes('Failed to fetch')) {
          throw new Error('Connection refused - backend server may not be running')
        }
      }
      
      throw error
    }
  }, [getToken])

  return { authenticatedFetch }
}
