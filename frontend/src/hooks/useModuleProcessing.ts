import { useEffect, useRef, useState } from "react";

type Status = "UPLOADED" | "PROCESSING" | "READY" | "FAILED";

export function useModuleProcessing(moduleId?: string) {
  const [status, setStatus] = useState<Status>("UPLOADED");
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!moduleId) return;

    let cancelled = false;

    async function tick() {
      try {
        // Reuse the same steps endpoint your Training page uses.
        // It returns READY with steps, or a PROCESSING/FAILED sentinel in JSON/logs.
        console.log(`🔍 Checking module status for: ${moduleId}`);
        const res = await fetch(`/api/steps/${moduleId}`);
        const data = await res.json();
        console.log(`📊 Module status response:`, data);

        if (cancelled) return;

        if (data.success && Array.isArray(data.steps) && data.steps.length > 0) {
          setStatus("READY");
          setProgress(100);
          return;
        }

        // Your backend logs show these fields during processing:
        // { status: 'PROCESSING'|'FAILED', progress: 0-100 }
        if (data.status === "FAILED") {
          setStatus("FAILED");
          setError(data.message || "Processing failed.");
          return;
        }

        // default: still processing
        setStatus("PROCESSING");
        setProgress(typeof data.progress === "number" ? data.progress : 0);

        timer.current = window.setTimeout(tick, 2000);
      } catch (e: any) {
        if (cancelled) return;
        // Treat network hiccups as "keep polling"
        timer.current = window.setTimeout(tick, 3000);
      }
    }

    // kick off immediately
    tick();

    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [moduleId]);

  return { status, progress, error };
}
