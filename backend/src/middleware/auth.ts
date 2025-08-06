import { Request, Response, NextFunction } from 'express'
import { clerkClient, getAuth } from '@clerk/clerk-sdk-node'

// Extend Request interface to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

/**
 * Minimal authentication middleware
 * Only checks if user is authenticated, doesn't require specific roles
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req)
    
    if (!userId) {
      console.log('🔒 Unauthorized access attempt:', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      })
      
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      })
    }
    
    // Add userId to request for use in controllers
    req.userId = userId
    
    console.log('✅ Authenticated request:', {
      userId,
      path: req.path,
      method: req.method
    })
    
    next()
  } catch (error) {
    console.error('❌ Auth middleware error:', error)
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'Failed to verify authentication'
    })
  }
}

/**
 * Optional authentication middleware
 * Adds userId if authenticated, but doesn't block unauthenticated requests
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req)
    
    if (userId) {
      req.userId = userId
      console.log('🔑 Optional auth - user authenticated:', userId)
    } else {
      console.log('🔓 Optional auth - no user authenticated')
    }
    
    next()
  } catch (error) {
    console.error('❌ Optional auth middleware error:', error)
    // Don't block the request, just continue without userId
    next()
  }
}

/**
 * Admin-only middleware (for future use)
 * Requires authentication and admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req)
    
    if (!userId) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required'
      })
    }
    
    // TODO: Add admin role check when user roles are implemented
    // For now, just require authentication
    req.userId = userId
    
    console.log('👑 Admin request:', {
      userId,
      path: req.path,
      method: req.method
    })
    
    next()
  } catch (error) {
    console.error('❌ Admin auth middleware error:', error)
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'Failed to verify admin access'
    })
  }
} 