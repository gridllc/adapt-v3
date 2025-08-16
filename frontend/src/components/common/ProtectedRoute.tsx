import React, { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@features/auth/hooks/useAuth'
import { LoadingSpinner } from '@components/common/LoadingSpinner'

export const ProtectedRoute: React.FC = () => {
  const { isLoaded, isSignedIn } = useAuth()
  const [showSpinner, setShowSpinner] = useState(true)

  // Debug logging to see what's happening
  console.log('[ProtectedRoute] Auth state:', { isLoaded, isSignedIn })

  // Check for force spinner test parameter
  const forceSpinner = window.location.search.includes('forceSpinner=true')

  // Temporary artificial delay for testing spinner visibility
  useEffect(() => {
    if (isLoaded && !forceSpinner) {
      // Add a small delay to ensure spinner is visible
      const timer = setTimeout(() => {
        setShowSpinner(false)
      }, 500) // 500ms delay for testing
      
      return () => clearTimeout(timer)
    }
  }, [isLoaded, forceSpinner])

  // Show spinner while auth is loading OR during artificial delay OR if forced
  if (!isLoaded || showSpinner || forceSpinner) {
    console.log('[ProtectedRoute] Showing spinner - auth not loaded yet, during delay, or forced')
    return <LoadingSpinner />
  }

  if (!isSignedIn) {
    console.log('[ProtectedRoute] Redirecting to sign-in - not signed in')
    return <Navigate to="/sign-in" replace />
  }

  console.log('[ProtectedRoute] Auth loaded and signed in - rendering protected content')
  return <Outlet />
} 
