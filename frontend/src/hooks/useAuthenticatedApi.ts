import { useAuthenticatedApi as useAuthenticatedApiFromConfig } from '../config/api'

export function useAuthenticatedApi() {
  const authenticatedFetch = useAuthenticatedApiFromConfig()

  return { authenticatedFetch }
}
