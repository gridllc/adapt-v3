s
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