import { create } from 'zustand'
import { api, API_ENDPOINTS } from '../config/api'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
  isTyping?: boolean
}

interface ChatState {
  messages: ChatMessage[]
  input: string
  isLoading: boolean
  error: string | null
  isListening: boolean
  autoStart: boolean

  // Actions
  setInput: (input: string) => void
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  removeMessage: (id: string) => void
  clearMessages: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setIsListening: (listening: boolean) => void
  setAutoStart: (autoStart: boolean) => void

  // Async actions
  sendMessage: (message: string, moduleId: string, context?: any) => Promise<void>
  startListening: () => void
  stopListening: () => void
  toggleAutoStart: () => void

  // Quick actions
  sendQuickAction: (action: string, moduleId: string) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi! I'm your AI training assistant. I can help you with step-by-step guidance and answer questions about this training.`,
      timestamp: new Date()
    }
  ],
  input: '',
  isLoading: false,
  error: null,
  isListening: false,
  autoStart: false,

  // Basic setters
  setInput: (input) => set({ input }),
  setMessages: (messages) => set({ messages }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setIsListening: (listening) => set({ isListening: listening }),
  setAutoStart: (autoStart) => set({ autoStart }),

  // Message management
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map(msg =>
      msg.id === id ? { ...msg, ...updates } : msg
    )
  })),

  removeMessage: (id) => set((state) => ({
    messages: state.messages.filter(msg => msg.id !== id)
  })),

  clearMessages: () => set({
    messages: []
  }),

  // Async actions
  sendMessage: async (message, moduleId, context) => {
    const { messages, addMessage, updateMessage, setLoading, setError } = get()

    try {
      setLoading(true)
      setError(null)

      // Add user message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date()
      }
      addMessage(userMessage)

      // Add typing indicator
      const typingMessage: ChatMessage = {
        id: `typing-${Date.now()}`,
        role: 'assistant',
        content: '...',
        isTyping: true,
        timestamp: new Date()
      }
      addMessage(typingMessage)

      // Make API call
      const response = await api(API_ENDPOINTS.AI_CONTEXTUAL_RESPONSE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: message,
          currentStep: context?.currentStep || null,
          allSteps: context?.allSteps || [],
          videoTime: context?.videoTime || 0,
          moduleId
        })
      })

      // Remove typing indicator and add response
      updateMessage(typingMessage.id, {
        role: 'assistant',
        content: sanitizeAssistantResponse(response.response || 'I apologize, but I\'m having trouble processing your request right now.'),
        isTyping: false,
        timestamp: new Date()
      })

    } catch (error) {
      console.error('Chat error:', error)
      setError(error instanceof Error ? error.message : 'Failed to send message')

      // Remove typing indicator and add error message
      const typingId = `typing-${Date.now() - 1000}` // Approximate
      updateMessage(typingId, {
        role: 'assistant',
        content: "I'm having trouble processing your request right now. Please try again in a moment.",
        isTyping: false,
        timestamp: new Date()
      })
    } finally {
      setLoading(false)
    }
  },

  // Voice control
  startListening: () => {
    set({ isListening: true })
    // Voice integration will be handled by the voice hook
  },

  stopListening: () => {
    set({ isListening: false })
    // Voice integration will be handled by the voice hook
  },

  toggleAutoStart: () => {
    set((state) => ({ autoStart: !state.autoStart }))
  },

  // Quick actions
  sendQuickAction: async (action, moduleId) => {
    const { sendMessage } = get()
    await sendMessage(action, moduleId)
  }
}))

// Utility function to sanitize AI responses
function sanitizeAssistantResponse(text: string): string {
  return text
    // Remove timestamp lines like "Starts at 0:00 in the video."
    .replace(/^\s*start[s]?\s+at\s+\d{1,2}:\d{2}.*$/gim, '')
    // Remove other common timestamp patterns
    .replace(/^\s*at\s+\d{1,2}:\d{2}.*$/gim, '')
    .replace(/^\s*@\s+\d{1,2}:\d{2}.*$/gim, '')
    // Clean up extra whitespace
    .replace(/\n\s*\n/g, '\n')
    .trim()
}
