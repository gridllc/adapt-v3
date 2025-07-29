import React from 'react'
import { Outlet } from 'react-router-dom'
import { Navigation } from './Navigation'

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
} 