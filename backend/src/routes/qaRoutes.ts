import express from 'express'
import { DatabaseService } from '../services/prismaService.js'
import { UserService } from '../services/userService.js'

const router = express.Router()

// Get all questions for a module
router.get('/:moduleId', async (req, res) => {
  try {
    const { moduleId } = req.params
    const { includeFAQ = 'false' } = req.query
    
    console.log(`📝 Getting questions for module: ${moduleId}`)
    
    const questions = await DatabaseService.getQuestions(
      moduleId, 
      includeFAQ === 'true'
    )
    
    console.log(`✅ Retrieved ${questions.length} questions`)
    
    res.json({
      success: true,
      moduleId,
      questions,
      count: questions.length
    })
  } catch (error) {
    console.error('❌ Error fetching questions:', error)
    res.status(500).json({ 
      error: 'Failed to fetch questions',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Get FAQ for a module
router.get('/:moduleId/faq', async (req, res) => {
  try {
    const { moduleId } = req.params
    
    console.log(`📝 Getting FAQ for module: ${moduleId}`)
    
    const faq = await DatabaseService.getFAQ(moduleId)
    
    console.log(`✅ Retrieved ${faq.length} FAQ items`)
    
    res.json({
      success: true,
      moduleId,
      faq,
      count: faq.length
    })
  } catch (error) {
    console.error('❌ Error fetching FAQ:', error)
    res.status(500).json({ 
      error: 'Failed to fetch FAQ',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Toggle FAQ status (admin only)
router.put('/:questionId/toggle-faq', async (req, res) => {
  try {
    const { questionId } = req.params
    
    // Check if user is authenticated (basic admin check)
    const userId = await UserService.getUserIdFromRequest(req)
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    console.log(`🔄 Toggling FAQ status for question: ${questionId}`)
    
    const updatedQuestion = await DatabaseService.toggleFAQ(questionId)
    
    console.log(`✅ FAQ status updated: ${updatedQuestion.isFAQ}`)
    
    res.json({
      success: true,
      questionId,
      isFAQ: updatedQuestion.isFAQ
    })
  } catch (error) {
    console.error('❌ Error toggling FAQ:', error)
    res.status(500).json({ 
      error: 'Failed to toggle FAQ status',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Get Q&A history for a module
router.get('/:moduleId/history', async (req, res) => {
  try {
    const { moduleId } = req.params
    const { limit = '10' } = req.query
    
    console.log(`📝 Getting Q&A history for module: ${moduleId}`)
    
    const history = await DatabaseService.getQuestionHistory(moduleId, Number(limit))
    
    console.log(`✅ Retrieved ${history.length} Q&A history items`)
    
    res.json({
      success: true,
      moduleId,
      history,
      count: history.length
    })
  } catch (error) {
    console.error('❌ Error fetching Q&A history:', error)
    res.status(500).json({ 
      error: 'Failed to fetch Q&A history',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export { router as qaRoutes } 
