import React, { useRef, useEffect } from 'react'
import { useChatStore } from '../state/chatStore'
import { Mic, Sparkles, Send } from 'lucide-react'
import { useVoiceAsk } from '../hooks/useVoiceAsk'

interface Props {
  moduleId: string
  currentStep?: any
  allSteps?: any[]
  videoTime?: number
}

const QUICK_ACTIONS = [
  "Walk me through it",
  "What's the next step?"
]

export default function ChatAssistant({
  moduleId,
  currentStep,
  allSteps = [],
  videoTime = 0
}: Props) {
  const {
    messages,
    input,
    isLoading,
    error,
    isListening,
    autoStart,
    sendMessage,
    setInput,
    setMessages,
    startListening,
    stopListening,
    toggleAutoStart,
    sendQuickAction
  } = useChatStore()

  const voiceController = useVoiceAsk(moduleId, {
    onAnswer: (answer) => {
      // Handle voice responses if needed
      console.log('Voice answer received:', answer)
    },
    onError: (error) => {
      console.error('Voice error:', error)
    }
  })

  // Sync voice state with chat store
  useEffect(() => {
    if (voiceController.listening !== isListening) {
      if (voiceController.listening) {
        startListening()
      } else {
        stopListening()
      }
    }
  }, [voiceController.listening, isListening, startListening, stopListening])

  // Handle voice input and send to chat
  useEffect(() => {
    if (voiceController.finalTranscript && voiceController.finalTranscript !== input) {
      // Voice detected new input, send it to chat
      const voiceMessage = voiceController.finalTranscript.trim()
      if (voiceMessage) {
        sendMessage(voiceMessage, moduleId, {
          currentStep,
          allSteps,
          videoTime
        })
        // Reset the voice transcript after sending
        voiceController.reset()
      }
    }
  }, [voiceController.finalTranscript, input, sendMessage, moduleId, currentStep, allSteps, videoTime, voiceController])

  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when component mounts
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Sync voice state with chat store
  useEffect(() => {
    if (voiceIsActive !== isListening) {
      // This will be handled by the voice hook's state
    }
  }, [voiceIsActive, isListening])

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const messageToSend = input.trim()
    setInput('')

    await sendMessage(messageToSend, moduleId, {
      currentStep,
      allSteps,
      videoTime
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleQuickAction = async (action: string) => {
    setInput(action)
    await sendQuickAction(action, moduleId)
  }

  const handleVoiceToggle = async () => {
    if (isListening) {
      voiceController.stop()
      stopListening()
    } else {
      try {
        await voiceController.start()
        startListening()
      } catch (error) {
        console.error('Failed to start voice listening:', error)
      }
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 bg-white rounded-2xl shadow-sm border">
      {/* Header: Voice status and Quick actions */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-full ${isListening ? 'bg-red-100' : 'bg-gray-100'}`}>
            <Mic className={`h-4 w-4 ${isListening ? 'text-red-600 animate-pulse' : 'text-gray-600'}`} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">
              Voice {isListening ? 'Active' : 'Ready'}
            </span>
            <button
              onClick={handleVoiceToggle}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              {isListening ? 'Stop listening' : 'Start listening'}
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => handleQuickAction(action)}
              disabled={isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={`Ask: ${action}`}
            >
              <Sparkles className="h-3 w-3" />
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 min-h-0">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-2xl ${
              message.role === 'user'
                ? 'bg-blue-600 text-white ml-8'
                : message.isTyping
                ? 'bg-gray-100 text-gray-500'
                : 'bg-gray-100 text-gray-900 mr-8'
            }`}>
              {message.isTyping ? (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-xs">AI is thinking...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {message.role === 'user' ? 'You' : 'AI'}
                    </span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">
                    {message.content}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        {/* Auto-start toggle */}
        <div className="flex items-center justify-between mt-2">
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={toggleAutoStart}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Auto-start voice when ready
          </label>
          <span className="text-xs text-gray-400">
            Press Enter to send
          </span>
        </div>
      </div>
    </div>
  )
}
