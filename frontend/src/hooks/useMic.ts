import { useState, useRef, useCallback, useEffect } from 'react'

interface UseMicResult {
  isRecording: boolean
  error: string | null
  start: () => Promise<void>
  stop: () => void
  audioBlob: Blob | null
}

/**
 * Minimal microphone hook
 * - Requests permission
 * - Provides start/stop
 * - Returns Blob of recording
 */
export function useMic(): UseMicResult {
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const start = useCallback(async () => {
    try {
      setError(null)
      setAudioBlob(null)

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
      }

      recorder.start()
      setIsRecording(true)
    } catch (err: any) {
      setError(err.message || 'Microphone access denied')
    }
  }, [])

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
      recorder.stream.getTracks().forEach((t) => t.stop())
    }
    setIsRecording(false)
  }, [])

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  return { isRecording, error, start, stop, audioBlob }
}
