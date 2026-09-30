import React, { useEffect, useRef } from 'react';

// expo-video's web `VideoView` only reliably shows a moving picture for some sources — recorded
// `blob:` URIs (a just-recorded story, see StoryCaptureScreen.web's MediaRecorder output) and even
// plain uploaded `https:` ones would render frozen on their first frame instead of actually
// playing, in both the pre-post preview and the posted story/letter viewer. A plain HTML `<video>`
// element with the autoplay attributes set directly (rather than calling `.play()` from JS after
// the element mounts, which is what the shared expo-video path effectively does) is the standard,
// battle-tested way to get Safari/Chrome to actually autoplay-and-loop a muted video — the same
// raw-DOM-element approach StoryCaptureScreen.web already uses for its own live camera preview.
const style: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  pointerEvents: 'none',
};

interface AutoplayVideoFillProps {
  uri: string;
  /** A watch-time trim window (ms) — nothing in the underlying file is re-encoded, so this just
   * seeks to trimStartMs on load and loops back there instead of the file's own start/end once
   * playback reaches trimEndMs (see MediaTrim's own doc comment in types/throw.ts). Omit both for
   * an untrimmed video (plays/loops the whole file, same as before this prop existed). */
  trimStartMs?: number;
  trimEndMs?: number;
  /** Fires on the browser's own `timeupdate` cadence (a few times a second) with playback position
   * relative to the trim window — 0 at trimStartMs, resetting every loop — so a caller can render
   * its own "0:07 / 0:15" while-viewing guide without needing to reach into the video element
   * itself. `durationMs` is the trimmed window's own length when trimmed, otherwise the file's
   * real duration. */
  onTimeUpdate?: (currentMs: number, durationMs: number) => void;
}

export function AutoplayVideoFill({ uri, trimStartMs, trimEndMs, onTimeUpdate }: AutoplayVideoFillProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const startSec = (trimStartMs ?? 0) / 1000;
    const endSec = trimEndMs != null ? trimEndMs / 1000 : null;
    let seededStart = false;

    const seedStart = () => {
      if (seededStart || startSec <= 0) return;
      video.currentTime = startSec;
      seededStart = true;
    };
    // `loadedmetadata` fires once duration/seek support is actually ready — setting currentTime
    // any earlier than that is a silent no-op in most browsers.
    video.addEventListener('loadedmetadata', seedStart);
    // Already loaded by the time this effect runs (uri unchanged, just trim props updating).
    if (video.readyState >= 1) seedStart();

    const onNativeTimeUpdate = () => {
      if (endSec != null && video.currentTime >= endSec) {
        video.currentTime = startSec;
      }
      if (onTimeUpdate) {
        const windowDurationMs = endSec != null ? (endSec - startSec) * 1000 : (video.duration || 0) * 1000;
        onTimeUpdate(Math.max(0, (video.currentTime - startSec) * 1000), windowDurationMs);
      }
    };
    video.addEventListener('timeupdate', onNativeTimeUpdate);

    return () => {
      video.removeEventListener('loadedmetadata', seedStart);
      video.removeEventListener('timeupdate', onNativeTimeUpdate);
    };
  }, [uri, trimStartMs, trimEndMs, onTimeUpdate]);

  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <video ref={videoRef} src={uri} autoPlay loop muted playsInline style={style} />;
}
