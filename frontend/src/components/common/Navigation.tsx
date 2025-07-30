// ✅ Responsive sticky Navigation using emoji instead of lucide icons
import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { UserButton } from '@clerk/clerk-react'

export const Navigation: React.FC = () => {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      onClick={() => setMobileOpen(false)}
      className={`block text-sm font-medium transition-colors px-4 py-2 rounded-md ${
        location.pathname === to
          ? 'text-blue-600 font-semibold'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <span className="text-2xl">🚀</span>
            Adapt
          </Link>

          {/* Desktop Links */}
          <div className="hidden sm:flex items-center space-x-4">
            {navLink('/', '🏠 Home')}
            {navLink('/dashboard', '📊 Dashboard')}
            {navLink('/upload', '📤 Upload')}
            <UserButton afterSignOutUrl="/" />
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="sm:hidden text-2xl"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? '❌' : '📖'}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div className="sm:hidden px-4 pb-4 space-y-2 border-t bg-white shadow-md">
          {navLink('/', '🏠 Home')}
          {navLink('/dashboard', '📊 Dashboard')}
          {navLink('/upload', '📤 Upload')}
          <UserButton afterSignOutUrl="/" />
        </div>
      )}
    </nav>
  )
} 