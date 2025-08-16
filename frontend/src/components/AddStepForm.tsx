import React, { useState } from 'react'
import { api, API_ENDPOINTS } from '../config/api'

interface AddStepFormProps {
  moduleId: string
  onAdd: (newStep: any) => void
  currentVideoTime?: number
}

export const AddStepForm: React.FC<AddStepFormProps> = ({ moduleId, onAdd, currentVideoTime = 0 }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startTime, setStartTime] = useState(Math.floor(currentVideoTime))
  const [endTime, setEndTime] = useState(Math.floor(currentVideoTime) + 30)
  const [isManual, setIsManual] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Update times when currentVideoTime changes
  React.useEffect(() => {
    const currentTime = Math.floor(currentVideoTime)
    setStartTime(currentTime)
    setEndTime(currentTime + 30)
  }, [currentVideoTime])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsSubmitting(true)
    try {
      // Create new step in backend format (start + end)
      const newStep = {
        id: `step_${Date.now()}`,
        title: title.trim(),
        description: description.trim(),
        start: startTime, // Backend expects start
        end: endTime, // Backend expects end
        isManual: isManual
      }

      // Add to existing steps
      const response = await api(API_ENDPOINTS.STEPS(moduleId), {
        method: 'POST',
        body: JSON.stringify({ 
          steps: [newStep],
          action: 'add'
        }),
      })

      if (response.success) {
        onAdd(newStep)
        handleReset()
        setIsOpen(false)
      }
    } catch (error) {
      console.error('Failed to add step:', error)
      alert('Failed to add step. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setTitle('')
    setDescription('')
    const currentTime = Math.floor(currentVideoTime)
    setStartTime(currentTime)
    setEndTime(currentTime + 30)
    setIsManual(false)
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isOpen) {
    return (
      <div className="text-center mt-6">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors"
          title="You can reorder after adding"
        >
          ➕ Need to add a missing step?
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Add New Step</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Step Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter step title..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter step description..."
            rows={3}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Time
            </label>
            <input
              type="number"
              value={startTime}
              onChange={(e) => setStartTime(parseInt(e.target.value) || 0)}
              min="0"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {formatTime(startTime)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Time
            </label>
            <input
              type="number"
              value={endTime}
              onChange={(e) => setEndTime(parseInt(e.target.value) || 0)}
              min={startTime}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {formatTime(endTime)}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Aliases (how else someone might say this)
          </label>
          <input
            type="text"
            placeholder="Example: remote, clicker, controller"
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Separate multiple aliases with commas
          </p>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="isManual"
            checked={isManual}
            onChange={(e) => setIsManual(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="isManual" className="ml-2 text-sm text-gray-700">
            This was missed in the video (manual addition)
          </label>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting || !title.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {isSubmitting ? 'Adding...' : 'Add Step'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
} 
