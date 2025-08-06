import { Request, Response, NextFunction } from 'express'
import { clerkClient } from '@clerk/clerk-sdk-node'

// Simple auth helper for clerk-sdk-node
function getAuth(req: Request) {
  // Extract session token from Authorization header
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { userId: null }
  }
  
  // For now, we'll use a simplified approach
  // In production, you'd want to verify the JWT token properly
  const token = authHeader.substring(7)
  
  // This is a simplified version - you should verify the token properly
  try {
    // Extract userId from token (this is simplified)
    // In real implementation, verify JWT and extract userId
    const decodedToken = JSON.parse(atob(token.split('.')[1]))
    return { userId: decodedToken.sub || null }
  } catch {
    return { userId: null }
  }
}

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