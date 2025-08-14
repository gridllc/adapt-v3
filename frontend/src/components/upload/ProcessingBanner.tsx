import React from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { UploadPhase } from '../../types/upload'

export function ProcessingBanner({
  phase,
  progress,
  moduleId,
}: { 
  phase: UploadPhase
  progress: number
  moduleId?: string 
}) {
  const uploading = phase === 'uploading'
  const finalizing = phase === 'finalizing'
  const processing = phase === 'processing'
  const ready = phase === 'ready'

  return (
    <div className="mb-4 rounded-xl border bg-white p-4 shadow-sm dark:bg-zinc-900">
      <div className="flex items-center gap-2 font-medium">
        {ready ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        )}
        <span>
          {uploading && 'Uploading your video…'}
          {finalizing && 'Preparing processing…'}
          {processing && 'Processing your video…'}
          {ready && 'Video is ready!'}
        </span>
      </div>

      {(uploading || finalizing) && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-2 rounded bg-zinc-600 transition-all"
            style={{ width: `${Math.min(progress, 99)}%` }}
          />
        </div>
      )}

      {processing && (
        <div className="mt-2 text-sm text-zinc-500">
          {moduleId ? (
            <>
              Module ID: <span className="font-mono">{moduleId}</span>
            </>
          ) : (
            <>Setting up module…</>
          )}
          <div className="mt-1 text-xs">
            You'll be taken to training automatically when it's ready.
          </div>
        </div>
      )}
    </div>
  )
}
