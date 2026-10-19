import { useEffect, useRef } from 'react';

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

// Not in the DOM typings yet.
type FocusCapabilities = MediaTrackCapabilities & { focusMode?: string[]; zoom?: { min: number; max: number } };

async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  if (Native) return new Native({ formats: ['ean_13'] });
  const { BarcodeDetector } = await import('barcode-detector/ponyfill');
  return new BarcodeDetector({ formats: ['ean_13'] });
}

function focusConstraints(track: MediaStreamTrack, focusMode: string) {
  const caps = (track.getCapabilities?.() ?? {}) as FocusCapabilities;
  const advanced: Record<string, unknown> = {};
  if (caps.focusMode?.includes(focusMode)) advanced.focusMode = focusMode;
  // Phone cameras can't focus closer than ~10-20 cm. A 2x zoom lets people hold the book
  // at a distance the lens can focus on while the barcode still fills the frame.
  if (caps.zoom) advanced.zoom = Math.min(Math.max(2, caps.zoom.min), caps.zoom.max);
  return { advanced: [advanced] } as MediaTrackConstraints;
}

/**
 * Web version of the scanner camera. expo-camera's web camera opens the browser's default
 * 640x480 stream without continuous focus, which is too blurry for book barcodes,
 * so we open a high-resolution stream ourselves. Tap the preview to refocus.
 */
export function IsbnCamera({ onBarcode }: { onBarcode: (data: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<MediaStreamTrack>(null);
  const onBarcodeRef = useRef(onBarcode);
  onBarcodeRef.current = onBarcode;

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function start() {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (stopped || !video.current) return stream.getTracks().forEach((t) => t.stop());
      track.current = stream.getVideoTracks()[0];
      await track.current.applyConstraints(focusConstraints(track.current, 'continuous')).catch(() => {});
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});

      const detector = await createDetector();
      const scan = async () => {
        if (stopped) return;
        const v = video.current;
        if (v && v.readyState >= 2) {
          const codes = await detector.detect(v).catch(() => []);
          codes.forEach((c) => onBarcodeRef.current(c.rawValue));
        }
        timer = setTimeout(scan, 200);
      };
      scan();
    }

    start().catch((e) => console.warn('Camera failed to start', e));
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function refocus() {
    const t = track.current;
    if (!t) return;
    t.applyConstraints(focusConstraints(t, 'single-shot'))
      .then(() => t.applyConstraints(focusConstraints(t, 'continuous')))
      .catch(() => {});
  }

  return (
    <video
      ref={video}
      onClick={refocus}
      playsInline
      muted
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}
