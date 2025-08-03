import React, { useState, useEffect, useRef } from 'react'
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
  onAIRewrite: () => Promise<void> // Simplified - no style parameter
  onAutoSave?: (updated: StepData) => Promise<void>
}

export const InlineStepEditor: React.FC<InlineStepEditorProps> = ({ 
  step, 
  onSave, 
  onCancel,
  onAIRewrite,
  onAutoSave
}) => {
  // Convert backend step format to frontend format
  const convertStepToFrontend = (backendStep: any): StepData => {
    // Handle different backend formats
    let startTime = 0
    let endTime = 30
    
    if (backendStep.timestamp !== undefined) {
      // Backend format: { timestamp, duration, title, description }
      startTime = backendStep.timestamp || 0
      endTime = startTime + (backendStep.duration || 30)
    } else if (backendStep.start !== undefined && backendStep.end !== undefined) {
      // Already in frontend format
      startTime = backendStep.start || 0
      endTime = backendStep.end || 30
    } else if (backendStep.startTime !== undefined && backendStep.endTime !== undefined) {
      // Alternative frontend format
      startTime = backendStep.startTime || 0
      endTime = backendStep.endTime || 30
    } else {
      // Fallback with computed values
      startTime = backendStep.timestamp || backendStep.start || backendStep.startTime || 0
      endTime = startTime + (backendStep.duration || 30)
    }
    
    return {
      id: backendStep.id || step.id,
      title: backendStep.title || '',
      description: backendStep.description || '',
      start: startTime,
      end: endTime,
      aliases: backendStep.aliases || [],
      notes: backendStep.notes || ''
    }
  }

  const [editedStep, setEditedStep] = useState<StepData>(convertStepToFrontend(step))
  const [isRewriting, setIsRewriting] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>()

  // Update editedStep when step prop changes
  useEffect(() => {
    setEditedStep(convertStepToFrontend(step))
  }, [step])

  // Validation function
  const validateStep = (step: StepData): string[] => {
    const errors: string[] = []
    
    // Required fields
    if (!step.title.trim()) {
      errors.push('Title is required')
    }
    
    if (!step.description.trim()) {
      errors.push('Description is required')
    }
    
    // Time validation
    if (step.start < 0) {
      errors.push('Start time cannot be negative')
    }
    
    if (step.end <= step.start) {
      errors.push('End time must be after start time')
    }
    
    if (step.end - step.start < 5) {
      errors.push('Step duration should be at least 5 seconds')
    }
    
    if (step.end - step.start > 300) {
      errors.push('Step duration should be less than 5 minutes')
    }
    
    // Content quality checks
    if (step.title.length < 3) {
      errors.push('Title should be at least 3 characters')
    }
    
    if (step.title.length > 100) {
      errors.push('Title should be less than 100 characters')
    }
    
    if (step.description.length < 10) {
      errors.push('Description should be at least 10 characters')
    }
    
    if (step.description.length > 500) {
      errors.push('Description should be less than 500 characters')
    }
    
    return errors
  }

  // Auto-save functionality
  useEffect(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    
    if (hasUnsavedChanges && onAutoSave) {
      autoSaveTimeoutRef.current = setTimeout(async () => {
        try {
          setSaveStatus('saving')
          await onAutoSave(editedStep)
          setSaveStatus('saved')
          setHasUnsavedChanges(false)
          
          // Clear saved status after 2 seconds
          setTimeout(() => setSaveStatus('idle'), 2000)
        } catch (error) {
          console.error('Auto-save failed:', error)
          setSaveStatus('error')
        }
      }, 1000) // 1 second delay
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [editedStep, hasUnsavedChanges, onAutoSave])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Removed dropdown logic since we no longer have a dropdown
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleChange = (field: keyof StepData, value: string | number) => {
    setEditedStep(prev => ({ ...prev, [field]: value }))
    setHasUnsavedChanges(true)
    setSaveStatus('idle')
  }

  const handleAliasChange = (value: string) => {
    const aliases = value.split(',').map(alias => alias.trim()).filter(alias => alias.length > 0)
    setEditedStep(prev => ({ ...prev, aliases }))
    setHasUnsavedChanges(true)
    setSaveStatus('idle')
  }

  const handleTimeChange = (field: 'start' | 'end', value: string) => {
    const seconds = parseTimeToSeconds(value)
    if (seconds !== null) {
      setEditedStep(prev => ({ ...prev, [field]: seconds }))
      setHasUnsavedChanges(true)
      setSaveStatus('idle')
    }
  }

  const parseTimeToSeconds = (timeString: string): number | null => {
    const match = timeString.match(/^(\d+):(\d{2})$/)
    if (match) {
      const minutes = parseInt(match[1])
      const seconds = parseInt(match[2])
      return minutes * 60 + seconds
    }
    return null
  }

  const formatSeconds = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleSave = () => {
    const errors = validateStep(editedStep)
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }
    
    setValidationErrors([])
    onSave(editedStep)
    setHasUnsavedChanges(false)
    setSaveStatus('idle')
  }

  // Simplified AI rewrite handler - no style parameter
  const handleAIRewriteClick = async () => {
    setIsRewriting(true)
    
    // Show temporary placeholder
    const originalTitle = editedStep.title
    handleChange('title', '✨ AI is rewriting...')
    
    try {
      await onAIRewrite() // No style parameter needed
    } catch (error) {
      // Restore original title on error
      handleChange('title', originalTitle)
      console.error('AI rewrite failed:', error)
    } finally {
      setIsRewriting(false)
    }
  }

  const getSaveStatusIcon = () => {
    switch (saveStatus) {
      case 'saving': return '⏳'
      case 'saved': return '✅'
      case 'error': return '❌'
      default: return hasUnsavedChanges ? '💾' : ''
    }
  }

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case 'saving': return 'Saving...'
      case 'saved': return 'Saved!'
      case 'error': return 'Save failed'
      default: return hasUnsavedChanges ? 'Unsaved changes' : ''
    }
  }

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Edit Step</h3>
          {saveStatus !== 'idle' && (
            <span className={`text-xs px-2 py-1 rounded ${
              saveStatus === 'saved' ? 'bg-green-100 text-green-700' :
              saveStatus === 'error' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {getSaveStatusIcon()} {getSaveStatusText()}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {/* Simplified single rewrite button */}
          <button
            onClick={handleAIRewriteClick}
            disabled={isRewriting}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded flex items-center gap-2 text-xs disabled:opacity-50"
            title="Refines your step to be clear, helpful, and well-written — without sounding robotic."
          >
            {isRewriting ? '✨ Rewriting...' : '✨ Rewrite'}
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
        {validationErrors.includes('Title is required') && (
          <p className="text-xs text-red-500 mt-1">Title is required</p>
        )}
        {validationErrors.includes('Title should be at least 3 characters') && (
          <p className="text-xs text-red-500 mt-1">Title should be at least 3 characters</p>
        )}
        {validationErrors.includes('Title should be less than 100 characters') && (
          <p className="text-xs text-red-500 mt-1">Title should be less than 100 characters</p>
        )}
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
        {validationErrors.includes('Description is required') && (
          <p className="text-xs text-red-500 mt-1">Description is required</p>
        )}
        {validationErrors.includes('Description should be at least 10 characters') && (
          <p className="text-xs text-red-500 mt-1">Description should be at least 10 characters</p>
        )}
        {validationErrors.includes('Description should be less than 500 characters') && (
          <p className="text-xs text-red-500 mt-1">Description should be less than 500 characters</p>
        )}
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
          {validationErrors.includes('Start time cannot be negative') && (
            <p className="text-xs text-red-500 mt-1">Start time cannot be negative</p>
          )}
          {validationErrors.includes('Step duration should be at least 5 seconds') && (
            <p className="text-xs text-red-500 mt-1">Step duration should be at least 5 seconds</p>
          )}
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
          {validationErrors.includes('End time must be after start time') && (
            <p className="text-xs text-red-500 mt-1">End time must be after start time</p>
          )}
          {validationErrors.includes('Step duration should be less than 5 minutes') && (
            <p className="text-xs text-red-500 mt-1">Step duration should be less than 5 minutes</p>
          )}
        </div>
      </div>

      <div>
        <label className="block font-semibold text-sm text-gray-700 mb-1">Aliases (how else someone might say this)</label>
        <input
          type="text"
          value={editedStep.aliases?.join(', ') || ''}
          onChange={(e) => handleAliasChange(e.target.value)}
          className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Example: remote, clicker, controller"
        />
        {validationErrors.includes('Too many aliases (max 10)') && (
          <p className="text-xs text-red-500 mt-1">Too many aliases (max 10)</p>
        )}
        <p className="text-xs text-gray-500 mt-1">Separate multiple aliases with commas</p>
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
          disabled={validationErrors.length > 0}
          className={`text-sm px-4 py-2 rounded transition ${
            validationErrors.length > 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {validationErrors.length > 0 ? `Save (${validationErrors.length} errors)` : 'Save Changes'}
        </button>
      </div>
    </div>
  )
} 