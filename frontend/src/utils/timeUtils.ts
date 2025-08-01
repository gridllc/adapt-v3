/**
 * Format seconds to mm:ss format
 */
export const formatSeconds = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

/**
 * Parse mm:ss format to seconds
 */
export const parseTime = (timeString: string): number => {
  const parts = timeString.split(':')
  if (parts.length !== 2) {
    return 0
  }
  
  const minutes = parseInt(parts[0], 10) || 0
  const seconds = parseInt(parts[1], 10) || 0
  
  return minutes * 60 + seconds
}

/**
 * Validate time string format (mm:ss)
 */
export const isValidTimeFormat = (timeString: string): boolean => {
  const timeRegex = /^\d{1,2}:\d{2}$/
  if (!timeRegex.test(timeString)) {
    return false
  }
  
  const parts = timeString.split(':')
  const minutes = parseInt(parts[0], 10)
  const seconds = parseInt(parts[1], 10)
  
  return minutes >= 0 && seconds >= 0 && seconds < 60
} 