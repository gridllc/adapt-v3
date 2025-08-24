import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import StickyVoiceBar from "../components/StickyVoiceBar";
import { useVoiceAsk } from "@/hooks/useVoiceAsk";
import { useToast } from "@/components/Toast";
import { retry } from "@/lib/api";

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

// ✅ FIXED: Using consistent API helper
import { apiGet, apiPost, apiUrl } from '@/lib/api';

// AI Chat component
function AskBox({ moduleId }: { moduleId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askQuestion = async () => {
    if (!question.trim()) return;
    
    try {
      setLoading(true);
      setError(null);
      setAnswer(null);

      const data = await apiPost<any>("/api/qa/ask", { moduleId, question: question.trim() });
      
      if (data?.success && data?.answer) {
        setAnswer(data.answer);
      } else {
        setAnswer(data?.answer || "No answer returned from AI.");
      }
    } catch (e: any) {
      console.error("AI Chat error:", e);
      setError(e?.message || "Failed to get AI response");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label htmlFor="question" className="block text-sm font-medium text-gray-700">
          Ask about any step or the training content
        </label>
        <textarea
          id="question"
          className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          rows={3}
          placeholder="e.g., What's the first step? How do I handle errors? What tools do I need?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
        />
      </div>
      
      <button
        onClick={askQuestion}
        disabled={loading || !question.trim()}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
            Asking AI...
          </>
        ) : (
          "Ask AI Assistant"
        )}
      </button>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-800 text-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Error: {error}</span>
          </div>
        </div>
      )}

      {/* Answer Display */}
      {answer && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-green-800 mb-2">AI Response:</h4>
              <div className="text-sm text-green-700 whitespace-pre-wrap">
                {answer}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrainingPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [mod, setMod] = useState<ModuleDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [micStatus, setMicStatus] = useState<'checking' | 'available' | 'denied' | 'not-supported'>('checking');
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [showTextQA, setShowTextQA] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ✅ CRITICAL: Validate moduleId early to prevent infinite spinner
  if (!moduleId || /<|>/.test(moduleId)) {
    return (
      <div className="bg-red-50 border border-red-200 p-4 rounded">
        <div className="text-red-700 font-medium">Invalid module link</div>
        <div className="text-red-600 text-sm mt-1">
          This page was opened with a placeholder module id. Please return to the dashboard and open the module again.
        </div>
      </div>
    );
  }

  // Voice controller with toast notifications
  const toast = useToast();
  const voice = useVoiceAsk(moduleId!, {
    onAnswer: (a) => toast(a),                // ✅ Answer toast
    onError: (msg) => toast(msg),            // show errors too
  });

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

  // Check microphone availability
  useEffect(() => {
    const checkMicrophone = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setMicStatus('not-supported');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setMicStatus('available');
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setMicStatus('denied');
        } else {
          setMicStatus('not-supported');
        }
      }
    };

    checkMicrophone();
  }, []);

  // Request notification permission for processing completion
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);



  // Handler functions for interactive buttons
  const handleAddStep = () => {
    // For now, redirect to full edit page for adding steps
    navigate(`/edit-steps/${moduleId}`);
  };

  const handleEditStep = (step: Step, index: number) => {
    // For now, redirect to full edit page for editing steps
    navigate(`/edit-steps/${moduleId}`);
  };

  const handleAIRewrite = (step: Step, index: number) => {
    // For now, redirect to full edit page for AI rewrite
    navigate(`/edit-steps/${moduleId}`);
  };

  const handleDeleteStep = (step: Step, index: number) => {
    // For now, redirect to full edit page for deleting steps
    navigate(`/edit-steps/${moduleId}`);
  };

  const handleStepClick = (step: Step, index: number) => {
    // Regular click - could be used for step navigation later
    console.log('Step clicked:', step);
  };

  async function fetchModule(id: string) {
    try {
      setLoading(true);
      setError(null);
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      
      // Use the new API helper with retry logic
      console.log(`🔍 [TRAINING] Fetching module: ${id}`);
      const data = await apiGet<any>(`/api/modules/${id}`);
      console.log(`📊 [TRAINING] Module data received:`, {
        success: data?.success,
        hasModule: !!data?.module,
        status: data?.module?.status,
        hasSteps: !!(data?.module?.steps?.length),
        stepCount: data?.module?.steps?.length || 0
      });
      
      // ✅ FIXED: Ensure consistent module shape with type guard
      if (!data?.success || !data?.module) {
        console.error("❌ [TRAINING] Invalid module response:", data);
        throw new Error("Invalid module data received");
      }
      
      // Validate required fields
      if (!data.module.id || !data.module.status) {
        console.error("❌ [TRAINING] Missing required module fields:", data.module);
        throw new Error("Module missing required fields");
      }
      
      const hydrated: ModuleDto = {
        id: data.module.id,
        title: data.module.title || "Untitled Module",
        filename: data.module.filename || "Video",
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
      console.log(`🔍 [STATUS] Checking status for module: ${id}`);
      const data = await apiGet<any>(`/api/modules/${id}`);
      console.log(`📊 [STATUS] Status data received:`, {
        success: data?.success,
        status: data?.module?.status,
        progress: data?.module?.progress
      });
      
      // ✅ FIXED: Better validation with fallback values
      if (!data?.success || !data?.module) {
        console.warn(`⚠️ [STATUS] Invalid status response for ${id}, attempting recovery...`);
        throw new Error("Invalid module response");
      }
      
      // Ensure we have valid status and progress
      const status = data.module.status as ModuleStatus || "PROCESSING";
      const progress = Number(data.module.progress ?? 0);
      
      return { status, progress };
    } catch (e: any) {
      console.warn(`⚠️ [STATUS] Status check failed for ${id}:`, e.message);
      
      // ✅ FIXED: Attempt recovery instead of returning PROCESSING forever
      try {
        console.log(`🔄 [STATUS] Attempting to fetch full module for recovery...`);
        const refreshed = await fetchModule(id);
        return { status: refreshed.status, progress: Number(refreshed.progress ?? 0) };
      } catch (recoveryError) {
        console.error(`❌ [STATUS] Recovery failed for ${id}:`, recoveryError);
        // Give up gracefully; don't force PROCESSING forever
        return { 
          status: (mod?.status ?? "UPLOADED") as ModuleStatus, 
          progress: Number(mod?.progress ?? 0) 
        };
      }
    }
  }

  // Initial load
  useEffect(() => {
    if (!moduleId) return;
    
    // ✅ FIXED: Add optimistic state for immediate feedback
    if (!mod && !loading) {
      setMod({ 
        id: moduleId, 
        title: "Processing…", 
        filename: "Video", 
        status: "PROCESSING", 
        progress: 10 
      });
    }
    
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

    // ✅ FIXED: Add MAX_POLLS limit to prevent infinite polling
    const MAX_POLLS = 60; // ~5–8 min depending on backoff
    
    async function loop(n = 0): Promise<void> {
      if (!isActive) return;
      
      // Stop polling after max attempts to prevent infinite spinner
      if (n > MAX_POLLS) {
        setError("Still processing? This usually means the link was opened with a placeholder id or the tab lost auth. Try opening the module from the dashboard.");
        setPolling(false);
        return;
      }

      const { status, progress } = await retry(() => checkStatus(moduleId));
      setMod((m) => (m ? { ...m, status, progress } : m));
      setPollCount((c) => c + 1);

      if (status === "READY") {
        await fetchModule(moduleId);
        setPolling(false);
        
        // Show success banner
        setShowSuccessBanner(true);
        setTimeout(() => setShowSuccessBanner(false), 5000);
        
        // Show success notification
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Video Processing Complete!', {
            body: 'Your training module is ready to use.',
            icon: '/favicon.ico'
          });
        }
        
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

  // Enhanced processing screen
  if (mod?.status === "PROCESSING") {
    const getProgressStep = (progress?: number) => {
      if (!progress) return "Starting...";
      if (progress < 25) return "Initializing processing...";
      if (progress < 40) return "Preparing media URL...";
      if (progress < 60) return "Submitting to transcription service...";
      if (progress < 100) return "Transcribing and analyzing...";
      return "Finalizing...";
    };

    return (
      <div className="py-16 text-center max-w-2xl mx-auto">
        <div className="animate-spin h-16 w-16 rounded-full border-b-4 border-blue-600 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Processing Your Video</h1>
        <div className="space-y-4 text-gray-600">
          <p className="text-lg">
            Our AI is analyzing your video and generating training steps...
          </p>
          
          {/* Progress Bar */}
          {typeof mod?.progress === "number" && (
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${mod.progress}%` }}
              />
            </div>
          )}
          
          <div className="text-lg font-medium text-blue-600">
            {getProgressStep(mod?.progress)}
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <h3 className="font-medium text-blue-900 mb-2">What's happening:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Extracting audio from video</li>
              <li>• Transcribing speech with OpenAI Whisper</li>
              <li>• Analyzing content to identify key steps</li>
              <li>• Generating structured training guide</li>
            </ul>
          </div>
          
          <div className="text-sm text-gray-500">
            Status checks: {pollCount} • Progress: {typeof mod?.progress === "number" ? `${mod.progress}%` : "Analyzing..."}
          </div>
          
          <div className="text-xs text-gray-400">
            This usually takes 1-3 minutes depending on video length
          </div>
          
          {/* Estimated time remaining */}
          {pollCount > 0 && (
            <div className="text-xs text-gray-400">
              Checked {pollCount} time{pollCount !== 1 ? 's' : ''} • Next check in {pollCount < 3 ? '2-3' : '5-8'} seconds
            </div>
          )}
        </div>
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
          {mod?.status === "READY" && (
            <span className="text-green-600 text-sm font-medium">✓ Ready</span>
          )}
          {mod?.status === "FAILED" && (
            <span className="text-red-600 text-sm font-medium">✗ Failed</span>
          )}
        </div>
      </header>

      {/* Sticky Voice Bar */}
      {mod?.status === "READY" && (
        <StickyVoiceBar controller={voice} />
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {showSuccessBanner && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-green-800">Processing Complete!</h3>
              <p className="text-sm text-green-700 mt-1">
                Your video has been processed and is ready for training. You can now view the steps and start using the AI assistant.
              </p>
            </div>
            <button
              onClick={() => setShowSuccessBanner(false)}
              className="flex-shrink-0 text-green-400 hover:text-green-600"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
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
                No video
              </div>
            )}
          </div>

          {/* Steps */}
          {sortedSteps.length > 0 && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Training Steps</h3>
                {mod?.status === "READY" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAddStep()}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Step
                    </button>
                    <button
                      onClick={() => navigate(`/edit-steps/${moduleId}`)}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Full Edit
                    </button>
                  </div>
                )}
              </div>
                             {sortedSteps.map((s, i) => (
                 <div 
                   key={s.id ?? i} 
                   className="border rounded p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                   onClick={() => handleStepClick(s, i)}
                   onPointerDown={(e) => {
                     e.preventDefault();
                     // Start long-press timer (450ms)
                     const timer = setTimeout(() => {
                       voice.startWithPrefix(`Explain this step: ${s.text}. In one sentence,`);
                     }, 450);
                     const cleanup = () => clearTimeout(timer);
                     e.currentTarget.addEventListener('pointerup', cleanup, { once: true });
                     e.currentTarget.addEventListener('pointerleave', cleanup, { once: true });
                   }}
                   onPointerUp={(e) => {
                     // If we already started (long-press triggered), stop to send
                     if (voice.listening) voice.stop();
                   }}
                   title="Click to select, long-press to ask about this step"
                 >
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
                     {mod?.status === "READY" && (
                       <div className="flex items-center gap-1 ml-2">
                         <button
                           onClick={(e) => { e.stopPropagation(); handleEditStep(s, i); }}
                           className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors duration-200"
                           title="Edit step"
                         >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                           </svg>
                         </button>
                         <button
                           onClick={(e) => { e.stopPropagation(); handleAIRewrite(s, i); }}
                           className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-colors duration-200"
                           title="AI Rewrite step"
                         >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                           </svg>
                         </button>
                         <button
                           onClick={(e) => { e.stopPropagation(); handleDeleteStep(s, i); }}
                           className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors duration-200"
                           title="Delete step"
                         >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                           </svg>
                         </button>
                       </div>
                     )}
                   </div>
                 </div>
               ))}
            </div>
          )}
        </div>

        {/* Transcript / Assistant */}
        <aside className="space-y-4">
          {/* AI Assistant */}
          {mod?.status === "READY" && (
            <div className="bg-white border rounded p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">AI Assistant</h3>
              <AskBox moduleId={moduleId!} />
            </div>
          )}



          {/* Transcript */}
          <div className="bg-white border rounded p-4">
            <h3 className="text-lg font-semibold text-gray-900">Transcript</h3>
            {mod?.transcriptText ? (
              <div className="text-sm text-gray-800 whitespace-pre-wrap max-h-[60vh] overflow-auto mt-3">
                {mod.transcriptText}
              </div>
            ) : (
              <div className="text-sm text-gray-500 mt-3">
                No transcript was saved for this module.
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Collapsible Text QA at bottom */}
      {mod?.status === "READY" && (
        <section className="border rounded-md bg-white">
          <button
            onClick={() => setShowTextQA(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold text-gray-900">AI Assistant (Type instead)</span>
            <span className="text-sm text-gray-500">{showTextQA ? "Hide" : "Show"}</span>
          </button>
          {showTextQA && (
            <div className="px-4 pb-4 border-t">
              <AskBox moduleId={moduleId!} />
            </div>
          )}
        </section>
      )}

    </div>
  );
}