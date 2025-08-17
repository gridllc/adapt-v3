import React, { useState, useRef, useEffect } from 'react'
import { useModuleAsk, type AIQuestion, type TrainingContext } from '@hooks/useModuleAsk'
import { logger } from '@utils/logger'

interface ChatTutorProps {
  moduleId: string
  context: TrainingContext
  onStepGuidance?: (stepId: string) => void
  onProgressAnalysis?: () => void
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  stepId?: string
  confidence?: number
  sources?: string[]
  followUpQuestions?: string[]
}

export const ChatTutor: React.FC<ChatTutorProps> = ({
  moduleId,
  context,
  onStepGuidance,
  onProgressAnalysis
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const {
    askQuestion,
    askFollowUpQuestion,
    getStepGuidance,
    getProgressAnalysis,
    isLoading,
    error,
    lastAnswer,
    reset
  } = useModuleAsk()

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Add welcome message on mount
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        role: 'assistant',
        content: `Hi! I'm your AI training tutor. I can help you with:
        
• Questions about any step
• Progress analysis and tips
• Step-by-step guidance
• General training help

What would you like to know about "${context.moduleMetadata?.title || 'this training module'}"?`,
        timestamp: new Date(),
        confidence: 1.0
      }
      setMessages([welcomeMessage])
    }
  }, [messages.length, context.moduleMetadata?.title])

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newMessage])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    const userMessage = inputValue.trim()
    setInputValue('')
    
    // Add user message
    addMessage({
      role: 'user',
      content: userMessage
    })

    setIsTyping(true)
    
    try {
      // Create AI question
      const question: AIQuestion = {
        moduleId,
        question: userMessage,
        videoTime: context.videoTime
      }

      // Get AI response
      const aiAnswer = await askQuestion(question, context)
      
      // Add AI response
      addMessage({
        role: 'assistant',
        content: aiAnswer.answer,
        confidence: aiAnswer.confidence,
        sources: aiAnswer.sources,
        followUpQuestions: aiAnswer.followUpQuestions
      })

      logger.info('✅ Chat message processed successfully', { 
        question: userMessage, 
        answerLength: aiAnswer.answer.length,
        confidence: aiAnswer.confidence
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get AI response'
      logger.error('❌ Chat message failed:', errorMessage)
      
      addMessage({
        role: 'assistant',
        content: `I apologize, but I'm having trouble processing your request right now. Please try again or rephrase your question.`,
        confidence: 0
      })
    } finally {
      setIsTyping(false)
    }
  }

  const handleQuickAction = async (action: string) => {
    setIsTyping(true)
    
    try {
      let aiAnswer
      
      switch (action) {
        case 'progress':
          aiAnswer = await getProgressAnalysis(context)
          onProgressAnalysis?.()
          break
        case 'current-step':
          if (context.currentStep) {
            aiAnswer = await getStepGuidance(context.currentStep.id, context)
            onStepGuidance?.(context.currentStep.id)
          } else {
            aiAnswer = {
              answer: "I can't determine your current step. Please make sure the video is playing or manually select a step.",
              confidence: 0.5,
              sources: [],
              relatedSteps: [],
              followUpQuestions: [],
              difficulty: 'beginner',
              learningStyle: 'reading'
            }
          }
          break
        default:
          aiAnswer = await askQuestion({
            moduleId,
            question: action
          }, context)
      }

      addMessage({
        role: 'assistant',
        content: aiAnswer.answer,
        confidence: aiAnswer.confidence,
        sources: aiAnswer.sources,
        followUpQuestions: aiAnswer.followUpQuestions
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process quick action'
      logger.error('❌ Quick action failed:', errorMessage)
      
      addMessage({
        role: 'assistant',
        content: `Sorry, I couldn't process that request. Please try again.`,
        confidence: 0
      })
    } finally {
      setIsTyping(false)
    }
  }

  const handleFollowUpQuestion = async (question: string) => {
    if (isLoading) return
    
    setIsTyping(true)
    
    try {
      const aiAnswer = await askFollowUpQuestion(question, context)
      
      addMessage({
        role: 'user',
        content: question
      })
      
      addMessage({
        role: 'assistant',
        content: aiAnswer.answer,
        confidence: aiAnswer.confidence,
        sources: aiAnswer.sources,
        followUpQuestions: aiAnswer.followUpQuestions
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get follow-up response'
      logger.error('❌ Follow-up question failed:', errorMessage)
      
      addMessage({
        role: 'assistant',
        content: `I apologize, but I'm having trouble with that follow-up question. Please try asking it in a different way.`,
        confidence: 0
      })
    } finally {
      setIsTyping(false)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <h3 className="text-lg font-semibold">AI Training Tutor</h3>
        <p className="text-sm opacity-90">
          {context.currentStep ? `Current: ${context.currentStep.title}` : 'Ready to help!'}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleQuickAction('progress')}
            disabled={isLoading}
            className="px-3 py-1 text-xs bg-green-500 text-white rounded-full hover:bg-green-600 disabled:opacity-50"
          >
            📊 Progress Check
          </button>
          <button
            onClick={() => handleQuickAction('current-step')}
            disabled={isLoading || !context.currentStep}
            className="px-3 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50"
          >
            🎯 Current Step Help
          </button>
          <button
            onClick={() => handleQuickAction('How do I get started?')}
            disabled={isLoading}
            className="px-3 py-1 text-xs bg-purple-500 text-white rounded-full hover:bg-purple-600 disabled:opacity-50"
          >
            🚀 Get Started
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="text-sm">{message.content}</div>
              
              {/* Message metadata */}
              <div className={`text-xs mt-2 ${
                message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
              }`}>
                {formatTime(message.timestamp)}
                {message.confidence !== undefined && (
                  <span className="ml-2">
                    Confidence: {Math.round(message.confidence * 100)}%
                  </span>
                )}
              </div>

              {/* Follow-up questions */}
              {message.role === 'assistant' && message.followUpQuestions && message.followUpQuestions.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">Quick follow-ups:</p>
                  <div className="flex flex-wrap gap-1">
                    {message.followUpQuestions.slice(0, 3).map((question, index) => (
                      <button
                        key={index}
                        onClick={() => handleFollowUpQuestion(question)}
                        className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 rounded-lg px-4 py-2">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex justify-start">
            <div className="bg-red-100 text-red-800 rounded-lg px-4 py-2">
              <div className="text-sm">❌ {error}</div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me anything about this training..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}
