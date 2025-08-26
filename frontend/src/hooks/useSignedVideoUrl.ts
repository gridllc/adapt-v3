// src/hooks/useSignedVideoUrl.ts
import { useEffect, useState } from "react";

export function useSignedVideoUrl(moduleId?: string) {
  const [url, setUrl] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!moduleId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(undefined);
      try {
        const r = await fetch(`/api/video-url/by-module/${moduleId}`);
        const j = await r.json();
        if (!cancelled) {
          if (j.success && j.url) setUrl(j.url);
          else setError(j.error || "failed to get signed url");
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [moduleId]);

  return { url, loading, error };
}