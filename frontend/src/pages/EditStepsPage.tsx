// ✅ EditStepsPage.tsx with Enhanced EditableStep Component
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
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
  const { moduleId } = useParams()
  const navigate = useNavigate()
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  console.log('🔧 EditStepsPage: moduleId =', moduleId)

  // Transform backend data to expected format
  const transformSteps = (backendSteps: any[]): Step[] => {
    return backendSteps.map((step, index) => ({
      id: step.id || `step-${index}`,
      text: step.title || step.text || step.description || '',
      start: step.timestamp || step.start || 0,
      end: (step.timestamp || step.start || 0) + (step.duration || 30),
      aliases: step.aliases || [],
      notes: step.notes || ''
    }))
  }

  useEffect(() => {
    if (!moduleId) return
    setLoading(true)
    api(API_ENDPOINTS.STEPS(moduleId))
      .then(data => {
        console.log('📋 Backend steps data:', data.steps)
        const transformedSteps = transformSteps(data.steps || [])
        console.log('🔄 Transformed steps:', transformedSteps)
        setSteps(transformedSteps)
      })
      .catch((err) => {
        console.error('❌ Error loading steps:', err)
        setError('Failed to load steps')
      })
      .finally(() => setLoading(false))
  }, [moduleId])

  const handleSaveStep = async (updatedStep: Step, index: number) => {
    const newSteps = [...steps]
    newSteps[index] = updatedStep
    setSteps(newSteps)

    try {
      await api(`/api/steps/${moduleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: newSteps }),
      })
      console.log(`✅ Step ${index + 1} saved`)
    } catch (err) {
      console.error('❌ Save error:', err)
    }
  }

  const handleAIRewrite = async (text: string): Promise<string> => {
    try {
      const data = await api(`/api/steps/${moduleId}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text,
          instruction: "Rewrite this training step to improve clarity, fix grammar, and make it easier to follow. Add helpful details only if something important is missing. Keep it concise, human, and easy to understand."
        }),
      })
      
      return data.text
    } catch (err) {
      console.error('AI rewrite error:', err)
      throw new Error('Failed to rewrite with AI')
    }
  }

  const handleSeek = (time: number) => {
    // Navigate back to training page with seek parameter
    console.log('Seeking to:', time)
    navigate(`/training/${moduleId}?seek=${time}`)
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

  if (loading) return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Edit Steps</h1>
      <div className="text-center py-8">
        <div className="w-8 h-8 mx-auto animate-spin text-blue-600">⏳</div>
        <p className="text-gray-600 mt-2">Loading steps...</p>
        <p className="text-xs text-gray-400 mt-1">Module ID: {moduleId}</p>
      </div>
    </div>
  )
  if (error) return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Edit Steps</h1>
      <div className="text-center py-8">
        <div className="text-red-500 mb-2">⚠️</div>
        <p className="text-red-600">{error}</p>
        <p className="text-xs text-gray-400 mt-1">Module ID: {moduleId}</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Edit Steps</h1>
        <Link
          to={`/training/${moduleId}`}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm"
        >
          ← Back to Training
        </Link>
      </div>

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