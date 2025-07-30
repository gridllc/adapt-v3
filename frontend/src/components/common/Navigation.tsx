// ✅ Navigation.tsx updated with full nav links and improved layout
import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { UserButton } from '@clerk/clerk-react'

export const Navigation: React.FC = () => {
  const location = useLocation()

  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      className={`text-sm font-medium transition-colors px-3 py-2 rounded-md ${
        location.pathname === to
          ? 'text-blue-600 font-semibold'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="text-xl font-bold text-gray-900">
            Adapt
          </Link>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {navLink('/', 'Home')}
            {navLink('/dashboard', 'Dashboard')}
            {navLink('/upload', 'Upload')}
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </div>
    </nav>
  )
} 