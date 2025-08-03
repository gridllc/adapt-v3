import React, { useState, useEffect, useRef, useCallback } from 'react'
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
  onAIRewrite: (style: string) => Promise<void>
  onAutoSave?: (updated: StepData) => Promise<void>
}

const AI_REWRITE_STYLES = [
  { value: 'polished', label: '✨ Polished and formal', description: 'Professional, clear instructions' },
  { value: 'casual', label: '😎 Casual and friendly', description: 'Relaxed, approachable tone' },
  { value: 'detailed', label: '🧠 More detailed', description: 'Comprehensive explanations' },
  { value: 'concise', label: '⚡ Short and clear', description: 'Brief, direct instructions' }
]

export const InlineStepEditor: React.FC<InlineStepEditorProps> = ({ 
  step, 
  onSave, 
  onCancel,
  onAIRewrite,
  onAutoSave
}) => {
  // Convert backend step format to frontend format
  const convertStepToFrontend = (backendStep: any): StepData => {
    if (backendStep.timestamp !== undefined) {
      // Backend format: { timestamp, duration, title, description }
      return {
        id: backendStep.id || step.id,
        title: backendStep.title || '',
        description: backendStep.description || '',
        start: backendStep.timestamp || 0,
        end: (backendStep.timestamp || 0) + (backendStep.duration || 30),
        aliases: backendStep.aliases || [],
        notes: backendStep.notes || ''
      }
    } else {
      // Already in frontend format
      return {
        id: backendStep.id || step.id,
        title: backendStep.title || '',
        description: backendStep.description || '',
        start: backendStep.start || 0,
        end: backendStep.end || 30,
        aliases: backendStep.aliases || [],
        notes: backendStep.notes || ''
      }
    }
  }

  const [editedStep, setEditedStep] = useState<StepData>(convertStepToFrontend(step))
  const [isRewriting, setIsRewriting] = useState(false)
  const [showRewriteOptions, setShowRewriteOptions] = useState(false)
  const [lastUsedStyle, setLastUsedStyle] = useState<string>('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)
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
    
    // Alias validation
    if (step.aliases && step.aliases.length > 10) {
      errors.push('Too many aliases (max 10)')
    }
    
    return errors
  }

  // Auto-save with debouncing
  const debouncedAutoSave = useCallback(
    (updatedStep: StepData) => {
      if (!onAutoSave) return
      
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
      
      // Set new timeout
      autoSaveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus('saving')
        try {
          await onAutoSave(updatedStep)
          setSaveStatus('saved')
          setHasUnsavedChanges(false)
          
          // Clear saved status after 2 seconds
          setTimeout(() => setSaveStatus('idle'), 2000)
        } catch (error) {
          console.error('Auto-save failed:', error)
          setSaveStatus('error')
        }
      }, 1000) // 1 second delay
    },
    [onAutoSave]
  )

  // Handle clicking outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRewriteOptions(false)
      }
    }

    if (showRewriteOptions) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showRewriteOptions])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  const handleChange = (field: keyof StepData, value: string | number) => {
    const updatedStep = {
      ...editedStep,
      [field]: value,
    }
    setEditedStep(updatedStep)
    setHasUnsavedChanges(true)
    
    // Run validation
    const errors = validateStep(updatedStep)
    setValidationErrors(errors)
    
    // Trigger auto-save only if no validation errors
    if (errors.length === 0) {
      debouncedAutoSave(updatedStep)
    }
  }

  const handleAliasChange = (value: string) => {
    const aliases = value.split(',').map(s => s.trim()).filter(Boolean)
    const updatedStep = { ...editedStep, aliases }
    setEditedStep(updatedStep)
    setHasUnsavedChanges(true)
    
    // Run validation
    const errors = validateStep(updatedStep)
    setValidationErrors(errors)
    
    // Trigger auto-save only if no validation errors
    if (errors.length === 0) {
      debouncedAutoSave(updatedStep)
    }
  }

  const handleTimeChange = (field: 'start' | 'end', value: string) => {
    if (isValidTimeFormat(value)) {
      const seconds = parseTime(value)
      const updatedStep = {
        ...editedStep,
        [field]: seconds,
      }
      setEditedStep(updatedStep)
      setHasUnsavedChanges(true)
      
      // Run validation
      const errors = validateStep(updatedStep)
      setValidationErrors(errors)
      
      // Trigger auto-save only if no validation errors
      if (errors.length === 0) {
        debouncedAutoSave(updatedStep)
      }
    }
  }

  const handleSave = () => {
    const errors = validateStep(editedStep)
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }
    
    onSave(editedStep)
    setHasUnsavedChanges(false)
    setSaveStatus('idle')
    setValidationErrors([])
  }

  const handleAIRewriteClick = async (style: string) => {
    setIsRewriting(true)
    setShowRewriteOptions(false)
    setLastUsedStyle(style)
    try {
      await onAIRewrite(style)
    } finally {
      setIsRewriting(false)
    }
  }

  const getStyleLabel = (style: string) => {
    const styleOption = AI_REWRITE_STYLES.find(s => s.value === style)
    return styleOption ? styleOption.label.split(' ')[0] : '✨'
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
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowRewriteOptions(!showRewriteOptions)}
              disabled={isRewriting}
              className="text-purple-600 hover:text-purple-800 text-xs px-3 py-1 rounded border disabled:opacity-50 flex items-center gap-1"
            >
              {isRewriting ? '✨ Rewriting...' : lastUsedStyle ? `${getStyleLabel(lastUsedStyle)} AI Rewrite` : '✨ AI Rewrite'}
              <span className="text-xs">▼</span>
            </button>
            
            {showRewriteOptions && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-48">
                {AI_REWRITE_STYLES.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => handleAIRewriteClick(style.value)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 text-xs"
                  >
                    <div className="font-medium">{style.label}</div>
                    <div className="text-gray-500">{style.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
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