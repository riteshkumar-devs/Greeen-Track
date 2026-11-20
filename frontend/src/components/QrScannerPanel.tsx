import jsQR from 'jsqr';
import { Camera, CameraOff, QrCode, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface QrScannerPanelProps {
  onResolve: (qrToken: string) => Promise<void> | void;
  isResolving?: boolean;
  title?: string;
  description?: string;
  centered?: boolean;
}

export function extractQrToken(rawInput: string): string {
  const trimmed = rawInput.trim();
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const t = url.searchParams.get('t') || url.searchParams.get('token');
      if (t) return t.trim();
    }
  } catch {
    // fallback to raw token
  }
  return trimmed;
}

export function QrScannerPanel({
  onResolve,
  isResolving = false,
  title = 'Scan or enter bin QR token',
  description = 'Point the camera at the bin QR sticker or enter the opaque QR token below.',
  centered = false,
}: QrScannerPanelProps) {
  const [tokenInput, setTokenInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopCamera = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Browser camera API is unavailable in this context. Use manual QR code input below.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 60);

      const scanFrame = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !streamRef.current) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (code?.data) {
              const extracted = extractQrToken(code.data);
              setTokenInput(extracted);
              stopCamera();
              void onResolve(extracted);
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(scanFrame);
      };
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setCameraError('Camera permission denied or no camera detected. Use manual QR code input below.');
      stopCamera();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = extractQrToken(tokenInput);
    if (!cleaned) return;
    void onResolve(cleaned);
  };

  if (centered) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">{description}</p>
        </div>

        <div className="flex flex-col items-center justify-center space-y-4">
          {cameraActive ? (
            <div className="relative w-full max-w-sm overflow-hidden rounded-lg border border-slate-300 bg-slate-950">
              <video ref={videoRef} playsInline muted className="h-64 w-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-40 w-40 rounded-lg border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]" />
              </div>
            </div>
          ) : (
            <div className="flex h-44 w-full max-w-sm flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6">
              <QrCode className="mb-3 h-10 w-10 text-slate-400" aria-hidden="true" />
              <button
                type="button"
                onClick={() => void startCamera()}
                className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#065F46] whitespace-nowrap shrink-0"
              >
                <Camera className="h-4 w-4" />
                <span>Open QR scanner</span>
              </button>
            </div>
          )}

          {cameraActive && (
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <CameraOff className="h-4 w-4" />
              <span>Stop camera</span>
            </button>
          )}
        </div>

        {cameraError && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
            {cameraError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-md flex-col gap-2.5 border-t border-slate-100 pt-5 sm:flex-row">
          <input
            type="text"
            aria-label="QR code"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Enter QR code"
            minLength={20}
            required
            className="w-full flex-1 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-center font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-[#047857] focus:ring-2 focus:ring-emerald-600/20 focus:outline-none sm:text-left"
          />
          <button
            type="submit"
            disabled={isResolving || tokenInput.trim().length < 20}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Search className="h-3.5 w-3.5" />
            <span>{isResolving ? 'Checking…' : 'Submit code'}</span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <button
          type="button"
          onClick={cameraActive ? stopCamera : () => void startCamera()}
          className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            cameraActive
              ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              : 'bg-[#047857] text-white hover:bg-[#065F46]'
          }`}
        >
          {cameraActive ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          <span>{cameraActive ? 'Stop camera' : 'Open camera scanner'}</span>
        </button>
      </div>

      {cameraError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
          {cameraError}
        </div>
      )}

      {cameraActive && (
        <div className="relative overflow-hidden rounded-lg border border-slate-300 bg-slate-950">
          <video ref={videoRef} playsInline muted className="h-64 w-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-40 rounded-lg border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]" />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <QrCode className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Paste QR token or bin URL (min 20 chars)"
            minLength={20}
            required
            className="w-full rounded-md border border-slate-300 bg-white py-2 pr-3 pl-9 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-[#047857] focus:ring-2 focus:ring-emerald-600/20 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isResolving || tokenInput.trim().length < 20}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Search className="h-3.5 w-3.5" />
          <span>{isResolving ? 'Resolving…' : 'Resolve QR'}</span>
        </button>
      </form>
    </div>
  );
}
