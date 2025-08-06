/**
 * Environment-aware logger utility
 */
export const log = {
  debug: (...args: any[]) => {
    if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development') {
      console.log('[TEST]', ...args)
    }
  },
  
  info: (...args: any[]) => {
    console.log('[INFO]', ...args)
  },
  
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args)
  },
  
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args)
  },
  
  // Special test logging that's always enabled in development
  test: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      console.log('[TEST]', ...args)
    }
  }
} 