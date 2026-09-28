import React, { useCallback, useEffect, useRef, useState } from 'react';

const webVideoStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };

function pickSupportedVideoMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const type of ['video/mp4', 'video/webm;codecs=vp9', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

export interface StatusCameraApi {
  renderPreview: () => React.ReactNode;
  facingIsUser: boolean;
  flip: () => void;
  /** Permission was actually denied (as opposed to just not warmed up yet) — MyStatusPanel falls
   * back to a sample image + "Camera blocked" chip, matching the interaction spec's own fallback. */
  denied: boolean;
  live: boolean;
  warm: () => void;
  cool: () => void;
  takePhoto: () => Promise<string | null>;
  startRecording: () => void;
  stopRecording: () => Promise<{ uri: string; durationMs: number } | null>;
  canRecordVideo: boolean;
}

/**
 * Web half of the status camera — expo-camera's `CameraView.web` only implements `takePicture`,
 * with no video recording at all (confirmed directly in its source, same reasoning the old
 * StoryCaptureScreen.web.tsx already documented), so this drives `getUserMedia` + `MediaRecorder`
 * directly instead: a live `<video>` preview, and a canvas grab for the photo. `MediaRecorder`
 * support (and which codec) varies across mobile browsers — `canRecordVideo` reflects that so the
 * caller can simply disable the hold-to-record affordance rather than recording into a codec that
 * can't be played back; a video is still always postable via the gallery picker either way.
 */
export function useStatusCamera(): StatusCameraApi {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const videoMimeRef = useRef<string | null>(null);
  const recordStartRef = useRef(0);
  const warmingRef = useRef(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [denied, setDenied] = useState(false);
  const [live, setLive] = useState(false);

  if (videoMimeRef.current === null) videoMimeRef.current = pickSupportedVideoMimeType();

  const warm = useCallback(() => {
    if (warmingRef.current || streamRef.current) return;
    warmingRef.current = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: videoMimeRef.current !== null });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setLive(true);
        setDenied(false);
      } catch {
        setDenied(true);
      } finally {
        warmingRef.current = false;
      }
    })();
  }, [facingMode]);

  const cool = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  }, []);

  useEffect(() => () => cool(), [cool]);

  // Re-warms on a facing flip only if the camera was already live — otherwise the flip button is
  // inert (isn't shown) while off/denied anyway.
  const isFirstFacingRender = useRef(true);
  useEffect(() => {
    if (isFirstFacingRender.current) {
      isFirstFacingRender.current = false;
      return;
    }
    if (!live) return;
    cool();
    warm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const flip = () => setFacingMode((f) => (f === 'user' ? 'environment' : 'user'));

  const takePhoto = useCallback((): Promise<string | null> => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return Promise.resolve(null);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    // Mirrors the *saved* frame too when shooting with the front camera, matching what the user
    // actually saw in the (mirrored) preview — the interaction spec's own reference does the same.
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), 'image/jpeg', 0.88);
    });
  }, [facingMode]);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    const mimeType = videoMimeRef.current;
    if (!stream || !mimeType) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    recordStartRef.current = performance.now();
    recorder.start();
  }, []);

  const stopRecording = useCallback((): Promise<{ uri: string; durationMs: number } | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (!recorder) {
        resolve(null);
        return;
      }
      const mimeType = videoMimeRef.current || 'video/webm';
      recorder.onstop = () => {
        const durationMs = performance.now() - recordStartRef.current;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        resolve({ uri: URL.createObjectURL(blob), durationMs });
      };
      recorder.stop();
    });
  }, []);

  const renderPreview = () =>
    // eslint-disable-next-line jsx-a11y/media-has-caption
    React.createElement('video', {
      ref: videoRef,
      autoPlay: true,
      playsInline: true,
      muted: true,
      style: { ...webVideoStyle, transform: facingMode === 'user' ? 'scaleX(-1)' : undefined },
    });

  return {
    renderPreview,
    facingIsUser: facingMode === 'user',
    flip,
    denied,
    live,
    warm,
    cool,
    takePhoto,
    startRecording,
    stopRecording,
    canRecordVideo: videoMimeRef.current !== null,
  };
}
