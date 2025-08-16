// Simple logger utility with environment-based verbosity control
class Logger {
  private isDev = process.env.NODE_ENV === 'development'
  private isVerbose = process.env.LOG_LEVEL === 'debug' || this.isDev

  info(message: string, ...args: any[]) {
    console.log(message, ...args)
  }

  warn(message: string, ...args: any[]) {
    console.warn(message, ...args)
  }

  error(message: string, ...args: any[]) {
    console.error(message, ...args)
  }

  debug(message: string, ...args: any[]) {
    if (this.isVerbose) {
      console.log(`🔍 [DEBUG] ${message}`, ...args)
    }
  }

  dev(message: string, ...args: any[]) {
    if (this.isDev) {
      console.log(message, ...args)
    }
  }

  test(message: string, ...args: any[]) {
    if (this.isDev) {
      console.log(`[TEST] ${message}`, ...args)
    }
  }

  // Environment variable logging helper
  logEnvVar(name: string, value?: string) {
    if (this.isDev) {
      console.log(`${name}: ${value ? 'SET' : 'NOT SET'}`)
    }
  }

  // Performance logging helper
  logPerf(operation: string, duration: number) {
    if (this.isVerbose) {
      console.log(`⏱️ [PERF] ${operation}: ${duration}ms`)
    }
  }
}

export const log = new Logger() 
