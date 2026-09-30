"use client";

import { useEffect, useRef, useState } from "react";
import jsQR, { type QRCode } from "jsqr";
import { Camera, CameraOff, Loader2, X } from "lucide-react";
import { getFriendlyError } from "@/lib/errorMessages";
import { useLanguage } from "@/context/LanguageContext";

interface QRScannerProps {
  onDetect: (certId: string) => void;
  onClose?: () => void;
  onUseFileUpload?: () => void;
}

function extractCertId(payload: string) {
  const trimmed = payload.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const verifyMatch = url.pathname.match(/\/verify\/([^/?#]+)/i);
    if (verifyMatch?.[1]) {
      return decodeURIComponent(verifyMatch[1]);
    }
    return null;
  } catch {
    const verifyMatch = trimmed.match(/\/verify\/([^/?#]+)/i);
    if (verifyMatch?.[1]) return decodeURIComponent(verifyMatch[1]);
    return trimmed;
  }
}

function drawBoundingBox(
  canvas: HTMLCanvasElement,
  location: QRCode["location"]
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue("--green").trim() || "#00d68f";
  ctx.lineWidth = 3;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.moveTo(location.topLeftCorner.x, location.topLeftCorner.y);
  ctx.lineTo(location.topRightCorner.x, location.topRightCorner.y);
  ctx.lineTo(location.bottomRightCorner.x, location.bottomRightCorner.y);
  ctx.lineTo(location.bottomLeftCorner.x, location.bottomLeftCorner.y);
  ctx.closePath();
  ctx.stroke();
}

export default function QRScanner({ onDetect, onClose, onUseFileUpload }: QRScannerProps) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameReqRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stopStream = () => {
      if (frameReqRef.current) cancelAnimationFrame(frameReqRef.current);
      frameReqRef.current = null;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const video = videoRef.current;
      if (video) {
        video.pause();
        video.srcObject = null;
      }
    };

    const scanFrame = () => {
      const video = videoRef.current;
      const frameCanvas = frameCanvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      if (!video || !frameCanvas || !overlayCanvas) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const width = video.videoWidth;
        const height = video.videoHeight;

        if (width > 0 && height > 0) {
          frameCanvas.width = width;
          frameCanvas.height = height;
          overlayCanvas.width = width;
          overlayCanvas.height = height;

          const frameCtx = frameCanvas.getContext("2d", {
            willReadFrequently: true,
          });
          const overlayCtx = overlayCanvas.getContext("2d");
          if (frameCtx && overlayCtx) {
            frameCtx.drawImage(video, 0, 0, width, height);
            const imageData = frameCtx.getImageData(0, 0, width, height);
            const qr = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "attemptBoth",
            });

            overlayCtx.clearRect(0, 0, width, height);

            if (qr?.data) {
              drawBoundingBox(overlayCanvas, qr.location);
              if (!doneRef.current) {
                doneRef.current = true;
                const certId = extractCertId(qr.data);
                stopStream();
                if (certId) onDetect(certId);
                else setError(t("qr.parseError"));
                return;
              }
            } else {
              overlayCtx.strokeStyle = getComputedStyle(overlayCanvas).getPropertyValue("--teal").trim() || "#00e5ff";
              overlayCtx.globalAlpha = 0.68;
              overlayCtx.lineWidth = 2;
              const boxSize = Math.min(width, height) * 0.56;
              const x = (width - boxSize) / 2;
              const y = (height - boxSize) / 2;
              overlayCtx.strokeRect(x, y, boxSize, boxSize);
              overlayCtx.globalAlpha = 1;
            }
          }
        }
      }

      frameReqRef.current = requestAnimationFrame(scanFrame);
    };

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t("qr.unsupported"));
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
          },
          audio: false,
        });

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await new Promise<void>((resolve, reject) => {
          const onLoadedMetadata = () => resolve();
          const onVideoError = () => reject(new Error(t("qr.videoError")));
          video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
          video.addEventListener("error", onVideoError, { once: true });
        });
        await video.play();
        setReady(true);
        frameReqRef.current = requestAnimationFrame(scanFrame);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setError(t("qr.permissionDenied"));
        } else {
          setError(
            getFriendlyError(
              err,
              t("qr.accessFailed")
            )
          );
        }
      }
    };

    void startCamera();

    return () => stopStream();
  }, [onDetect, t]);

  return (
    <div className="glass-floating p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
          <Camera size={15} />
          {t("qr.title")}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-interactive)] text-[var(--text-primary)]"
            aria-label={t("qr.close")}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-[rgba(255,77,109,0.3)] bg-[var(--red-glow)] px-4 py-6 text-center" role="alert">
          <CameraOff className="mx-auto mb-2 text-[var(--accent-red)]" size={30} />
          <p className="text-sm text-[var(--accent-red)]">{error}</p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-black">
          <video
            ref={videoRef}
            className="aspect-[4/5] w-full object-cover sm:aspect-video"
            playsInline
            muted
            autoPlay
          />
          <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full" />
          <canvas ref={frameCanvasRef} className="hidden" />

          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45" role="status" aria-live="polite">
              <div className="inline-flex items-center gap-2 text-sm text-white">
                <Loader2 size={16} className="animate-spin" />
                {t("qr.starting")}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[var(--text-muted)]">
          {t("qr.help")}
        </p>
        <button
          type="button"
          onClick={onUseFileUpload}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--teal-border)] px-3 font-semibold text-[var(--teal)] transition-colors duration-150 hover:bg-[var(--teal-glow)] sm:min-h-0 sm:border-0 sm:p-0 sm:hover:bg-transparent sm:hover:underline"
        >
          {t("qr.useUpload")}
        </button>
      </div>
    </div>
  );
}
