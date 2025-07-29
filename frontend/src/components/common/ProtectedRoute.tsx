import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export function ProtectedRoute({ children }: Props) {
  // Temporarily disable authentication for development
  const clerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  
  if (!clerkConfigured) {
    return <>{children}</>
  }
  
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
} 