import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiUrl } from "@/config/api";

type StepDto = {
  id?: string;
  order?: number;
  text?: string;
  startTime?: number; // seconds
  endTime?: number;   // seconds
  aiConfidence?: number | null;
  aliases?: string[];
  notes?: string;
};

type StepsResponse = { success: true; steps: StepDto[] } | { success: false; error: string };
type SaveResponse = { success: true; count: number } | { success: false; error: string };

// ✅ FIXED: Using canonical API helper from config/api.ts

// Improved time utilities with validation
const toSeconds = (v: string): number => {
  if (!v) return 0;
  
  // Handle raw seconds input
  if (/^\d+$/.test(v)) {
    const seconds = parseInt(v, 10);
    return Math.max(0, seconds);
  }
  
  // Handle mm:ss format
  const parts = v.split(":");
  if (parts.length === 2) {
    const [m, s] = parts.map(Number);
    if (Number.isFinite(m) && Number.isFinite(s) && m >= 0 && s >= 0 && s < 60) {
      return m * 60 + s;
    }
  }
  
  return 0;
};

const toClock = (sec?: number): string => {
  if (typeof sec !== "number" || isNaN(sec) || sec < 0) return "0:00";
  const mm = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
};

// Validation helper
const validateStep = (step: StepDto, index: number): string[] => {
  const errors: string[] = [];
  
  if (!step.text?.trim()) {
    errors.push(`Step ${index + 1}: Text is required`);
  }
  
  if (typeof step.startTime !== "number" || step.startTime < 0) {
    errors.push(`Step ${index + 1}: Invalid start time`);
  }
  
  if (typeof step.endTime !== "number" || step.endTime < 0) {
    errors.push(`Step ${index + 1}: Invalid end time`);
  }
  
  if (step.startTime !== undefined && step.endTime !== undefined && step.endTime <= step.startTime) {
    errors.push(`Step ${index + 1}: End time must be after start time`);
  }
  
  return errors;
};

