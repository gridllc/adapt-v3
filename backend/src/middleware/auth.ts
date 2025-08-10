import { Request, Response, NextFunction } from 'express'
import { clerkClient } from '@clerk/clerk-sdk-node'

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

/**
 * Authentication middleware that requires a valid user
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No authorization header found')
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required. Please sign in.'
      })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    
    // Verify the JWT token with Clerk
    const payload = await clerkClient.verifyToken(token)
    
    if (!payload || !payload.sub) {
      console.log('❌ Invalid token or no user ID found')
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid authentication token.'
      })
    }
    
    // Add userId to request for use in controllers
    req.userId = payload.sub
    
    console.log('✅ Authenticated and allowed request:', {
      userId: payload.sub,
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
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('🔓 Optional auth - no authorization header')
      return next()
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    
    try {
      // Verify the JWT token with Clerk
      const payload = await clerkClient.verifyToken(token)
      
      if (payload && payload.sub) {
        req.userId = payload.sub
        console.log('🔑 Optional auth - user authenticated:', payload.sub)
      } else {
        console.log('🔓 Optional auth - invalid token')
      }
    } catch (tokenError) {
      console.log('🔓 Optional auth - token verification failed:', tokenError)
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
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required'
      })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    
    // Verify the JWT token with Clerk
    const payload = await clerkClient.verifyToken(token)
    
    if (!payload || !payload.sub) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid authentication token'
      })
    }
    
    // TODO: Add admin role check when user roles are implemented
    // For now, just require authentication
    req.userId = payload.sub
    
    console.log('👑 Admin request:', {
      userId: payload.sub,
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