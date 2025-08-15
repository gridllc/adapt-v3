import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api, API_ENDPOINTS } from '../config/api';

export interface Step {
  id: string;
  start: number;
  end: number;
  title: string;
  description: string;
  aliases?: string[];
  notes?: string;
  isManual?: boolean;
  originalText?: string;
  aiRewrite?: string;
  stepText?: string;
}

interface StepsState {
  steps: Step[];
  loading: boolean;
  error: string | null;
}

interface UseStepsReturn extends StepsState {
  reload: () => void;
  reorder: (fromIndex: number, toIndex: number) => Promise<void>;
  updateStep: (index: number, updatedStep: Step) => void;
  deleteStep: (index: number) => void;
  addStep: (step: Step) => void;
  /** fast time -> index lookup, O(log n). returns null if no step at time */
  getIndexAt: (timeSec: number) => number | null;
  /** last successful load timestamp */
  lastLoadedAt?: number;
  /** if auto-retrying, ms until next retry; undefined otherwise */
  nextRetryIn?: number;
}

export function useSteps(moduleId: string | undefined, status: any): UseStepsReturn {
  const [state, setState] = useState<StepsState>({
    steps: [],
    loading: false,
    error: null,
  });

  const [retryCount, setRetryCount] = useState(0);
  const [hasTriedOnce, setHasTriedOnce] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | undefined>(undefined);
  const [nextRetryIn, setNextRetryIn] = useState<number | undefined>(undefined);
  const maxRetries = 5;

  const retryTimer = useRef<number | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const retryDeadline = useRef<number | null>(null);

  // Reset when moduleId changes
  useEffect(() => {
    setState({ steps: [], loading: false, error: null });
    setRetryCount(0);
    setHasTriedOnce(false);
    setLastLoadedAt(undefined);
    setNextRetryIn(undefined);
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
    if (abortController.current) { abortController.current.abort(); abortController.current = null; }
    retryDeadline.current = null;
  }, [moduleId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (abortController.current) abortController.current.abort();
    };
  }, []);

  // compute stepStarts for binary search
  const stepStarts = useMemo(() => state.steps.map(s => s.start), [state.steps]);

  const getIndexAt = useCallback((t: number) => {
    if (!stepStarts.length) return null;
    // last start <= t
    let lo = 0, hi = stepStarts.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (stepStarts[mid] <= t) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    if (ans < 0) return null;
    const s = state.steps[ans];
    return t < s.end ? ans : null;
  }, [stepStarts, state.steps]);

  // when scheduling retry, surface nextRetryIn
  useEffect(() => {
    if (!retryTimer.current) { 
      setNextRetryIn(undefined); 
      return; 
    }
    
    let id: number | null = null;
    const tick = () => {
      if (retryDeadline.current) {
        const remaining = Math.max(0, retryDeadline.current - Date.now());
        setNextRetryIn(remaining);
        if (remaining > 0) {
          id = window.setTimeout(tick, 1000);
        }
      }
    };
    tick();
    return () => { if (id) clearTimeout(id); };
  }, [retryTimer.current]);

  const fetchSteps = useCallback(async (controller: AbortController) => {
    if (!moduleId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    // timeout that aborts the fetch
    let timeoutId: number | null = null;
    const timeoutPromise = new Promise<never>((_, rej) => {
      timeoutId = window.setTimeout(() => {
        controller.abort();
        rej(new Error('Request timeout'));
      }, 10000);
    });

    try {
      const freshUrl = `${API_ENDPOINTS.STEPS(moduleId)}?t=${Date.now()}`;
      const data = await Promise.race([
        api(freshUrl, { signal: controller.signal }),
        timeoutPromise
      ]);

      const stepsPayload = data?.steps;
      if (!stepsPayload?.length) {
        if (status?.status === 'ready') {
          throw new Error('Steps not found - module processing may have failed');
        }
        // Don't throw for processing state, just set loading and return
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      const enhanced = normalizeSteps(stepsPayload, data?.transcript || '');
      setState(prev => ({ ...prev, steps: enhanced, loading: false }));
      setRetryCount(0);
      setHasTriedOnce(true);
      setLastLoadedAt(Date.now());
    } catch (err: any) {
      if (controller.signal.aborted) return;
      console.error(`Error fetching steps for ${moduleId}:`, err);

      if (retryCount < maxRetries) {
        // clear previous timer before scheduling a new one
        if (retryTimer.current) clearTimeout(retryTimer.current);
        const delay = Math.min(2000 * Math.pow(1.5, retryCount), 15000);
        retryDeadline.current = Date.now() + delay;
        retryTimer.current = window.setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, delay);
      } else {
        setState(prev => ({ ...prev, error: 'Failed to load steps after multiple attempts', loading: false }));
        setHasTriedOnce(true);
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }, [moduleId, retryCount, status?.status]);

  // Main effect
  useEffect(() => {
    if (!moduleId) return;

    if (status?.status === 'processing') {
      // still processing—do not fetch yet
      return;
    }

    if (hasTriedOnce && retryCount === 0) {
      // skip auto-refetch until user explicitly reloads
      return;
    }

    const controller = new AbortController();
    abortController.current = controller;
    fetchSteps(controller);

    return () => controller.abort();
  }, [moduleId, retryCount, status?.status, hasTriedOnce, fetchSteps]);

  // Manual reload
  const reload = useCallback(() => {
    if (!moduleId) return;
    setRetryCount(0);
    setHasTriedOnce(false);
    setNextRetryIn(undefined);
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
    if (abortController.current) abortController.current.abort();
    retryDeadline.current = null;
    const controller = new AbortController();
    abortController.current = controller;
    fetchSteps(controller);
  }, [moduleId, fetchSteps]);

  // Reorder with revert fix
  const reorder = useCallback(async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    const prevSteps = state.steps;          // snapshot for revert
    const nextSteps = [...prevSteps];
    const [moved] = nextSteps.splice(fromIndex, 1);
    nextSteps.splice(toIndex, 0, moved);

    setState(prev => ({ ...prev, steps: nextSteps }));

    try {
      await api(API_ENDPOINTS.STEPS(moduleId || ''), {
        method: 'POST',
        body: JSON.stringify({ from: fromIndex, to: toIndex, action: 'reorder' }),
      });
    } catch (error) {
      console.error('Failed to save reordered steps:', error);
      setState(prev => ({ ...prev, steps: prevSteps })); // <- use snapshot, not the closure arg
      throw error;
    }
  }, [state.steps, moduleId]);

  const updateStep = useCallback((index: number, updatedStep: Step) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === index ? updatedStep : s)),
    }));
  }, []);

  const deleteStep = useCallback((index: number) => {
    setState(prev => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));
  }, []);

  const addStep = useCallback((step: Step) => {
    setState(prev => ({ ...prev, steps: [...prev.steps, step] }));
  }, []);

  return { 
    ...state, 
    reload, 
    reorder, 
    updateStep, 
    deleteStep, 
    addStep,
    getIndexAt,
    lastLoadedAt,
    nextRetryIn,
  };
}

/**
 * Normalize step schema and enhance with metadata
 */
function normalizeSteps(stepsPayload: any[], transcript: string): Step[] {
  const enhanced = stepsPayload.map((s: any, i: number) => ({
    id: s.id || `step-${i}`,
    start: s.start || 0,
    end: s.end || 0,
    title: s.title || `Step ${i + 1}`,
    description: s.description || s.text || '',
    aliases: s.aliases || [],
    notes: s.notes || '',
    isManual: s.isManual || false,
    originalText: transcript,
    aiRewrite: s.aiRewrite || '',
    stepText: s.stepText || s.description || s.text || '',
  }));

  // Sort by start time and return
  enhanced.sort((a, b) => a.start - b.start);
  return enhanced;
} 
