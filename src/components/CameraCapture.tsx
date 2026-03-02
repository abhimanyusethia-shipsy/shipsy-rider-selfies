"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  disabled?: boolean;
}

type CaptureStatus = "no_face" | "multiple_faces" | "align_face" | "ready";

export default function CameraCapture({ onCapture, disabled }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  const detectRafRef = useRef<number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>("no_face");
  const [error, setError] = useState("");
  const canCapture = captureStatus === "ready";

  useEffect(() => {
    let cancelled = false;

    const initDetector = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
        });

        if (cancelled) {
          detector.close();
          return;
        }

        detectorRef.current = detector;
      } catch {
        detectorRef.current = null;
      }
    };

    initDetector();

    return () => {
      cancelled = true;
      if (detectRafRef.current !== null) {
        cancelAnimationFrame(detectRafRef.current);
        detectRafRef.current = null;
      }
      detectorRef.current?.close();
      detectorRef.current = null;
    };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError("");
      setInitializing(true);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError(
          "Camera API is not available. Please make sure you are accessing this page via localhost or HTTPS."
        );
        setInitializing(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });

      streamRef.current = stream;

      // Video element is always in the DOM (hidden), so ref is always available
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      setCaptureStatus("no_face");
      setCameraActive(true);
    } catch (err: unknown) {
      const error = err as DOMException;
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setError(
          "Camera permission was denied. Please click the camera icon in your browser's address bar to allow access, then try again."
        );
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        setError("No camera found on this device. Please connect a camera and try again.");
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        setError(
          "Camera is in use by another application. Please close other apps using the camera and try again."
        );
      } else if (error.name === "OverconstrainedError") {
        setError("Camera does not meet requirements. Please try a different camera.");
      } else {
        setError(`Camera error: ${error.message || "Unknown error"}. Please try again.`);
      }
    } finally {
      setInitializing(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (detectRafRef.current !== null) {
      cancelAnimationFrame(detectRafRef.current);
      detectRafRef.current = null;
    }
    setCaptureStatus("no_face");
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (detectRafRef.current !== null) {
        cancelAnimationFrame(detectRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!cameraActive) {
      setCaptureStatus("no_face");
      return;
    }

    let cancelled = false;
    const detector = detectorRef.current;
    const video = videoRef.current;

    if (!detector || !video) return;

    const detect = () => {
      if (cancelled) return;

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        const result = detector.detectForVideo(video, performance.now());
        const faceCount = result.detections.length;

        if (faceCount === 0) {
          setCaptureStatus("no_face");
        } else if (faceCount > 1) {
          setCaptureStatus("multiple_faces");
        } else {
          const detection = result.detections[0];
          const box = detection.boundingBox;

          if (!box) {
            setCaptureStatus("align_face");
          } else {
            const guideWidth = video.videoWidth * 0.52;
            const guideHeight = video.videoHeight * 0.68;
            const guideX = (video.videoWidth - guideWidth) / 2;
            const guideY = (video.videoHeight - guideHeight) / 2;

            const faceX = box.originX;
            const faceY = box.originY;
            const faceWidth = box.width;
            const faceHeight = box.height;
            const faceArea = faceWidth * faceHeight;

            if (faceArea <= 0) {
              setCaptureStatus("align_face");
            } else {
              const overlapWidth = Math.max(
                0,
                Math.min(faceX + faceWidth, guideX + guideWidth) - Math.max(faceX, guideX)
              );
              const overlapHeight = Math.max(
                0,
                Math.min(faceY + faceHeight, guideY + guideHeight) - Math.max(faceY, guideY)
              );
              const overlapArea = overlapWidth * overlapHeight;
              const overlapRatio = overlapArea / faceArea;
              const mostlyInsideGuideBox = overlapRatio >= 0.85;

              setCaptureStatus(mostlyInsideGuideBox ? "ready" : "align_face");
            }
          }
        }
      }

      detectRafRef.current = requestAnimationFrame(detect);
    };

    detectRafRef.current = requestAnimationFrame(detect);

    return () => {
      cancelled = true;
      if (detectRafRef.current !== null) {
        cancelAnimationFrame(detectRafRef.current);
        detectRafRef.current = null;
      }
    };
  }, [cameraActive]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canCapture || !video || !canvas || video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror the image horizontally (selfie mode)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCaptured(URL.createObjectURL(blob));
          setCapturedBlob(blob);
          stopCamera();
        }
      },
      "image/jpeg",
      0.9
    );
  }, [canCapture, stopCamera]);

  const handleRetake = () => {
    if (captured) URL.revokeObjectURL(captured);
    setCaptured(null);
    setCapturedBlob(null);
    startCamera();
  };

  const handleSubmit = () => {
    if (capturedBlob) {
      onCapture(capturedBlob);
    }
  };

  const statusMessage: Record<CaptureStatus, string> = {
    no_face: "No face detected",
    multiple_faces: "Multiple faces detected",
    align_face: "Align your face inside the box",
    ready: "Face aligned - you can capture",
  };

  const statusTextColor: Record<CaptureStatus, string> = {
    no_face: "text-red-600",
    multiple_faces: "text-red-600",
    align_face: "text-amber-600",
    ready: "text-green-600",
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* The "open camera" button — shown when camera is off and no captured image */}
      {!cameraActive && !captured && (
        <button
          onClick={startCamera}
          disabled={disabled || initializing}
          className="w-full py-12 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors cursor-pointer disabled:opacity-50"
        >
          {initializing ? (
            <>
              <div className="flex justify-center mb-2">
                <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <div className="font-medium">Requesting camera access...</div>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-2">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              </div>
              <div className="font-medium">Click to open camera</div>
            </>
          )}
        </button>
      )}

      {/*
        Video element is ALWAYS in the DOM so the ref is available when startCamera runs.
        We toggle visibility with a class instead of conditional rendering.
      */}
      <div className={cameraActive ? "" : "hidden"}>
        <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: "640 / 480" }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover bg-black"
            style={{ transform: "scaleX(-1)" }}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={`w-[52%] h-[68%] rounded-[28px] border-2 ${
                canCapture ? "border-green-500" : "border-red-400"
              }`}
            />
          </div>
        </div>
        <p className={`mt-3 text-center text-sm font-medium ${statusTextColor[captureStatus]}`}>
          {statusMessage[captureStatus]}
        </p>
        <div className="flex justify-center mt-4">
          <button
            onClick={captureFrame}
            disabled={!canCapture}
            className={`w-16 h-16 bg-white border-4 rounded-full transition-colors flex items-center justify-center ${
              canCapture
                ? "border-gray-300 hover:border-blue-500 cursor-pointer"
                : "border-gray-200 opacity-50 cursor-not-allowed"
            }`}
            title="Capture photo"
          >
            <div className="w-12 h-12 bg-red-500 rounded-full"></div>
          </button>
        </div>
      </div>

      {captured && (
        <div>
          <img
            src={captured}
            alt="Captured"
            className="w-full rounded-xl"
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleRetake}
              disabled={disabled}
              className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              Retake
            </button>
            <button
              onClick={handleSubmit}
              disabled={disabled}
              className="flex-1 py-2.5 px-4 rounded-lg text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: "var(--color-navy)" }}
            >
              {disabled ? "Processing..." : "Upload"}
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
