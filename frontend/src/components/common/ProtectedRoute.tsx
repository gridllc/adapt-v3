import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { LoadingSpinner } from '@components/common/LoadingSpinner'

export const ProtectedRoute: React.FC = () => {
  const { isLoaded, isSignedIn } = useAuth()

  // Only gate on Clerk auth state - no artificial delays
  if (!isLoaded) {
    return <LoadingSpinner />
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return <Outlet />
} 