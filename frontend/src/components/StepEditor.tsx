import React, { useState } from 'react'
import { InlineStepEditor, StepData } from './InlineStepEditor'
import { api, API_ENDPOINTS } from '../config/api'

interface Step {
  id: string
  timestamp: number
  title: string
  description: string
  duration?: number
  aliases?: string[]
  notes?: string
  isManual?: boolean
}

interface StepEditorProps {
  step: Step
  stepIndex: number
  moduleId: string
  onUpdate: (updatedStep: Step) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  isCurrentStep?: boolean
  isVideoPlaying?: boolean
  onSeek: (timestamp: number) => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}

export const StepEditor: React.FC<StepEditorProps> = ({
  step,
  stepIndex,
  moduleId,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isCurrentStep = false,
  isVideoPlaying = false,
  onSeek,
  canMoveUp = true,
  canMoveDown = true
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleSave = async (updatedStepData: StepData) => {
    try {
      const updatedStep: Step = {
        ...step,
        title: updatedStepData.title,
        description: updatedStepData.description,
        timestamp: updatedStepData.start,
        duration: updatedStepData.end - updatedStepData.start,
        aliases: updatedStepData.aliases,
        notes: updatedStepData.notes
      }

      // Save to backend
      await api(API_ENDPOINTS.STEPS(moduleId), {
        method: 'POST',
        body: JSON.stringify({ 
          steps: [updatedStep],
          action: 'update',
          stepIndex
        }),
      })

      onUpdate(updatedStep)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to save step:', error)
      alert('Failed to save step. Please try again.')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this step?')) return

    setIsDeleting(true)
    try {
      await api(API_ENDPOINTS.STEPS(moduleId), {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'delete',
          stepIndex
        }),
      })

      onDelete()
    } catch (error) {
      console.error('Failed to delete step:', error)
      alert('Failed to delete step. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Stub functions for AI rewrite and auto-save (disabled for now)
  const handleAIRewrite = async (style: string): Promise<void> => {
    // Disabled for now - could be implemented later
    console.log('AI rewrite requested with style:', style)
  }

  const handleAutoSave = async (updated: StepData): Promise<void> => {
    // Disabled for now - could be implemented later
    console.log('Auto-save requested for:', updated)
  }

  if (isEditing) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <InlineStepEditor
          step={{
            id: step.id,
            title: step.title,
            description: step.description,
            start: step.timestamp,
            end: step.timestamp + (step.duration || 30),
            aliases: step.aliases || [],
            notes: step.notes || ''
          }}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
          onAIRewrite={handleAIRewrite}
          onAutoSave={handleAutoSave}
        />
      </div>
    )
  }

  return (
    <div className={`bg-white border rounded-lg p-4 shadow-sm transition-all hover:shadow-md ${
      isCurrentStep 
        ? 'ring-2 ring-blue-500 bg-blue-50' 
        : 'border-gray-200 hover:bg-gray-50'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded-full text-sm font-medium ${
            isCurrentStep 
              ? 'bg-blue-600 text-white' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            Step {stepIndex}
          </span>
          
          <span className="text-gray-500 text-sm">
            {formatTime(step.timestamp)}
          </span>
          
          {step.isManual && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
              Manual
            </span>
          )}
          
          {isCurrentStep && (
            <span className="text-blue-600 text-xs flex items-center gap-1">
              {isVideoPlaying ? '▶️ Playing' : '⏸️ Paused'}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {/* Reorder buttons */}
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="text-gray-600 hover:text-gray-800 text-xs px-2 py-1 rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Move step up"
            >
              ⬆️
            </button>
          )}
          
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="text-gray-600 hover:text-gray-800 text-xs px-2 py-1 rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Move step down"
            >
              ⬇️
            </button>
          )}
          
          <button
            onClick={() => onSeek(step.timestamp)}
            className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded hover:bg-blue-50 transition-colors"
            title="Seek to this step"
          >
            ▶️ Seek
          </button>
          
          <button
            onClick={handleEdit}
            className="text-gray-600 hover:text-gray-800 text-xs px-2 py-1 rounded hover:bg-gray-50 transition-colors"
            title="Edit this step"
          >
            ✏️ Edit
          </button>
          
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-red-600 hover:text-red-800 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
            title="Delete this step"
          >
            {isDeleting ? '🗑️ Deleting...' : '🗑️ Delete'}
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
        <p className="text-gray-600 text-sm mb-2">{step.description}</p>
        
        {step.aliases && step.aliases.length > 0 && (
          <p className="text-xs text-gray-500 italic mb-1">
            🧠 Aliases: {step.aliases.join(', ')}
          </p>
        )}
        
        {step.notes && (
          <p className="text-xs text-gray-500 italic mb-1">
            🛠️ Notes: {step.notes}
          </p>
        )}
        
        <div className="text-xs text-gray-400">
          Duration: {step.duration || 30}s
        </div>
      </div>
    </div>
  )
} 