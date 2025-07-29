import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@features/auth/hooks/useAuth'

export const ProtectedRoute: React.FC = () => {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <div>Loading...</div>
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return <Outlet />
} 