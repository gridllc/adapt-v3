import React, { useState } from 'react'
import { CheckCircle, XCircle, HelpCircle, ThumbsUp, ThumbsDown } from 'lucide-react'
import { api } from '../../config/api'

interface FeedbackWidgetProps {
  type: 'video_processing' | 'step_generation' | 'ai_suggestion' | 'transcription'
  moduleId?: string
  context?: string
  userMessage?: string
  aiResponse?: string
  onFeedback?: (action: string) => void
  className?: string
  showImmediately?: boolean
  autoHide?: boolean
}

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
  type,
  moduleId,
  context,
  userMessage,
  aiResponse,
  onFeedback,
  className = '',
  showImmediately = false,
  autoHide = true
}) => {
  const [showFeedback, setShowFeedback] = useState(showImmediately)
  const [submitted, setSubmitted] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')

  const handleFeedback = async (action: 'worked' | 'not_working' | 'partially_working') => {
    try {
      const data = await api('/api/feedback/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          action,
          moduleId,
          context,
          userMessage,
          aiResponse,
          timestamp: new Date().toISOString()
        })
      })
      
      if (data.success) {
        setFeedbackMessage(data.message)
        setSubmitted(true)
        onFeedback?.(action)
        
        if (autoHide) {
          setTimeout(() => setShowFeedback(false), 3000)
        }
      }
    } catch (error) {
      console.error('Feedback submission failed:', error)
      setFeedbackMessage('Thanks for the feedback!')
      setSubmitted(true)
    }
  }

  const getFeedbackPrompt = () => {
    const prompts = {
      video_processing: "Did the video processing work correctly?",
      step_generation: "Were the training steps helpful?",
      ai_suggestion: "Was this AI suggestion useful?",
      transcription: "Was the transcription accurate?"
    }
    return prompts[type] || "How was this experience?"
  }

  if (!showFeedback && !showImmediately) {
    return (
      <button
        onClick={() => setShowFeedback(true)}
        className={`inline-flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors ${className}`}
      >
        <HelpCircle className="h-4 w-4" />
        Give feedback
      </button>
    )
  }

  if (submitted) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-2 text-sm text-green-600 bg-green-50 rounded-lg ${className}`}>
        <CheckCircle className="h-4 w-4" />
        {feedbackMessage}
      </div>
    )
  }

  return (
    <div className={`inline-flex items-center gap-2 p-2 bg-gray-50 rounded-lg ${className}`}>
      <span className="text-sm text-gray-700">{getFeedbackPrompt()}</span>
      
      <div className="flex gap-1">
        <button
          onClick={() => handleFeedback('worked')}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
          title="It worked!"
        >
          <ThumbsUp className="h-3 w-3" />
          Worked
        </button>
        
        <button
          onClick={() => handleFeedback('partially_working')}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
          title="Partially working"
        >
          <HelpCircle className="h-3 w-3" />
          Partial
        </button>
        
        <button
          onClick={() => handleFeedback('not_working')}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          title="Didn't work"
        >
          <ThumbsDown className="h-3 w-3" />
          Nope
        </button>
      </div>
      
      {!showImmediately && (
        <button
          onClick={() => setShowFeedback(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <XCircle className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// Convenience components for specific feedback types
export const VideoProcessingFeedback: React.FC<Omit<FeedbackWidgetProps, 'type'>> = (props) => (
  <FeedbackWidget type="video_processing" {...props} />
)

export const StepGenerationFeedback: React.FC<Omit<FeedbackWidgetProps, 'type'>> = (props) => (
  <FeedbackWidget type="step_generation" {...props} />
)

export const AISuggestionFeedback: React.FC<Omit<FeedbackWidgetProps, 'type'>> = (props) => (
  <FeedbackWidget type="ai_suggestion" {...props} />
)

export const TranscriptionFeedback: React.FC<Omit<FeedbackWidgetProps, 'type'>> = (props) => (
  <FeedbackWidget type="transcription" {...props} />
) 