import { Request, Response, NextFunction } from 'express'
import { clerkClient, verifyToken } from '@clerk/clerk-sdk-node'

// Simple auth helper for clerk-sdk-node
async function getAuth(req: Request) {
  // Extract session token from Authorization header
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { userId: null }
  }
  
  const token = authHeader.substring(7)
  
  try {
    // 🔐 Properly verify the JWT with Clerk
    const verifyOpts: any = { secretKey: process.env.CLERK_SECRET_KEY }
    if (process.env.CLERK_ISSUER_URL) {
      verifyOpts.issuer = process.env.CLERK_ISSUER_URL
    }

    const { sessionClaims } = await verifyToken(token, verifyOpts)
    return { userId: (sessionClaims as any)?.sub || null }
  } catch (error) {
    console.error('❌ Token verification failed:', error)
    return { userId: null }
  }
}

// 🎯 Allowlist functionality for friends and family beta
async function isAllowedUser(userId: string): Promise<boolean> {
  const { getAllowedEmails } = await import('../config/env.js')
  const allowedEmails = getAllowedEmails()
  
  if (allowedEmails.length === 0) {
    // If no allowlist is set, allow all authenticated users
    return true
  }
  
  try {
    // 🔐 Fetch user's email from Clerk
    const user = await clerkClient.users.getUser(userId)
    const email = user?.emailAddresses?.[0]?.emailAddress || ''
    
    console.log(`🔍 Checking allowlist for user ${userId} (${email})`)
    console.log(`📧 Allowed emails: ${allowedEmails.join(', ')}`)
    
    return allowedEmails.includes(email.toLowerCase())
  } catch (error) {
    console.error('❌ Failed to fetch Clerk user:', error)
    return false
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
 * Minimal authentication middleware with allowlist support
 * Only checks if user is authenticated and allowed, doesn't require specific roles
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = await getAuth(req)
    
    if (!userId) {
      console.log('🔒 Unauthorized access attempt:', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        hasAuthHeader: !!req.headers.authorization,
      })
      
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      })
    }
    
    // 🎯 Check allowlist for friends and family beta
    if (!(await isAllowedUser(userId))) {
      console.log('🚫 Access denied - user not in allowlist:', {
        userId,
        path: req.path,
        method: req.method,
        ip: req.ip
      })
      
      return res.status(403).json({ 
        error: 'Access Denied',
        message: 'Your account is not authorized for this beta',
        code: 'ACCESS_DENIED'
      })
    }
    
    // Add userId to request for use in controllers
    req.userId = userId
    
    console.log('✅ Authenticated and allowed request:', {
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
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = await getAuth(req)
    
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
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = await getAuth(req)
    
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