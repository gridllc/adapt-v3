import { Request } from 'express'

export interface LogContext {
  userId?: string
  moduleId?: string
  requestId?: string
  ip?: string
  userAgent?: string
  method?: string
  path?: string
  duration?: number
  statusCode?: number
  error?: Error | string
  [key: string]: any
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export class StructuredLogger {
  private serviceName: string
  private environment: string

  constructor(serviceName: string = 'adapt-v3-backend') {
    this.serviceName = serviceName
    this.environment = process.env.NODE_ENV || 'development'
  }

  private formatLog(level: LogLevel, message: string, context: LogContext = {}) {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      service: this.serviceName,
      environment: this.environment,
      message,
      ...context
    }

    // In production, you might send this to a logging service like DataDog, LogRocket, etc.
    if (this.environment === 'production') {
      return JSON.stringify(logEntry)
    } else {
      // Pretty print for development
      const emoji = this.getLevelEmoji(level)
      const contextStr = Object.keys(context).length > 0 ? 
        `\n${JSON.stringify(context, null, 2)}` : ''
      return `${emoji} [${level.toUpperCase()}] ${message}${contextStr}`
    }
  }

  private getLevelEmoji(level: LogLevel): string {
    const emojis = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    }
    return emojis[level] || 'ℹ️'
  }

  private log(level: LogLevel, message: string, context: LogContext = {}) {
    const formattedLog = this.formatLog(level, message, context)
    
    switch (level) {
      case 'error':
        console.error(formattedLog)
        break
      case 'warn':
        console.warn(formattedLog)
        break
      case 'debug':
        if (this.environment === 'development') {
          console.debug(formattedLog)
        }
        break
      default:
        console.log(formattedLog)
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context)
  }

  error(message: string, context?: LogContext) {
    this.log('error', message, context)
  }

  // Helper methods for common logging patterns
  httpRequest(req: Request, context: LogContext = {}) {
    this.info('HTTP Request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.userId,
      ...context
    })
  }

  httpResponse(req: Request, statusCode: number, duration: number, context: LogContext = {}) {
    const level = statusCode >= 400 ? 'warn' : 'info'
    this.log(level, 'HTTP Response', {
      method: req.method,
      path: req.path,
      statusCode,
      duration,
      ip: req.ip,
      userId: req.userId,
      ...context
    })
  }

  uploadStart(moduleId: string, filename: string, fileSize: number, context: LogContext = {}) {
    this.info('Upload Started', {
      moduleId,
      filename,
      fileSize,
      ...context
    })
  }

  uploadComplete(moduleId: string, s3Key: string, context: LogContext = {}) {
    this.info('Upload Completed', {
      moduleId,
      s3Key,
      ...context
    })
  }

  processingStart(moduleId: string, context: LogContext = {}) {
    this.info('Processing Started', {
      moduleId,
      stage: 'start',
      ...context
    })
  }

  processingStage(moduleId: string, stage: string, context: LogContext = {}) {
    this.info('Processing Stage', {
      moduleId,
      stage,
      ...context
    })
  }

  processingComplete(moduleId: string, duration: number, context: LogContext = {}) {
    this.info('Processing Completed', {
      moduleId,
      duration,
      stage: 'complete',
      ...context
    })
  }

  processingError(moduleId: string, error: Error | string, stage?: string, context: LogContext = {}) {
    this.error('Processing Failed', {
      moduleId,
      stage,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      ...context
    })
  }

  securityEvent(event: string, req: Request, context: LogContext = {}) {
    this.warn('Security Event', {
      event,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.userId,
      ...context
    })
  }

  databaseQuery(query: string, duration: number, context: LogContext = {}) {
    this.debug('Database Query', {
      query,
      duration,
      ...context
    })
  }

  externalApiCall(service: string, endpoint: string, duration: number, statusCode?: number, context: LogContext = {}) {
    const level = statusCode && statusCode >= 400 ? 'warn' : 'debug'
    this.log(level, 'External API Call', {
      service,
      endpoint,
      duration,
      statusCode,
      ...context
    })
  }
}

// Create singleton instance
export const logger = new StructuredLogger()

// Request ID middleware for tracing
export function addRequestId(req: any, res: any, next: any) {
  req.requestId = Math.random().toString(36).substring(2, 15)
  res.setHeader('X-Request-ID', req.requestId)
  next()
}

// HTTP logging middleware
export function httpLogging(req: any, res: any, next: any) {
  const start = Date.now()
  
  logger.httpRequest(req, { requestId: req.requestId })
  
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.httpResponse(req, res.statusCode, duration, { requestId: req.requestId })
  })
  
  next()
}
