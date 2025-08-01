// ✅ EditStepsPage.tsx with Enhanced EditableStep Component
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, API_ENDPOINTS } from '../config/api'
import { EditableStep } from '../components/EditableStep'

interface Step {
  id: string
  text: string
  start: number
  end: number
  aliases?: string[]
  notes?: string
}

export default function EditStepsPage() {
  const { id: moduleId } = useParams()
  const navigate = useNavigate()
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!moduleId) return
    setLoading(true)
    api(API_ENDPOINTS.STEPS(moduleId))
      .then(data => setSteps(data.steps || []))
      .catch(() => setError('Failed to load steps'))
      .finally(() => setLoading(false))
  }, [moduleId])

  const handleSaveStep = async (updatedStep: Step, index: number) => {
    const newSteps = [...steps]
    newSteps[index] = updatedStep
    setSteps(newSteps)

    try {
      const res = await fetch(`/api/steps/${moduleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: newSteps }),
      })
      if (!res.ok) throw new Error('Failed to save')
      console.log(`✅ Step ${index + 1} saved`)
    } catch (err) {
      console.error('❌ Save error:', err)
    }
  }

  const handleAIRewrite = async (text: string): Promise<string> => {
    try {
      const res = await fetch(`/api/steps/${moduleId}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      
      if (!res.ok) throw new Error('AI rewrite failed')
      
      const data = await res.json()
      return data.text
    } catch (err) {
      console.error('AI rewrite error:', err)
      throw new Error('Failed to rewrite with AI')
    }
  }

  const handleSeek = (time: number) => {
    // This would integrate with video player
    console.log('Seeking to:', time)
    // TODO: Implement video seeking functionality
  }

  const addStep = () => {
    const newStep: Step = {
      id: `step-${Date.now()}`,
      text: 'New Step',
      start: 0,
      end: 30,
      aliases: [],
      notes: ''
    }
    setSteps(prev => [...prev, newStep])
  }

  const saveChanges = async () => {
    if (!moduleId) return
    setSaving(true)
    try {
      await api(API_ENDPOINTS.STEPS(moduleId), {
        method: 'POST',
        body: JSON.stringify({ steps }),
      })
      navigate('/dashboard')
    } catch {
      alert('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const deleteSteps = async () => {
    if (!moduleId) return
    if (!confirm('Delete all steps for this module?')) return
    try {
      await api(`/api/steps/${moduleId}`, { method: 'DELETE' })
      setSteps([])
    } catch {
      alert('Failed to delete step file')
    }
  }

  if (loading) return <p>Loading steps...</p>
  if (error) return <p className="text-red-600">{error}</p>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Edit Steps</h1>

      <div className="flex justify-between items-center mb-4 gap-3">
        <button
          onClick={addStep}
          className="bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 px-4 py-2 rounded"
        >➕ Add Step</button>

        <div className="flex gap-2">
          <button
            onClick={saveChanges}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-semibold"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          <button
            onClick={deleteSteps}
            className="text-red-600 hover:text-red-800 font-medium text-sm"
          >🗑️ Delete All Steps</button>
        </div>
      </div>

      {steps.map((step, i) => (
        <EditableStep
          key={step.id || i}
          step={step}
          index={i}
          onSeek={handleSeek}
          onSave={(updatedStep) => handleSaveStep(updatedStep, i)}
          onAIRewrite={handleAIRewrite}
        />
      ))}
    </div>
  )
}