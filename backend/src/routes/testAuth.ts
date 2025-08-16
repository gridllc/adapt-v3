import express from 'express'
import { requireAuth, optionalAuth } from '../middleware/auth.js'

const router = express.Router()

// Test route that requires authentication
router.get('/protected', requireAuth, (req, res) => {
  res.json({
    success: true,
    message: 'You are authenticated!',
    userId: req.userId,
    timestamp: new Date().toISOString()
  })
})

// Test route with optional authentication
router.get('/optional', optionalAuth, (req, res) => {
  res.json({
    success: true,
    message: 'Optional auth route',
    userId: req.userId || 'No user authenticated',
    timestamp: new Date().toISOString()
  })
})

// Test route without authentication
router.get('/public', (req, res) => {
  res.json({
    success: true,
    message: 'Public route - no authentication required',
    timestamp: new Date().toISOString()
  })
})

export { router as testAuthRoutes } 
