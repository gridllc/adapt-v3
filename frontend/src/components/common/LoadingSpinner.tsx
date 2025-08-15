import React from 'react'
import { DEBUG_UI } from '../../config/app'

type Props = {
  message?: string
  debug?: string
  fullScreen?: boolean
}

export const LoadingSpinner: React.FC<Props> = ({
  message = 'Loading…',
  debug,
  fullScreen = true
}) => {
  const showDebug = DEBUG_UI

  return (
    <div className={`${fullScreen ? 'min-h-screen' : ''} flex items-center justify-center bg-gray-50`}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-3" />
        <p className="text-base text-gray-700 font-medium">{message}</p>
        {showDebug && !!debug && (
          <p className="text-xs text-gray-400 mt-1">{debug}</p>
        )}
      </div>
    </div>
  )
} 