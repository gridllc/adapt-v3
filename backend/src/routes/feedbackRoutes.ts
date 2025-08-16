import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const feedbackDataPath = path.join(process.cwd(), 'data', 'feedback.json')

const router = express.Router()

// Ensure feedback data directory exists
async function ensureFeedbackData() {
  try {
    await fs.access(path.dirname(feedbackDataPath))
  } catch {
    await fs.mkdir(path.dirname(feedbackDataPath), { recursive: true })
  }
}

// Load existing feedback data
async function loadFeedbackData() {
  try {
    console.log('📊 Loading feedback data from:', feedbackDataPath)
    
    // Check if file exists first
    try {
      await fs.access(feedbackDataPath)
    } catch {
      console.log('📁 Feedback file not found, creating default structure')
      const defaultData = { feedbacks: [], stats: { total: 0, positive: 0, negative: 0 } }
      await saveFeedbackData(defaultData)
      return defaultData
    }
    
    const data = await fs.readFile(feedbackDataPath, 'utf-8')
    const parsed = JSON.parse(data)
    console.log(`✅ Loaded feedback data: ${parsed.feedbacks.length} feedbacks, ${parsed.stats.total} total`)
    return parsed
  } catch (error) {
    console.error('❌ Error loading feedback data:', error)
    return { feedbacks: [], stats: { total: 0, positive: 0, negative: 0 } }
  }
}

// Save feedback data
async function saveFeedbackData(data: any) {
  await ensureFeedbackData()
  await fs.writeFile(feedbackDataPath, JSON.stringify(data, null, 2))
}

/**
 * Submit feedback for AI learning
 */
router.post('/submit', async (req, res) => {
  try {
    const { 
      type, // 'video_processing', 'step_generation', 'ai_suggestion', 'transcription'
      action, // 'worked', 'not_working', 'partially_working'
      moduleId,
      context,
      userMessage,
      aiResponse,
      timestamp = new Date().toISOString()
    } = req.body

    if (!type || !action) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const feedbackData = await loadFeedbackData()
    
    const feedback = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      action,
      moduleId,
      context,
      userMessage,
      aiResponse,
      timestamp,
      sessionId: req.headers['x-session-id'] || 'unknown'
    }

    feedbackData.feedbacks.push(feedback)
    
    // Update stats
    feedbackData.stats.total++
    if (action === 'worked') {
      feedbackData.stats.positive++
    } else {
      feedbackData.stats.negative++
    }

    await saveFeedbackData(feedbackData)

    // Generate a fun response based on feedback
    const responses = {
      worked: [
        "🎉 Awesome! My AI vacation fund just got a boost! Thanks for helping me learn!",
        "✅ Sweet! I'm getting better at this thanks to you!",
        "🚀 Boom! Another successful suggestion! You're making me smarter!",
        "💪 Yes! I'm learning from the best! Keep it up!"
      ],
      not_working: [
        "🤔 Hmm, that didn't work as expected. I'll learn from this and do better next time!",
        "😅 Oops! My bad. I'm taking notes so I can improve!",
        "📝 Got it! I'm adding this to my 'what not to do' list. Thanks for the feedback!",
        "🔄 Thanks for letting me know! I'll try a different approach next time."
      ],
      partially_working: [
        "🤝 Partially there! I'm getting closer thanks to your feedback!",
        "📈 Progress! I'm learning what works and what doesn't. Thanks!",
        "🎯 Almost got it! Your feedback helps me fine-tune my suggestions!",
        "✨ Getting better! I appreciate you helping me improve!"
      ]
    }

    const response = responses[action as keyof typeof responses]?.[Math.floor(Math.random() * responses[action as keyof typeof responses].length)] || 
                    "Thanks for the feedback! I'm always learning!"

    console.log(`📊 Feedback received: ${type} - ${action} (${feedbackData.stats.positive}/${feedbackData.stats.total} positive)`)

    res.json({ 
      success: true, 
      message: response,
      stats: feedbackData.stats
    })

  } catch (error) {
    console.error('❌ Feedback submission error:', error)
    res.status(500).json({ 
      error: 'Failed to submit feedback',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * Get feedback statistics
 */
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Fetching feedback stats...')
    const feedbackData = await loadFeedbackData()
    
    const response = {
      success: true,
      stats: feedbackData.stats,
      recentFeedback: feedbackData.feedbacks.slice(-5) // Last 5 feedbacks
    }
    
    console.log(`✅ Returning feedback stats: ${feedbackData.stats.total} total, ${feedbackData.stats.positive} positive`)
    res.json(response)
  } catch (error) {
    console.error('❌ Feedback stats error:', error)
    res.status(500).json({ 
      error: 'Failed to get feedback stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * Get feedback for specific module
 */
router.get('/module/:moduleId', async (req, res) => {
  try {
    const { moduleId } = req.params
    const feedbackData = await loadFeedbackData()
    
    const moduleFeedback = feedbackData.feedbacks.filter(
      (f: any) => f.moduleId === moduleId
    )

    res.json({
      success: true,
      feedback: moduleFeedback,
      count: moduleFeedback.length
    })
  } catch (error) {
    console.error('Module feedback error:', error)
    res.status(500).json({ error: 'Failed to get module feedback' })
  }
})

export default router 