export default function EditStepsPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [steps, setSteps] = useState<StepDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const ordered = useMemo(() => {
    return [...steps].sort((a, b) => (a.order ?? a.startTime ?? 0) - (b.order ?? b.startTime ?? 0));
  }, [steps]);

  // Load steps on mount
  useEffect(() => {
    if (!moduleId) return;
    
    const loadSteps = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(apiUrl(`/api/steps/${moduleId}`), { 
          credentials: "include" 
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data: StepsResponse = await response.json();
        
        if (!data.success) {
          throw new Error("error" in data ? data.error : "Failed to load steps");
        }
        
        setSteps(data.steps || []);
      } catch (e: any) {
        console.error("Failed to load steps:", e);
        setError(e?.message || "Failed to load steps");
      } finally {
        setLoading(false);
      }
    };

    loadSteps();
  }, [moduleId]);

  // Validate steps whenever they change
  useEffect(() => {
    const errors: string[] = [];
    ordered.forEach((step, index) => {
      errors.push(...validateStep(step, index));
    });
    setValidationErrors(errors);
  }, [ordered]);

  const updateStep = (idx: number, patch: Partial<StepDto>) => {
    setSteps((arr) => {
      const next = [...arr];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const addStep = () => {
    const newStep: StepDto = {
      text: "",
      order: steps.length,
      startTime: 0,
      endTime: 30, // Default 30 second duration
      aliases: [],
      notes: "",
    };
    setSteps((arr) => [...arr, newStep]);
  };

  const removeStep = (idx: number) => {
    if (confirm("Are you sure you want to delete this step?")) {
      setSteps((arr) => arr.filter((_, i) => i !== idx));
    }
  };

  const reorderByTime = () => {
    setSteps((arr) => {
      const sorted = [...arr].sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));
      return sorted.map((step, index) => ({ ...step, order: index }));
    });
  };

  const saveAll = async () => {
    if (!moduleId) return;
    
    // Validate before saving
    const errors: string[] = [];
    ordered.forEach((step, index) => {
      errors.push(...validateStep(step, index));
    });
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      setError("Please fix validation errors before saving");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setValidationErrors([]);

      // Prepare payload with proper validation
      const payload = ordered.map((step, index) => ({
        id: step.id,
        order: index,
        text: step.text?.trim() || "",
        startTime: Math.max(0, step.startTime ?? 0),
        endTime: Math.max(1, step.endTime ?? 1),
        aliases: (step.aliases ?? [])
          .map((a) => String(a).trim())
          .filter(Boolean),
        notes: step.notes?.trim() || "",
      }));

              const response = await fetch(apiUrl(`/api/steps/${moduleId}`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: payload }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SaveResponse = await response.json();
      
      if (!data.success) {
        throw new Error("error" in data ? data.error : "Failed to save steps");
      }

      // Show success and redirect
      navigate(`/training/${moduleId}`, { 
        state: { message: `Successfully saved ${data.count} steps` }
      });
      
    } catch (e: any) {
      console.error("Save failed:", e);
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!moduleId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-red-600 text-center">Missing module ID</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading steps...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Edit Training Steps</h1>
          <p className="text-sm text-gray-500 mt-1">Module: {moduleId}</p>
        </div>
        <div className="flex gap-3">
          <button
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            onClick={() => navigate(`/training/${moduleId}`)}
          >
            ← Back to Training
          </button>
          <button
            disabled={saving || validationErrors.length > 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={saveAll}
          >
            {saving ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Error: {error}</span>
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800 mb-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Please fix the following issues:</span>
          </div>
          <ul className="text-sm text-yellow-700 space-y-1">
            {validationErrors.map((err, idx) => (
              <li key={idx}>• {err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          onClick={addStep}
        >
          + Add Step
        </button>
        <button
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          onClick={reorderByTime}
        >
          Auto-order by Time
        </button>
        <span className="text-sm text-gray-500">
          {steps.length} step{steps.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Steps List */}
      <div className="space-y-4">
        {ordered.map((step, idx) => (
          <div key={step.id ?? `new-${idx}`} className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
            {/* Step Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                  {idx + 1}
                </div>
                <div className="text-sm text-gray-500">
                  {step.id ? `ID: ${step.id}` : "New step"}
                </div>
              </div>
              <button
                className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors"
                onClick={() => removeStep(idx)}
                title="Delete step"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {/* Step Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Step Text */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Step Description *
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Describe what the user should do in this step..."
                  value={step.text ?? ""}
                  onChange={(e) => updateStep(idx, { text: e.target.value })}
                  required
                />
              </div>

              {/* Time Fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time (mm:ss) *
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0:00"
                  value={toClock(step.startTime)}
                  onChange={(e) => updateStep(idx, { startTime: toSeconds(e.target.value) })}
                  pattern="[0-9]*:?[0-5]?[0-9]"
                  title="Format: mm:ss or seconds"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Time (mm:ss) *
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0:30"
                  value={toClock(step.endTime)}
                  onChange={(e) => updateStep(idx, { endTime: toSeconds(e.target.value) })}
                  pattern="[0-9]*:?[0-5]?[0-9]"
                  title="Format: mm:ss or seconds"
                />
              </div>

              {/* Aliases */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alternative Names (comma-separated)
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., POS, register, card reader"
                  value={(step.aliases ?? []).join(", ")}
                  onChange={(e) =>
                    updateStep(idx, {
                      aliases: e.target.value
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  These help the AI understand what users might call this step
                </p>
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Context & Tips
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Add helpful context, gotchas, brand specifics, or tips for better AI responses..."
                  value={step.notes ?? ""}
                  onChange={(e) => updateStep(idx, { notes: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This information helps the AI provide better, more contextual answers
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <button
            className="text-blue-600 hover:text-blue-800 hover:underline"
            onClick={() => navigate(`/training/${moduleId}`)}
          >
            ← Back to Training
          </button>
          <div className="text-sm text-gray-500">
            {validationErrors.length > 0 && (
              <span className="text-yellow-600">
                {validationErrors.length} validation error{validationErrors.length !== 1 ? 's' : ''} to fix
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}