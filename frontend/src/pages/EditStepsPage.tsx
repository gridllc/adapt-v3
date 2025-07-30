import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { API_CONFIG, API_ENDPOINTS } from '../config/api'

interface Step {
  stepTitle: string
  text: string
  timestamp?: number
}

export const EditStepsPage: React.FC = () => {
  const { moduleId } = useParams()
  const [transcript, setTranscript] = useState<string>('')
  const [steps, setSteps] = useState<Step[]>([])
  const [currentStep, setCurrentStep] = useState<Step>({ stepTitle: '', text: '', timestamp: undefined })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!moduleId) return
    fetch(API_CONFIG.getApiUrl(API_ENDPOINTS.TRANSCRIPT(moduleId)))
      .then(res => res.json())
      .then(data => {
        setTranscript(data.transcript || '')
      })
      .finally(() => setLoading(false))
  }, [moduleId])

  const addStep = () => {
    if (!currentStep.stepTitle || !currentStep.text) return
    setSteps(prev => [...prev, currentStep])
    setCurrentStep({ stepTitle: '', text: '', timestamp: undefined })
    setSaved(false)
  }

  const removeStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index))
    setSaved(false)
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= steps.length) return
    ;[newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]]
    setSteps(newSteps)
    setSaved(false)
  }

  const saveSteps = async () => {
    setSaving(true)
    try {
      await fetch(API_CONFIG.getApiUrl(API_ENDPOINTS.STEPS(moduleId!)), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000) // Hide success message after 3 seconds
    } catch (error) {
      console.error('Failed to save steps:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link to="/dashboard" className="text-blue-600 hover:text-blue-700 transition-colors">
                  ← Dashboard
                </Link>
                <span className="text-gray-300">/</span>
                <span className="text-gray-500">Edit Steps</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Training Step Editor</h1>
              <p className="mt-1 text-sm text-gray-500">
                Create and organize step-by-step instructions for your training module
              </p>
            </div>
            <div className="flex items-center gap-3">
              {steps.length > 0 && (
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  {steps.length} step{steps.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12 text-gray-600">
            <div className="w-10 h-10 mx-auto mb-4 animate-spin text-2xl">⏳</div>
            Loading transcript and module data...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Transcript & Add Step */}
            <div className="lg:col-span-1 space-y-6">
              {/* Transcript Preview */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    📄 Transcript
                  </h2>
                </div>
                <div className="p-6">
                  <div className="max-h-96 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {transcript || 'No transcript available for this module.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Add New Step Form */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-blue-50 px-6 py-4 border-b border-blue-200">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    ➕ Add New Step
                  </h2>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Step Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Prepare ingredients"
                      value={currentStep.stepTitle}
                      onChange={(e) => setCurrentStep(prev => ({ ...prev, stepTitle: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Step Description
                    </label>
                    <textarea
                      placeholder="Detailed instructions for this step..."
                      value={currentStep.text}
                      onChange={(e) => setCurrentStep(prev => ({ ...prev, text: e.target.value }))}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timestamp (seconds)
                    </label>
                    <input
                      type="number"
                      placeholder="120"
                      value={currentStep.timestamp ?? ''}
                      onChange={(e) => setCurrentStep(prev => ({ ...prev, timestamp: Number(e.target.value) || undefined }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={addStep}
                    disabled={!currentStep.stepTitle || !currentStep.text}
                    className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Step
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Steps List */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    📋 Training Steps
                  </h2>
                  {steps.length > 0 && (
                    <div className="flex items-center gap-3">
                      {saved && (
                        <span className="text-green-600 font-medium text-sm flex items-center gap-1">
                          ✅ Saved successfully
                        </span>
                      )}
                      <button
                        onClick={saveSteps}
                        disabled={saving || steps.length === 0}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {saving ? (
                          <>
                            <span className="animate-spin">⏳</span>
                            Saving...
                          </>
                        ) : (
                          <>
                            💾 Save Steps
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
                <div className="p-6">
                  {steps.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <div className="text-4xl mb-4">📝</div>
                      <h3 className="text-lg font-medium text-gray-800 mb-2">No steps created yet</h3>
                      <p className="text-sm">
                        Add your first training step using the form on the left to get started.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {steps.map((step, index) => (
                        <div
                          key={index}
                          className="bg-gray-50 border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200 group"
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-semibold text-sm">
                                  {index + 1}
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                  {step.stepTitle}
                                </h3>
                              </div>
                              <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                                {step.text}
                              </p>
                              {step.timestamp !== undefined && (
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  ⏱️ Timestamp: {step.timestamp}s
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => moveStep(index, 'up')}
                                disabled={index === 0}
                                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move up"
                              >
                                ⬆️
                              </button>
                              <button
                                onClick={() => moveStep(index, 'down')}
                                disabled={index === steps.length - 1}
                                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move down"
                              >
                                ⬇️
                              </button>
                              <button
                                onClick={() => removeStep(index)}
                                className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                title="Delete step"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}