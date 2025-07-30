// ✅ EditStepsPage.tsx with Add Step + Delete All + Save
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, API_ENDPOINTS } from '../config/api'

interface Step {
  timestamp: number
  title: string
  description: string
  duration?: number
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

  const updateStep = (index: number, key: keyof Step, value: string | number) => {
    const updated = [...steps]
    updated[index] = { ...updated[index], [key]: value }
    setSteps(updated)
  }

  const addStep = () => {
    setSteps(prev => [
      ...prev,
      { timestamp: 0, title: 'New Step', description: '' },
    ])
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
        <div key={i} className="mb-6 border rounded-lg p-4 bg-white shadow-sm">
          <div className="mb-2">
            <label className="block text-sm font-medium">Timestamp (sec)</label>
            <input
              type="number"
              value={step.timestamp}
              onChange={e => updateStep(i, 'timestamp', Number(e.target.value))}
              className="w-full border px-3 py-2 rounded mt-1"
            />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium">Title</label>
            <input
              type="text"
              value={step.title}
              onChange={e => updateStep(i, 'title', e.target.value)}
              className="w-full border px-3 py-2 rounded mt-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Description</label>
            <textarea
              value={step.description}
              onChange={e => updateStep(i, 'description', e.target.value)}
              className="w-full border px-3 py-2 rounded mt-1"
            />
          </div>
        </div>
      ))}
    </div>
  )
}