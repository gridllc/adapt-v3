import express from 'express'
import { DatabaseService } from '../services/prismaService.js'
import { UserService } from '../services/userService.js'

const router = express.Router()

// Admin middleware (basic implementation - you might want to enhance this)
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const userId = await UserService.getUserIdFromRequest(req)
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    // For now, allow all authenticated users to access admin endpoints
    // In production, you'd check for admin role/permissions
    next()
  } catch (error) {
    console.error('Admin middleware error:', error)
    res.status(500).json({ error: 'Admin check failed' })
  }
}

// Get activity logs (admin only)
router.get('/activity', requireAdmin, async (req, res) => {
  try {
    const { userId, limit = 100 } = req.query
    
    const logs = await DatabaseService.getActivityLogs(
      userId as string || undefined,
      Number(limit)
    )
    
    console.log(`📊 Retrieved ${logs.length} activity logs`)
    
    res.json({
      success: true,
      logs,
      count: logs.length
    })
  } catch (error) {
    console.error('❌ Error fetching activity logs:', error)
    res.status(500).json({ 
      error: 'Failed to fetch activity logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Get system statistics (admin only)
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const results = await Promise.all([
      DatabaseService.getAllModules().then(modules => modules.length),
      DatabaseService.getUserCount(),
      DatabaseService.getFeedbackStats()
    ])
    
    const [moduleCount, userCount, feedbackStats] = results
    
    res.json({
      success: true,
      stats: {
        modules: moduleCount,
        users: userCount || 0,
        feedback: feedbackStats
      }
    })
  } catch (error) {
    console.error('❌ Error fetching system stats:', error)
    res.status(500).json({ 
      error: 'Failed to fetch system stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export { router as adminRoutes } 