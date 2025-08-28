// src/hooks/useSignedVideoUrl.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { api, API_ENDPOINTS } from "../config/api";

interface UseSignedVideoUrlResult {
  url: string | null
  loading: boolean
  error: string | null
  refreshOnError: () => Promise<void>
  refetch: () => Promise<void>
}

export function useSignedVideoUrl(moduleId?: string): UseSignedVideoUrlResult {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triedRef = useRef(0);

  const fetchUrl = useCallback(async () => {
    if (!moduleId) {
      setUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔗 Fetching video URL for module:', moduleId);

      const response = await api.get<string>(API_ENDPOINTS.VIDEO_URL_BY_MODULE(moduleId), {
        // prevent caches holding old signed URL
        params: { t: Date.now() },
      });

      console.log('📦 Video URL response:', response.data);

      if (response.data) {
        setUrl(response.data);
        setError(null);
        triedRef.current = 0;
      } else {
        setUrl(null);
        setError('No URL returned from server');
      }
    } catch (err) {
      console.error('❌ Video URL error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get video URL');
      setUrl(null);
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  const refreshOnError = useCallback(async () => {
    if (triedRef.current >= 2) {
      console.warn('Max retry attempts reached for video URL refresh');
      return; // avoid loops
    }
    triedRef.current += 1;
    console.log(`🔄 Refreshing video URL (attempt ${triedRef.current})`);
    await fetchUrl();
  }, [fetchUrl]);

  useEffect(() => {
    fetchUrl();
  }, [fetchUrl]);

  return { url, loading, error, refreshOnError, refetch: fetchUrl };
}