// middleware/requestLogger.ts
import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

export function requestLogger(req: Request, _res: Response, next: NextFunction) {
  const traceId = crypto.randomBytes(6).toString('hex')
  ;(req as any).traceId = traceId
  console.log(`[REQ ${traceId}] ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    ua: req.headers['user-agent'],
    origin: req.headers.origin
  })
  next()
}
