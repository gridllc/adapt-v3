import React, { useState } from 'react'
import { useModuleAsk } from '@/hooks/useModuleAsk'

interface Props {
  moduleId: string
}

export const ChatTutor: React.FC<Props> = ({ moduleId }) => {
  const [question, setQuestion] = useState('')
  const { answer, source, loading, error, ask } = useModuleAsk()

  const askQuestion = async () => {
    if (!question.trim()) return
    await ask(moduleId, question)
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        Ask the AI Tutor
      </h3>

      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Type your question..."
        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        onClick={askQuestion}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        {loading ? 'Thinking...' : 'Ask'}
      </button>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {answer && (
        <div className="bg-gray-100 p-3 rounded-lg text-gray-800">
          <p className="whitespace-pre-wrap">{answer}</p>
          <p className="mt-2 text-xs text-gray-500">
            Answered by: {source?.toUpperCase()}
          </p>
        </div>
      )}
    </div>
  )
}