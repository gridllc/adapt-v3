// hooks/useStepsProbe.ts
import { useEffect } from 'react'
import { api } from '../config/api' // your fetch helper

export function useStepsProbe(moduleId: string) {
  useEffect(() => {
    (async () => {
      try {
        console.log('[AI DEBUG] steps probe start', { moduleId })
        const r = await api(`/api/steps/${moduleId}`)
        if (!r?.success) {
          console.warn('[AI DEBUG] steps probe failed', r)
        } else {
          console.log('[AI DEBUG] steps probe ok', { count: r.steps?.length ?? 0 })
        }
      } catch (e) {
        console.error('[AI DEBUG] steps probe error', e)
      }
    })()
  }, [moduleId])
}
