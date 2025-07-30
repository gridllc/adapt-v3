import React from 'react'
import { Link } from 'react-router-dom'
import { UserButton } from '@clerk/clerk-react'

export const Navigation: React.FC = () => {
  console.log('Navigation rendering')
  return (
    <div>
      {/* Test banner */}
      <div style={{backgroundColor: 'red', color: 'white', padding: '10px', textAlign: 'center'}}>
        🔧 NAVIGATION TEST - If you see this, Navigation is working!
      </div>
      <nav className="bg-white shadow-sm border-b" style={{zIndex: 1000, position: 'relative'}}>
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
          <Link to="/dashboard" className="text-xl font-bold text-gray-900">
            Adapt
          </Link>
          
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link to="/upload" className="text-gray-600 hover:text-gray-900">
              Upload
            </Link>
            <UserButton />
          </div>
          </div>
        </div>
      </nav>
    </div>
  )
} 