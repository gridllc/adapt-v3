import React from "react";

type Status = "PENDING" | "PROCESSING" | "READY" | "ERROR";

interface Props {
  status: Status;
  progress?: number; // optional; show only if provided (0–100)
  message?: string;  // optional short note like “Transcribing audio…”
}

export const ProcessingBanner: React.FC<Props> = ({ status, progress, message }) => {
  if (status === "READY") return null;

  const label =
    status === "PENDING" ? "Queued"
    : status === "PROCESSING" ? "Processing"
    : status === "ERROR" ? "Error"
    : "Pending";

  return (
    <div className={`rounded-lg p-4 border ${
      status === "ERROR" ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{label}</span>
          {message && <span className="text-sm text-gray-600">• {message}</span>}
        </div>
        {typeof progress === "number" && progress >= 0 && progress <= 100 && (
          <span className="text-sm text-gray-700">{Math.round(progress)}%</span>
        )}
      </div>

      {typeof progress === "number" && progress >= 0 && progress <= 100 && (
        <div className="mt-2 h-2 w-full rounded bg-gray-200">
          <div
            className="h-2 rounded bg-gray-700 transition-all"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}

      {status === "ERROR" && (
        <p className="mt-2 text-sm text-red-700">
          Something went wrong. Try again from the upload page.
        </p>
      )}
    </div>
  );
};

export default ProcessingBanner;
