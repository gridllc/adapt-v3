import { useState, useEffect, useCallback } from 'react'

export type ConnectionSpeed = 'fast' | 'medium' | 'slow' | 'offline' | 'testing'

interface NetworkStatus {
  isOnline: boolean
  connectionSpeed: ConnectionSpeed
  lastSpeedTest: number | null
  refreshSpeedTest: () => Promise<void>
  isSpeedTesting: boolean
}

const SPEED_TEST_CACHE_KEY = 'adapt_connection_speed'
const SPEED_TEST_TIMESTAMP_KEY = 'adapt_speed_test_timestamp'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes cache

export const useNetworkStatus = (): NetworkStatus => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [connectionSpeed, setConnectionSpeed] = useState<ConnectionSpeed>('testing')
  const [lastSpeedTest, setLastSpeedTest] = useState<number | null>(null)
  const [isSpeedTesting, setIsSpeedTesting] = useState(false)

  // 🎯 Enhanced speed test with proper error handling
  const testSpeed = useCallback(async (): Promise<void> => {
    if (!navigator.onLine) {
      setConnectionSpeed('offline')
      return
    }

    setIsSpeedTesting(true)
    setConnectionSpeed('testing')

    try {
      const startTime = performance.now()
      
      // Use your backend's health endpoint for realistic speed test
      const response = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.MODE === 'development' ? 'http://localhost:8000' : 'https://adapt-v3.onrender.com')}/api/health`, {
        method: 'HEAD',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const duration = performance.now() - startTime
      const timestamp = Date.now()

      // 🎯 Smart speed classification for video uploads
      let speed: ConnectionSpeed
      if (duration < 200) {
        speed = 'fast'    // < 200ms = Great for video uploads
      } else if (duration < 800) {
        speed = 'medium'  // 200-800ms = Decent for video uploads
      } else {
        speed = 'slow'    // > 800ms = May struggle with large videos
      }

      setConnectionSpeed(speed)
      setLastSpeedTest(timestamp)

      // 📝 Cache results in localStorage
      localStorage.setItem(SPEED_TEST_CACHE_KEY, speed)
      localStorage.setItem(SPEED_TEST_TIMESTAMP_KEY, timestamp.toString())

      console.log(`🌐 Network speed test: ${speed} (${duration.toFixed(0)}ms)`)

    } catch (error) {
      console.warn('❌ Network speed test failed:', error)
      setConnectionSpeed('slow') // Default to slow if test fails
    } finally {
      setIsSpeedTesting(false)
    }
  }, [])

  // 🔄 Manual refresh function for user-triggered tests
  const refreshSpeedTest = useCallback(async (): Promise<void> => {
    console.log('🔄 Manual network speed test triggered')
    await testSpeed()
  }, [testSpeed])

  // 📱 Load cached speed on mount
  useEffect(() => {
    const cachedSpeed = localStorage.getItem(SPEED_TEST_CACHE_KEY) as ConnectionSpeed
    const cachedTimestamp = localStorage.getItem(SPEED_TEST_TIMESTAMP_KEY)
    
    if (cachedSpeed && cachedTimestamp) {
      const timestamp = parseInt(cachedTimestamp, 10)
      const age = Date.now() - timestamp
      
      // Use cached result if less than 5 minutes old
      if (age < CACHE_DURATION) {
        setConnectionSpeed(cachedSpeed)
        setLastSpeedTest(timestamp)
        console.log(`🎯 Using cached network speed: ${cachedSpeed} (${Math.round(age/1000)}s old)`)
        return
      }
    }

    // No valid cache - run initial speed test
    testSpeed()
  }, [testSpeed])

  // 🌐 Network event listeners
  useEffect(() => {
    const handleOnline = () => {
      console.log('🟢 Network connection restored')
      setIsOnline(true)
      testSpeed() // ✅ Run test when connection restored
    }

    const handleOffline = () => {
      console.log('🔴 Network connection lost')
      setIsOnline(false)
      setConnectionSpeed('offline')
      setIsSpeedTesting(false)
    }

    // 📡 Add event listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // 🚀 Run initial test if online
    if (navigator.onLine && connectionSpeed === 'testing') {
      testSpeed()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [testSpeed, connectionSpeed])

  // 🔄 Periodic speed test (every 10 minutes when active)
  useEffect(() => {
    if (!isOnline) return

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Periodic network speed test')
        testSpeed()
      }
    }, 10 * 60 * 1000) // 10 minutes

    return () => clearInterval(interval)
  }, [isOnline, testSpeed])

  return {
    isOnline,
    connectionSpeed,
    lastSpeedTest,
    refreshSpeedTest,
    isSpeedTesting
  }
}

// 🎯 Utility functions for integration with upload logic
export const getSpeedRecommendation = (speed: ConnectionSpeed): string => {
  switch (speed) {
    case 'fast':
      return 'Excellent connection - upload large videos freely'
    case 'medium':
      return 'Good connection - videos up to 50MB recommended'
    case 'slow':
      return 'Slow connection - consider compressing videos first'
    case 'offline':
      return 'No internet connection'
    case 'testing':
      return 'Testing connection speed...'
    default:
      return 'Unknown connection status'
  }
}

export const getMaxRecommendedFileSize = (speed: ConnectionSpeed): number => {
  switch (speed) {
    case 'fast':
      return 100 * 1024 * 1024 // 100MB
    case 'medium':
      return 50 * 1024 * 1024  // 50MB
    case 'slow':
      return 25 * 1024 * 1024  // 25MB
    case 'offline':
      return 0
    case 'testing':
      return 50 * 1024 * 1024  // Default to medium
    default:
      return 50 * 1024 * 1024
  }
}
