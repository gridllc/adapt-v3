import React from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { UploadPhase } from '../../types/upload'

const showDebug =
  import.meta.env.DEV &&
  (import.meta.env.VITE_DEBUG_UI === '1' || import.meta.env.VITE_DEBUG_UI === 'true')

export function ProcessingBanner({
  phase,
  progress,
  moduleId,
}: { 
  phase: UploadPhase
  progress: number
  moduleId?: string 
}) {
  const uploading  = phase === 'uploading'
  const finalizing = phase === 'finalizing'
  const processing = phase === 'processing'
  const ready      = phase === 'ready'

  return (
    <div className="mb-4 rounded-xl border bg-white p-4 shadow-sm dark:bg-zinc-900">
      <div className="flex items-center gap-2 font-medium">
        {ready ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        )}
        <span>
          {uploading  && 'Uploading your video…'}
          {finalizing && 'Preparing processing…'}
          {processing && 'Processing your video…'}
          {ready      && 'Video is ready!'}
        </span>
      </div>

      {/* Progress bar - show for uploading/finalizing phases */}
      {(uploading || finalizing) && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-2 rounded bg-zinc-600 transition-all duration-300"
            style={{ width: `${Math.min(progress, 99)}%` }}
          />
        </div>
      )}

      {/* Processing status - show prominently */}
      {processing && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-blue-800">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-medium">Processing in progress...</span>
          </div>
          
          {showDebug && moduleId && (
            <div className="mt-2 text-sm text-blue-700">
              Module ID: <span className="font-mono">{moduleId}</span>
            </div>
          )}
          
          {showDebug && (
            <div className="mt-1 text-xs text-blue-600">
              You'll be taken to training automatically when it's ready.
            </div>
          )}
        </div>
      )}

      {/* Finalizing status */}
      {finalizing && (
        <div className="mt-2 text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Preparing your video for processing...</span>
          </div>
        </div>
      )}
    </div>
  )
}
