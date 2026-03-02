"use client";

import { useState } from "react";
import CameraCapture from "@/components/CameraCapture";
import AIReasoningPanel from "@/components/AIReasoningPanel";
import StatusBadge from "@/components/StatusBadge";

interface SelfieResult {
  selfieUrl: string;
  aiStatus: "approved" | "rejected";
  aiFaceValid: boolean;
  aiRealPerson: boolean;
  aiFaceMatch: boolean;
  aiReasoning: string[];
}

export default function CapturePage() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<SelfieResult | null>(null);
  const [error, setError] = useState("");

  const handleCapture = async (blob: Blob) => {
    setUploading(true);
    setResult(null);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", blob, "selfie.jpg");

      const res = await fetch("/api/selfies", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      setResult(data);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">
      <h2 className="text-lg md:text-xl font-semibold text-gray-800">Capture Selfie</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase">
          Take a selfie
        </h3>
        <p className="text-sm text-gray-500">
          Position your face clearly in the camera frame and click capture.
          Make sure you have a valid profile picture uploaded before taking a selfie.
        </p>
        <CameraCapture onCapture={handleCapture} disabled={uploading} />

        {uploading && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 text-sm text-gray-500">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing selfie with AI...
            </div>
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-500 uppercase">
              Verification Result
            </h3>
            <StatusBadge status={result.aiStatus} />
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
            <img
              src={result.selfieUrl}
              alt="Selfie"
              className="w-28 h-28 sm:w-32 sm:h-32 object-cover rounded-xl"
            />
            <div className="flex-1 space-y-3 w-full">
              <div className="text-sm space-y-1.5">
                <div className="flex items-center gap-2">
                  {result.aiFaceValid ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  ) : (
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                  <span>Valid Face Detected</span>
                </div>
                <div className="flex items-center gap-2">
                  {result.aiRealPerson ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  ) : (
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                  <span>Real Person (not photo of photo)</span>
                </div>
                <div className="flex items-center gap-2">
                  {result.aiFaceMatch ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  ) : (
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                  <span>Matches Profile Picture</span>
                </div>
              </div>
              <AIReasoningPanel
                reasoning={result.aiReasoning}
                status={result.aiStatus}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
