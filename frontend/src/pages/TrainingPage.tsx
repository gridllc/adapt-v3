import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

type Status = 'UPLOADED' | 'PROCESSING' | 'READY' | 'ERROR'
type Step = { id: string; title: string; description?: string; startTime: number; endTime?: number }
type ModuleDto = { id: string; title: string; status: Status; error?: string | null }

export default function TrainingPage() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const [mod, setMod] = useState<ModuleDto | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollCount = useRef(0)

  // Use relative URLs - Vercel will proxy to Render backend
  const getJSON = async <T,>(p: string) => {
    const r = await fetch(p, { credentials: 'include' })
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
    return (await r.json()) as T
  }

  // initial load
  useEffect(() => {
    if (!moduleId) return
    let active = true
    ;(async () => {
      try {
        const data = await getJSON<{ success: boolean; module: ModuleDto; steps?: Step[] }>(`/api/modules/${moduleId}`)
        if (!active) return
        
        // 🎯 Null guard: ensure data and module exist before accessing properties
        if (!data || !data.module) {
          throw new Error('Invalid module data received')
        }
        
        setMod(data.module)
        setSteps(data.steps ?? [])
        
        // 🎯 Safe status check with null guard
        if (data.module.status === 'READY') {
          const v = await getJSON<{ url: string }>(`/api/video/${moduleId}/play`)
          if (active) setVideoUrl(v.url)
        }
      } catch (e: any) {
        if (active) setError(e?.message || 'Failed to load module')
      }
    })()
    return () => { active = false }
  }, [moduleId])

  // guarded polling
  useEffect(() => {
    if (!moduleId || !mod) return
    if (mod.status === 'READY' || mod.status === 'ERROR') return
    let active = true
    const max = 24
    const poll = async () => {
      if (!active || pollCount.current >= max) return
      pollCount.current += 1
      try {
        const s = await getJSON<{ success: boolean; module: ModuleDto }>(`/api/modules/${moduleId}/status`)
        if (!active) return
        
        // 🎯 Null guard: ensure status data exists before accessing properties
        if (!s || !s.module) {
          console.warn('Invalid status data received during polling')
          return
        }
        
        setMod(s.module)
        
        // 🎯 Safe status check with null guard
        if (s.module.status === 'READY') {
          const v = await getJSON<{ url: string }>(`/api/video/${moduleId}/play`)
          if (active) setVideoUrl(v.url)
          const st = await getJSON<{ steps: Step[] }>(`/api/steps/${moduleId}`)
          if (active) setSteps(st.steps ?? [])
          return
        }
        
        // 🎯 Safe status check with null guard
        if (s.module.status !== 'ERROR') {
          const delay = Math.min(8000, 900 + pollCount.current * 600)
          setTimeout(poll, delay)
        }
      } catch (e: any) {
        if (active) setError(e?.message || 'Polling failed')
      }
    }
    const id = setTimeout(poll, 900)
    return () => { active = false; clearTimeout(id) }
  }, [moduleId, mod])

  if (error && !mod) return <div className="p-6 text-red-600">Error: {error}</div>
  if (!mod) return <div className="p-6">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{mod.title}</h1>
        <span className={mod.status === 'READY' ? 'text-green-600' : mod.status === 'ERROR' ? 'text-red-600' : 'text-blue-600'}>
          {mod.status}
        </span>
      </div>

      <div className="bg-black rounded-lg aspect-video flex items-center justify-center">
        {videoUrl
          ? <video controls className="w-full h-full rounded-lg" src={videoUrl}/>
          : <span className="text-white/80">{mod.status === 'PROCESSING' ? 'Processing…' : 'Waiting for video…'}</span>}
      </div>

      {!!steps.length && (
        <div className="space-y-3">
          <h3 className="font-semibold">Training Steps</h3>
          {steps.map((s, i) => (
            <div key={s.id ?? i} className="border rounded p-3">
              <div className="text-sm font-medium">{i + 1}. {s.title}</div>
              {s.description && <div className="text-xs text-gray-600 mt-1">{s.description}</div>}
              <div className="text-[11px] text-gray-500 mt-1">{format(s.startTime)}{s.endTime ? ` – ${format(s.endTime)}` : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function format(sec: number) {
  const m = Math.floor(sec / 60); const s = Math.floor(sec % 60).toString().padStart(2, '0'); return `${m}:${s}`
}