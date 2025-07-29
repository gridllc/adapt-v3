import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export function ProtectedRoute({ children }: Props) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
} 