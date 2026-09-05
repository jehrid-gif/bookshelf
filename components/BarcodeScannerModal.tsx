"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { normalizeIsbn } from "@/lib/isbn";

type ScanState = "starting" | "scanning" | "unsupported" | "denied" | "error";

// Live camera barcode scanning via the browser's native BarcodeDetector API
// (Chrome/Edge/Samsung Internet on Android and desktop). Browsers without it
// — notably iOS Safari — still get the camera preview (handy for reading the
// tiny print by eye) plus a manual ISBN field that always works everywhere,
// so the feature degrades gracefully rather than being Android-only.
export default function BarcodeScannerModal({
  onDetected,
  onClose,
}: {
  onDetected: (isbn: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectedRef = useRef(false);

  const [state, setState] = useState<ScanState>("starting");
  const [hasStream, setHasStream] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setState("unsupported");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setHasStream(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const DetectorCtor: any = (window as any).BarcodeDetector;
        if (!DetectorCtor) {
          // No native decoder in this browser — leave the preview running
          // and fall back to the manual field below.
          setState("unsupported");
          return;
        }

        const detector = new DetectorCtor({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
        });
        setState("scanning");

        const tick = async () => {
          if (cancelled || detectedRef.current) return;
          try {
            const video = videoRef.current;
            if (video && video.readyState >= 2) {
              const codes = await detector.detect(video);
              if (codes.length > 0) {
                const isbn = normalizeIsbn(codes[0].rawValue || "");
                // Book barcodes are ISBN-13s (Bookland EAN, prefix 978/979);
                // ignore anything shorter or clearly not a book identifier
                // that might drift through the frame.
                const looksLikeIsbn =
                  isbn.length === 13
                    ? isbn.startsWith("978") || isbn.startsWith("979")
                    : isbn.length === 10;
                if (looksLikeIsbn) {
                  detectedRef.current = true;
                  onDetected(isbn);
                  return;
                }
              }
            }
          } catch {
            // Transient per-frame decode error — just keep trying.
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err: any) {
        if (!cancelled) setState(err?.name === "NotAllowedError" ? "denied" : "error");
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const isbn = normalizeIsbn(manualIsbn);
    if (isbn.length < 8) return;
    onDetected(isbn);
  }

  return (
    <Modal title="📷 Scan Barcode" onClose={onClose}>
      <div className="space-y-4">
        {hasStream && (
          <div className="relative rounded-md overflow-hidden bg-stone-900 aspect-[4/3]">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {state === "scanning" && (
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-16 border-2 border-brass/80 rounded-md pointer-events-none" />
            )}
          </div>
        )}

        {state === "starting" && (
          <p className="text-sm text-stone-500">Starting camera…</p>
        )}
        {state === "scanning" && (
          <p className="text-sm text-stone-500">
            Point the camera at the barcode on the back of the book.
          </p>
        )}
        {state === "unsupported" && (
          <p className="text-sm text-stone-500">
            Live barcode scanning isn't supported in this browser — type the ISBN
            from the barcode below instead.
          </p>
        )}
        {state === "denied" && (
          <p className="text-sm text-stone-500">
            Camera access was denied — you can still type the ISBN from the barcode
            below.
          </p>
        )}
        {state === "error" && (
          <p className="text-sm text-stone-500">
            Couldn't access the camera — you can still type the ISBN from the barcode
            below.
          </p>
        )}

        <form onSubmit={submitManual} className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            className="input"
            placeholder="Or type the ISBN…"
            value={manualIsbn}
            onChange={(e) => setManualIsbn(e.target.value)}
          />
          <button type="submit" className="btn btn-primary flex-none">
            Look Up
          </button>
        </form>
      </div>
    </Modal>
  );
}
