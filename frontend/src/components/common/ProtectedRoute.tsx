import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { LoadingSpinner } from '@components/common/LoadingSpinner'

export const ProtectedRoute: React.FC = () => {
  const { isLoaded, isSignedIn } = useAuth()

  // Only show spinner while Clerk/auth is actually loading
  if (!isLoaded) {
    return <LoadingSpinner message="Checking your session…" />
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return <Outlet />
} 