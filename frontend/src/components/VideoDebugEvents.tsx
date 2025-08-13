// components/VideoDebugEvents.tsx
import React, { useEffect, useRef } from 'react'

export const VideoDebugEvents: React.FC<{ src: string }> = ({ src }) => {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const events = [
      'loadstart','loadedmetadata','loadeddata','canplay','canplaythrough',
      'play','playing','pause','seeking','seeked','waiting','stalled','suspend','ended','error'
    ] as const
    const handler = (e: Event) => {
      const tag = (e.type || 'evt').padEnd(14, ' ')
      const rs = v.readyState
      const nt = Number.isFinite(v.currentTime) ? v.currentTime.toFixed(3) : 'n/a'
      console.log(`[VIDEO] ${tag} t=${nt} readyState=${rs} src=${v.currentSrc || '(none)'}`)
      if (e.type === 'error' && v.error) {
        console.error('[VIDEO] mediaError', v.error, v.networkState)
      }
    }
    events.forEach(ev => v.addEventListener(ev, handler))
    return () => events.forEach(ev => v.removeEventListener(ev, handler))
  }, [src])

  return <video ref={ref} src={src} controls playsInline style={{ width: '100%' }} />
}
