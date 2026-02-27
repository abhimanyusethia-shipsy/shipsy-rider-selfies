"use client";

import { useState, useEffect, useRef } from "react";
import CameraCapture from "@/components/CameraCapture";
import ImageViewer from "@/components/ImageViewer";
import AIReasoningPanel from "@/components/AIReasoningPanel";

interface ProfileData {
  exists: boolean;
  imageUrl?: string;
  aiValid?: boolean;
  aiReasoning?: string[];
  uploadedAt?: string;
}

interface UploadResult {
  imageUrl: string;
  aiValid: boolean;
  faceDetected: boolean;
  realPerson: boolean;
  aiReasoning: string[];
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<"camera" | "file">("camera");
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile-picture");
      const data = await res.json();
      setProfile(data);
    } catch {
      console.error("Failed to fetch profile");
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (blob: Blob) => {
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("image", blob, "profile.jpg");

      const res = await fetch("/api/profile-picture", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Upload failed");
        return;
      }

      setUploadResult(data);
      fetchProfile();
    } catch {
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadImage(file);
  };

  const handleCameraCapture = (blob: Blob) => {
    uploadImage(blob);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Profile Picture</h2>

      {/* Current Profile Picture */}
      {profile?.exists && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase">
            Current Profile Picture
          </h3>
          <div className="flex items-start gap-6">
            <img
              src={profile.imageUrl}
              alt="Profile"
              className="w-40 h-40 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setViewerImage(profile.imageUrl!)}
            />
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                    profile.aiValid
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {profile.aiValid ? "✓ Valid" : "✕ Invalid"}
                </span>
              </div>
              {profile.aiReasoning && profile.aiReasoning.length > 0 && (
                <AIReasoningPanel
                  reasoning={profile.aiReasoning}
                  status={profile.aiValid ? "approved" : "rejected"}
                />
              )}
              <p className="text-xs text-gray-400">
                Uploaded: {profile.uploadedAt}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload New */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase">
          {profile?.exists ? "Update Profile Picture" : "Upload Profile Picture"}
        </h3>

        {/* Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode("camera")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              mode === "camera"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <svg className="w-4 h-4 inline-block" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
            Camera
          </button>
          <button
            onClick={() => setMode("file")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              mode === "file"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <svg className="w-4 h-4 inline-block" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            Upload File
          </button>
        </div>

        {mode === "camera" ? (
          <CameraCapture onCapture={handleCameraCapture} disabled={uploading} />
        ) : (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full py-12 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              <div className="flex justify-center mb-2">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
              </div>
              <div className="font-medium">
                {uploading ? "Uploading..." : "Click to select an image"}
              </div>
            </button>
          </div>
        )}

        {uploading && (
          <div className="text-center py-4 text-sm text-gray-500">
            Uploading and analyzing with AI...
          </div>
        )}
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase">
            Upload Result
          </h3>
          <div className="flex items-start gap-6">
            <img
              src={uploadResult.imageUrl}
              alt="Uploaded"
              className="w-32 h-32 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setViewerImage(uploadResult.imageUrl)}
            />
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                    uploadResult.aiValid
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {uploadResult.aiValid ? "✓ Valid Profile Photo" : "✕ Invalid Profile Photo"}
                </span>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  {uploadResult.faceDetected ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  ) : (
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                  <span>Face Detected</span>
                </div>
                <div className="flex items-center gap-2">
                  {uploadResult.realPerson ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  ) : (
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                  <span>Real Person</span>
                </div>
              </div>
              <AIReasoningPanel
                reasoning={uploadResult.aiReasoning}
                status={uploadResult.aiValid ? "approved" : "rejected"}
              />
            </div>
          </div>
        </div>
      )}

      {viewerImage && (
        <ImageViewer
          src={viewerImage}
          alt="Profile Picture"
          onClose={() => setViewerImage(null)}
        />
      )}
    </div>
  );
}
