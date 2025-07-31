import React, { useState, useEffect } from 'react'
import { TrendingUp, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react'
import { API_ENDPOINTS } from '../../config/api'

interface FeedbackStats {
  total: number
  positive: number
  negative: number
}

interface FeedbackData {
  id: string
  type: string
  action: string
  moduleId?: string
  context?: string
  timestamp: string
}

interface FeedbackDashboardProps {
  className?: string
}

export const FeedbackDashboard: React.FC<FeedbackDashboardProps> = ({ className = '' }) => {
  const [stats, setStats] = useState<FeedbackStats | null>(null)
  const [recentFeedback, setRecentFeedback] = useState<FeedbackData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFeedbackStats = async () => {
      try {
        setLoading(true)
        const response = await fetch(API_ENDPOINTS.FEEDBACK_STATS)
        const data = await response.json()
        
        if (data.success) {
          setStats(data.stats)
          setRecentFeedback(data.recentFeedback || [])
        } else {
          setError('Failed to load feedback stats')
        }
      } catch (err) {
        console.error('Error fetching feedback stats:', err)
        setError('Failed to load feedback stats')
      } finally {
        setLoading(false)
      }
    }

    fetchFeedbackStats()
  }, [])

  if (loading) {
    return (
      <div className={`bg-white p-4 rounded-lg shadow-sm border ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white p-4 rounded-lg shadow-sm border ${className}`}>
        <div className="text-red-600 text-sm">⚠️ {error}</div>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const successRate = stats.total > 0 ? ((stats.positive / stats.total) * 100).toFixed(1) : '0'
  const feedbackTypes = recentFeedback.reduce((acc, feedback) => {
    acc[feedback.type] = (acc[feedback.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className={`bg-white p-4 rounded-lg shadow-sm border ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">AI Learning Progress</h3>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-xs text-gray-500">Total Feedback</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{stats.positive}</div>
          <div className="text-xs text-gray-500">Positive</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">{successRate}%</div>
          <div className="text-xs text-gray-500">Success Rate</div>
        </div>
      </div>

      {/* Recent Feedback */}
      {recentFeedback.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            Recent Feedback
          </h4>
          <div className="space-y-1">
            {recentFeedback.slice(0, 3).map((feedback, index) => (
              <div key={feedback.id} className="flex items-center gap-2 text-xs">
                {feedback.action === 'worked' ? (
                  <ThumbsUp className="h-3 w-3 text-green-600" />
                ) : (
                  <ThumbsDown className="h-3 w-3 text-red-600" />
                )}
                <span className="text-gray-600">
                  {feedback.type.replace('_', ' ')} - {feedback.action}
                </span>
                <span className="text-gray-400">
                  {new Date(feedback.timestamp).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Types */}
      {Object.keys(feedbackTypes).length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Feedback Types</h4>
          <div className="space-y-1">
            {Object.entries(feedbackTypes).map(([type, count]) => (
              <div key={type} className="flex justify-between text-xs">
                <span className="text-gray-600 capitalize">
                  {type.replace('_', ' ')}
                </span>
                <span className="text-gray-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 