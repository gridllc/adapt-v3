import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

type ModuleStatus = "UPLOADED" | "PROCESSING" | "READY" | "FAILED";

interface Step {
  id?: string;
  order?: number;
  text?: string;
  startTime?: number; // seconds
  endTime?: number;   // seconds
  aiConfidence?: number | null;
}

interface ModuleDto {
  id: string;
  title: string;
  filename: string;
  status: ModuleStatus;
  progress?: number;
  videoUrl?: string;        // server adds a presigned playback URL when READY
  transcriptText?: string;  // saved by webhook->steps generator
  steps?: Step[];
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const humanTime = (s?: number) =>
  typeof s === "number"
    ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
    : "-";

const API = (path: string) =>
  `${import.meta.env.VITE_API_BASE_URL ?? ""}${path}` || `/api${path}`;

export default function TrainingPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const [mod, setMod] = useState<ModuleDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canPlay = mod?.status === "READY" && !!mod.videoUrl;

  const sortedSteps = useMemo(() => {
    const steps = mod?.steps ?? [];
    // fall back to order or startTime
    return [...steps].sort((a, b) => {
      const ao = a.order ?? a.startTime ?? 0;
      const bo = b.order ?? b.startTime ?? 0;
      return ao - bo;
    });
  }, [mod]);

  async function fetchModule(id: string) {
    try {
      setLoading(true);
      setError(null);
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const r = await fetch(API(`/api/modules/${id}`), {
        signal: abortRef.current.signal,
        credentials: "include",
      });
      if (!r.ok) throw new Error(`Failed to fetch module (${r.status})`);
      const data = await r.json();
      // moduleRoutes returns { success, module: { ...mod, videoUrl, steps } }
      if (!data?.success || !data?.module) throw new Error("Invalid module data received");
      const hydrated: ModuleDto = {
        id: data.module.id,
        title: data.module.title,
        filename: data.module.filename,
        status: data.module.status,
        progress: data.module.progress ?? 0,
        videoUrl: data.module.videoUrl,
        transcriptText: data.module.transcriptText,
        steps: data.module.steps ?? [],
        lastError: data.module.lastError ?? null,
        createdAt: data.module.createdAt,
        updatedAt: data.module.updatedAt,
      };
      setMod(hydrated);
      setLoading(false);
      return hydrated;
    } catch (e: any) {
      setLoading(false);
      setError(e?.message || "Failed to load module");
      throw e;
    }
  }

  async function checkStatus(id: string) {
    try {
      const r = await fetch(API(`/api/modules/${id}/status`), {
        credentials: "include",
      });
      if (!r.ok) throw new Error(`Status check failed (${r.status})`);
      const data = await r.json();
      if (!data?.success) throw new Error("Invalid status response");
      return {
        status: data.status as ModuleStatus,
        progress: Number(data.progress ?? 0),
      };
    } catch (e: any) {
      // don't throw to avoid breaking the poll loop on transient failures
      return { status: mod?.status ?? "PROCESSING", progress: mod?.progress ?? 0 };
    }
  }

  // Initial load
  useEffect(() => {
    if (!moduleId) return;
    fetchModule(moduleId).catch(() => {});
    // cleanup inflight fetches on unmount
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  // Poll while PROCESSING, then refresh on READY
  useEffect(() => {
    if (!moduleId || !mod) return;

    if (mod.status !== "PROCESSING") {
      setPolling(false);
      return;
    }

    let isActive = true;
    setPolling(true);

    // backoff: 2s → 3s → 5s → 8s (cap 8s)
    const intervalFor = (n: number) => {
      if (n < 1) return 2000;
      if (n < 3) return 3000;
      if (n < 6) return 5000;
      return 8000;
    };

    async function loop(n = 0): Promise<void> {
      if (!isActive) return;

      const { status, progress } = await checkStatus(moduleId);
      setMod((m) => (m ? { ...m, status, progress } : m));
      setPollCount((c) => c + 1);

      if (status === "READY") {
        await fetchModule(moduleId);
        setPolling(false);
        return;
      }
      if (status === "FAILED") {
        setError("Processing failed. Please re-upload or try another file.");
        setPolling(false);
        return;
      }

      setTimeout(() => loop(n + 1), intervalFor(n));
    }

    loop().catch(() => {});
    return () => {
      isActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, mod?.status]);

  if (!moduleId) {
    return <div className="text-red-600">Missing module id.</div>;
  }

  if (loading && !mod) {
    return (
      <div className="py-16 text-center">
        <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600 mx-auto" />
        <div className="mt-4 text-gray-600">Loading module…</div>
      </div>
    );
  }

  if (error && !mod) {
    return (
      <div className="bg-red-50 border border-red-200 p-4 rounded">
        <div className="text-red-700 font-medium">Error</div>
        <div className="text-red-600 text-sm mt-1">{error}</div>
        <button
          className="mt-3 px-3 py-2 bg-red-600 text-white rounded"
          onClick={() => {
            setError(null);
            if (moduleId) fetchModule(moduleId).catch(() => {});
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{mod?.title ?? "Training"}</h1>
          <p className="text-gray-500 text-sm">{mod?.filename}</p>
        </div>

        <div className="flex items-center gap-2">
          {mod?.status === "PROCESSING" && (
            <>
              <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-blue-600" />
              <span className="text-blue-600 text-sm">
                Processing… {polling ? `(checks: ${pollCount})` : ""}
                {typeof mod?.progress === "number" ? ` • ${mod.progress}%` : ""}
              </span>
            </>
          )}
          {mod?.status === "READY" && (
            <span className="text-green-600 text-sm font-medium">✓ Ready</span>
          )}
          {mod?.status === "FAILED" && (
            <span className="text-red-600 text-sm font-medium">✗ Failed</span>
          )}
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video */}
        <div className="lg:col-span-2">
          <div className="bg-black rounded-lg aspect-video overflow-hidden">
            {canPlay ? (
              <video
                key={mod?.videoUrl} // ensure reload on new URL
                controls
                className="w-full h-full"
                src={mod?.videoUrl}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-white text-sm">
                {mod?.status === "PROCESSING" ? "Preparing video…" : "No video"}
              </div>
            )}
          </div>

          {/* Steps */}
          {sortedSteps.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">Training Steps</h3>
              {sortedSteps.map((s, i) => (
                <div key={s.id ?? i} className="border rounded p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-sm font-medium">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-gray-700 whitespace-pre-line">
                        {s.text || "(no text)"}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {humanTime(s.startTime)} – {humanTime(s.endTime)}
                        {typeof s.aiConfidence === "number"
                          ? ` • conf: ${(s.aiConfidence * 100).toFixed(0)}%`
                          : ""}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transcript / Assistant */}
        <aside className="bg-white border rounded p-4 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Transcript</h3>
          {mod?.transcriptText ? (
            <div className="text-sm text-gray-800 whitespace-pre-wrap max-h-[60vh] overflow-auto">
              {mod.transcriptText}
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              {mod?.status === "PROCESSING"
                ? "Transcribing… this will populate automatically."
                : "No transcript was saved for this module."}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}