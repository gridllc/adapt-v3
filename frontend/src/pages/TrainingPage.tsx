// frontend/src/pages/TrainingPage.tsx
import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { ProcessingBanner } from "@/components/upload/ProcessingBanner"

interface ModuleData {
  id: string
  status: "UPLOADING" | "PROCESSING" | "READY" | "ERROR"
  stepsKey?: string
}

interface Step {
  start: number
  end: number
  text: string
}

const TrainingPage: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>()
  const [module, setModule] = useState<ModuleData | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)

  // Load module metadata on mount
  useEffect(() => {
    const fetchModule = async () => {
      try {
        const res = await fetch(`/api/modules/${moduleId}`)
        if (!res.ok) throw new Error("Failed to load module")
        const data: ModuleData = await res.json()
        setModule(data)

        // If ready, fetch steps JSON from S3
        if (data.status === "READY" && data.stepsKey) {
          const stepsRes = await fetch(data.stepsKey)
          if (!stepsRes.ok) throw new Error("Failed to load steps")
          const stepsData: Step[] = await stepsRes.json()
          setSteps(stepsData)
        }
      } catch (err) {
        console.error("Error loading module:", err)
        setModule({ id: moduleId!, status: "ERROR" })
      } finally {
        setLoading(false)
      }
    }

    if (moduleId) fetchModule()
  }, [moduleId])

  if (loading) {
    return <div className="p-6">Loading training module...</div>
  }

  if (!module) {
    return <div className="p-6">Module not found</div>
  }

  if (module.status !== "READY") {
    return (
      <div className="p-6">
        <ProcessingBanner
          status={module.status.toLowerCase() as any}
        />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Training Module</h1>
      {steps.length === 0 ? (
        <p>No steps available.</p>
      ) : (
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="p-3 border rounded bg-white shadow-sm"
            >
              <p className="text-sm text-gray-700">
                <strong>{step.start}s → {step.end}s</strong>: {step.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TrainingPage
