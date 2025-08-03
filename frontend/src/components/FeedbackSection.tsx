import React, { useState } from 'react'
import { StepGenerationFeedback, TranscriptionFeedback } from './common/FeedbackWidget'

interface FeedbackSectionProps {
  moduleId: string
  stepsCount: number
}

export const FeedbackSection: React.FC<FeedbackSectionProps> = ({ moduleId, stepsCount }) => {
  const [showAIImprovement, setShowAIImprovement] = useState(false)
  const [improvementFeedback, setImprovementFeedback] = useState('')

  const handleFeedbackSubmitted = (action: string) => {
    // If feedback is negative, show AI improvement option
    if (action === 'not_working' || action === 'partially_working') {
      setShowAIImprovement(true)
    }
  }

  const handleSubmitImprovement = async () => {
    if (!improvementFeedback.trim()) return

    try {
      // Save improvement feedback for admin review
      const response = await fetch('/api/feedback/improvement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          moduleId,
          feedback: improvementFeedback,
          type: 'ai_improvement'
        }),
      })

      if (response.ok) {
        setImprovementFeedback('')
        setShowAIImprovement(false)
        alert('Thank you for your feedback! We\'ll use it to improve this training.')
      }
    } catch (error) {
      console.error('Failed to submit improvement feedback:', error)
      alert('Failed to submit feedback. Please try again.')
    }
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mt-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        💬 Help us improve this training
      </h3>
      
      <div className="space-y-6">
        {/* Step Generation Feedback */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">
            Were the steps helpful?
          </p>
          <StepGenerationFeedback 
            moduleId={moduleId}
            context={`${stepsCount} steps generated`}
            showImmediately={true}
            onFeedback={handleFeedbackSubmitted}
            className="text-sm"
          />
        </div>

        {/* Transcription Feedback */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">
            Was the transcript accurate?
          </p>
          <TranscriptionFeedback 
            moduleId={moduleId}
            context="Video transcription and step generation"
            showImmediately={true}
            onFeedback={handleFeedbackSubmitted}
            className="text-sm"
          />
        </div>

        {/* AI Improvement Section */}
        {showAIImprovement && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              🤖 Suggest an AI improvement
            </h4>
            <p className="text-xs text-blue-700 mb-3">
              What was confusing or missing? We'll use your feedback to improve the AI.
            </p>
            <textarea
              value={improvementFeedback}
              onChange={(e) => setImprovementFeedback(e.target.value)}
              placeholder="What was confusing or missing? What step was unclear?"
              rows={3}
              className="w-full p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSubmitImprovement}
                disabled={!improvementFeedback.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Submit Feedback
              </button>
              <button
                onClick={() => setShowAIImprovement(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 