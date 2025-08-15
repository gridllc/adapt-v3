import React, { ReactNode } from 'react'
import { Navigation } from './Navigation'
import { SecureContextBanner } from './SecureContextBanner'

interface LayoutProps {
  children: ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        {/* Security and Permission Banner - shows on all protected pages */}
        <SecureContextBanner />
        {children}
      </main>
    </div>
  )
} 