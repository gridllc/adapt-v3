import React from 'react'
import { useNetworkStatus, getSpeedRecommendation, type ConnectionSpeed } from '../../hooks/useNetworkStatus'
import { Wifi, WifiOff, RotateCcw, Zap, Clock, AlertTriangle } from 'lucide-react'

interface NetworkStatusBadgeProps {
  variant?: 'compact' | 'full' | 'detailed'
  showRefresh?: boolean
  className?: string
}

export const NetworkStatusBadge: React.FC<NetworkStatusBadgeProps> = ({
  variant = 'compact',
  showRefresh = false,
  className = ''
}) => {
  const { isOnline, connectionSpeed, refreshSpeedTest, isSpeedTesting, lastSpeedTest } = useNetworkStatus()

  // 🎨 Get display properties based on connection speed
  const getDisplayInfo = (speed: ConnectionSpeed) => {
    if (!isOnline) {
      return {
        emoji: '🔴',
        icon: <WifiOff className="h-4 w-4" />,
        label: 'Offline',
        shortLabel: 'Offline',
        colorClass: 'text-red-500 bg-red-50 border-red-200',
        description: 'No internet connection',
        severity: 'high' as const
      }
    }

    switch (speed) {
      case 'fast':
        return {
          emoji: '🟢',
          icon: <Zap className="h-4 w-4" />,
          label: 'Excellent Connection',
          shortLabel: 'Fast',
          colorClass: 'text-green-600 bg-green-50 border-green-200',
          description: 'Perfect for large video uploads',
          severity: 'low' as const
        }
      case 'medium':
        return {
          emoji: '🟡',
          icon: <Wifi className="h-4 w-4" />,
          label: 'Good Connection',
          shortLabel: 'Good',
          colorClass: 'text-blue-600 bg-blue-50 border-blue-200',
          description: 'Suitable for most video uploads',
          severity: 'low' as const
        }
      case 'slow':
        return {
          emoji: '🟠',
          icon: <AlertTriangle className="h-4 w-4" />,
          label: 'Slow Connection',
          shortLabel: 'Slow',
          colorClass: 'text-yellow-600 bg-yellow-50 border-yellow-200',
          description: 'May struggle with large videos',
          severity: 'medium' as const
        }
      case 'testing':
        return {
          emoji: '🔵',
          icon: <Clock className="h-4 w-4 animate-spin" />,
          label: 'Testing Connection',
          shortLabel: 'Testing',
          colorClass: 'text-gray-600 bg-gray-50 border-gray-200',
          description: 'Checking network speed...',
          severity: 'low' as const
        }
      default:
        return {
          emoji: '⚪',
          icon: <Wifi className="h-4 w-4" />,
          label: 'Unknown',
          shortLabel: 'Unknown',
          colorClass: 'text-gray-500 bg-gray-50 border-gray-200',
          description: 'Connection status unknown',
          severity: 'medium' as const
        }
    }
  }

  const displayInfo = getDisplayInfo(connectionSpeed)
  const recommendation = getSpeedRecommendation(connectionSpeed)

  // 🕒 Format last test time
  const formatLastTest = (timestamp: number | null): string => {
    if (!timestamp) return 'Never'
    const ago = Date.now() - timestamp
    const minutes = Math.floor(ago / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  // 🎯 Compact variant (for navigation bar)
  if (variant === 'compact') {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium ${displayInfo.colorClass} ${className}`}
        title={recommendation}
        aria-label={`Network status: ${displayInfo.label}. ${recommendation}`}
      >
        {displayInfo.icon}
        <span>{displayInfo.shortLabel}</span>
        {showRefresh && !isSpeedTesting && (
          <button
            onClick={refreshSpeedTest}
            className="ml-1 p-0.5 hover:bg-black/10 rounded transition-colors"
            title="Refresh network test"
            aria-label="Refresh network speed test"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
    )
  }

  // 📊 Full variant (for status displays)
  if (variant === 'full') {
    return (
      <div 
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${displayInfo.colorClass} ${className}`}
        role="status"
        aria-label={`Network status: ${displayInfo.label}. ${recommendation}`}
      >
        {displayInfo.icon}
        <div className="flex flex-col">
          <span className="text-sm font-medium">{displayInfo.label}</span>
          <span className="text-xs opacity-75">{recommendation}</span>
        </div>
        {showRefresh && !isSpeedTesting && (
          <button
            onClick={refreshSpeedTest}
            className="ml-2 p-1 hover:bg-black/10 rounded transition-colors"
            title="Refresh network test"
            aria-label="Refresh network speed test"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  // 📋 Detailed variant (for debug/settings pages)
  if (variant === 'detailed') {
    return (
      <div 
        className={`p-4 rounded-lg border ${displayInfo.colorClass} ${className}`}
        role="status"
        aria-label={`Detailed network status: ${displayInfo.label}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {displayInfo.icon}
            <div>
              <h3 className="text-sm font-semibold">{displayInfo.label}</h3>
              <p className="text-xs opacity-75 mt-1">{recommendation}</p>
              <p className="text-xs opacity-60 mt-1">
                Last tested: {formatLastTest(lastSpeedTest)}
              </p>
            </div>
          </div>
          {showRefresh && (
            <button
              onClick={refreshSpeedTest}
              disabled={isSpeedTesting}
              className="p-2 hover:bg-black/10 rounded transition-colors disabled:opacity-50"
              title="Refresh network test"
              aria-label="Refresh network speed test"
            >
              <RotateCcw className={`h-4 w-4 ${isSpeedTesting ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}

// 🎯 Specialized badge for upload pages with file size recommendations
export const UploadNetworkBadge: React.FC<{ fileSize?: number; className?: string }> = ({ 
  fileSize, 
  className = '' 
}) => {
  const { connectionSpeed } = useNetworkStatus()
  
  if (connectionSpeed === 'offline') {
    return (
      <div className={`p-3 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-red-700">
          <WifiOff className="h-5 w-5" />
          <div>
            <p className="font-medium">No Internet Connection</p>
            <p className="text-sm opacity-75">Please check your connection and try again</p>
          </div>
        </div>
      </div>
    )
  }

  if (connectionSpeed === 'slow' && fileSize && fileSize > 25 * 1024 * 1024) {
    return (
      <div className={`p-3 bg-yellow-50 border border-yellow-200 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-yellow-700">
          <AlertTriangle className="h-5 w-5" />
          <div>
            <p className="font-medium">Slow Connection Detected</p>
            <p className="text-sm opacity-75">
              Consider compressing your {Math.round(fileSize / 1024 / 1024)}MB video for faster upload
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default NetworkStatusBadge