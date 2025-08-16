import React from 'react'

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        {/* More visible spinner with colored borders */}
        <div className="animate-spin rounded-full h-32 w-32 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
        
        {/* Loading text */}
        <p className="text-lg text-gray-600 font-medium">Loading...</p>
        
        {/* Debug info in development */}
        {process.env.NODE_ENV === 'development' && (
          <p className="text-sm text-gray-400 mt-2">ProtectedRoute: Auth loading...</p>
        )}
      </div>
    </div>
  )
} 
