import { Request, Response, NextFunction } from 'express'
import { clerkClient } from '@clerk/clerk-sdk-node'
import { prisma } from '../config/database.js'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      clerkId?: string
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
    
    // Get the database user ID from Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: payload.sub },
      select: { id: true, email: true }
    })
    
    if (!user) {
      console.log('❌ User not found in database for Clerk ID:', payload.sub)
      return res.status(401).json({ 
        error: 'User not found',
        message: 'Please sign up first'
      })
    }
    
    // Add both Clerk ID and database user ID to request
    req.userId = user.id // Database user ID
    req.clerkId = payload.sub // Clerk ID
    
    console.log('✅ Authenticated and allowed request:', {
      clerkId: payload.sub,
      userId: user.id,
      email: user.email,
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
        // Get the database user ID from Clerk ID
        const user = await prisma.user.findUnique({
          where: { clerkId: payload.sub },
          select: { id: true, email: true }
        })
        
        if (user) {
          req.userId = user.id // Database user ID
          req.clerkId = payload.sub // Clerk ID
          console.log('🔑 Optional auth - user authenticated:', user.email, '(DB ID:', user.id, ')')
        } else {
          console.log('🔓 Optional auth - user not found in database for Clerk ID:', payload.sub)
        }
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
