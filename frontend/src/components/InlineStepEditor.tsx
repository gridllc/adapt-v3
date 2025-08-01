import React, { useState } from 'react'
import { formatSeconds, parseTime, isValidTimeFormat } from '../utils/timeUtils'

export interface StepData {
  id: string
  title: string
  description: string
  start: number
  end: number
  aliases?: string[]
  notes?: string
}

interface InlineStepEditorProps {
  step: StepData
  onSave: (updated: StepData) => void
  onCancel: () => void
  onAIRewrite: () => Promise<void>
}

export const InlineStepEditor: React.FC<InlineStepEditorProps> = ({ 
  step, 
  onSave, 
  onCancel,
  onAIRewrite 
}) => {
  const [editedStep, setEditedStep] = useState<StepData>(step)
  const [isRewriting, setIsRewriting] = useState(false)

  const handleChange = (field: keyof StepData, value: string | number) => {
    setEditedStep(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleAliasChange = (value: string) => {
    const aliases = value.split(',').map(s => s.trim()).filter(Boolean)
    setEditedStep(prev => ({ ...prev, aliases }))
  }

  const handleTimeChange = (field: 'start' | 'end', value: string) => {
    if (isValidTimeFormat(value)) {
      const seconds = parseTime(value)
      handleChange(field, seconds)
    }
  }

  const handleSave = () => {
    onSave(editedStep)
  }

  const handleAIRewriteClick = async () => {
    setIsRewriting(true)
    try {
      await onAIRewrite()
    } finally {
      setIsRewriting(false)
    }
  }

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Edit Step</h3>
        <div className="flex gap-2">
          <button
            onClick={handleAIRewriteClick}
            disabled={isRewriting}
            className="text-purple-600 hover:text-purple-800 text-xs px-3 py-1 rounded border disabled:opacity-50"
          >
            {isRewriting ? '✨ Rewriting...' : '✨ AI Rewrite'}
          </button>
        </div>
      </div>

      <div>
        <label className="block font-semibold text-sm text-gray-700 mb-1">Title</label>
        <input
          type="text"
          value={editedStep.title}
          onChange={(e) => handleChange('title', e.target.value)}
          className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Step title"
        />
      </div>

      <div>
        <label className="block font-semibold text-sm text-gray-700 mb-1">Description</label>
        <textarea
          value={editedStep.description}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={3}
          className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Explain what happens in this step"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-semibold text-sm text-gray-700 mb-1">Start Time (mm:ss)</label>
          <input
            type="text"
            value={formatSeconds(editedStep.start)}
            onChange={(e) => handleTimeChange('start', e.target.value)}
            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="0:00"
          />
        </div>
        <div>
          <label className="block font-semibold text-sm text-gray-700 mb-1">End Time (mm:ss)</label>
          <input
            type="text"
            value={formatSeconds(editedStep.end)}
            onChange={(e) => handleTimeChange('end', e.target.value)}
            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="0:30"
          />
        </div>
      </div>

      <div>
        <label className="block font-semibold text-sm text-gray-700 mb-1">Aliases (comma-separated)</label>
        <input
          type="text"
          value={editedStep.aliases?.join(', ') || ''}
          onChange={(e) => handleAliasChange(e.target.value)}
          className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="power button, turn on, switch on"
        />
        <p className="text-xs text-gray-500 mt-1">Other ways users might refer to this step</p>
      </div>

      <div>
        <label className="block font-semibold text-sm text-gray-700 mb-1">AI Teaching Notes</label>
        <textarea
          value={editedStep.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={2}
          className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Explain this for kids, or skip if TV is already on"
        />
        <p className="text-xs text-gray-500 mt-1">Help the AI understand how to teach this step</p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="text-gray-600 hover:text-gray-800 text-sm px-4 py-2 rounded border hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          Save Changes
        </button>
      </div>
    </div>
  )
} 