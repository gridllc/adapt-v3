import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@features/auth/hooks/useAuth'
import { LoadingSpinner } from '@components/common/LoadingSpinner'

export const ProtectedRoute: React.FC = () => {
  const { isLoaded, isSignedIn } = useAuth()

  // More robust loading check
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return <Outlet />
} 