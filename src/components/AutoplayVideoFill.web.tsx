import React, { useEffect, useLayoutEffect, useRef } from 'react';

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
  /** Caller-controlled sound, default false (unmuted) — a video letter/status is opened via a
   * direct tap, which is real user activation, so starting it with sound already on is allowed by
   * every major browser's autoplay policy; the caller renders its own speaker-icon toggle and
   * flips this. */
  muted?: boolean;
  /** Fires once if the browser refused unmuted playback anyway (autoplay policy edge case, e.g. no
   * activation reached this render for some reason) — this component falls back to muted so
   * playback never silently stalls, and the caller uses this to flip its own toggle to match so
   * the speaker icon doesn't lie about the actual state. */
  onAutoplayBlocked?: () => void;
}

export function AutoplayVideoFill({ uri, trimStartMs, trimEndMs, onTimeUpdate, muted = false, onAutoplayBlocked }: AutoplayVideoFillProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const startSec = (trimStartMs ?? 0) / 1000;
    const endSec = trimEndMs != null ? trimEndMs / 1000 : null;
    let seededStart = false;
    let cancelled = false;

    const seedStart = () => {
      if (seededStart || startSec <= 0) return;
      video.currentTime = startSec;
      seededStart = true;
    };

    // A video recorded via MediaRecorder (see StoryCaptureScreen.web's own comment on the same
    // bug) is written without a real Segment Duration in its container header — every browser
    // reports `duration: Infinity` for a file like that and, worse, keeps showing a solid black
    // frame instead of the real picture until the file's been seeked at least once. Forcing one
    // real seek (to effectively the end, then wherever playback should actually start) makes the
    // browser fully index the file, which fixes both the bogus Infinity duration (needed for the
    // while-viewing clock below) and the black-frame rendering in one shot. A normally-muxed file
    // (anything not fresh off MediaRecorder) already reports a finite duration and just skips this.
    const fixDurationThenSeed = () => {
      if (Number.isFinite(video.duration)) {
        seedStart();
        return;
      }
      const onFixed = () => {
        video.removeEventListener('timeupdate', onFixed);
        if (cancelled) return;
        seededStart = false;
        seedStart();
      };
      video.addEventListener('timeupdate', onFixed);
      video.currentTime = 1e10;
    };
    // `loadedmetadata` fires once duration/seek support is actually ready — setting currentTime
    // any earlier than that is a silent no-op in most browsers.
    video.addEventListener('loadedmetadata', fixDurationThenSeed);
    // Already loaded by the time this effect runs (uri unchanged, just trim props updating).
    if (video.readyState >= 1) fixDurationThenSeed();

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
      cancelled = true;
      video.removeEventListener('loadedmetadata', fixDurationThenSeed);
      video.removeEventListener('timeupdate', onNativeTimeUpdate);
    };
  }, [uri, trimStartMs, trimEndMs, onTimeUpdate]);

  // Calling `.play()` ourselves (rather than only relying on the `autoplay` HTML attribute) is
  // what lets an unmuted video actually start with sound — the `autoplay` attribute alone is
  // muted-only under every major browser's policy, but a script-issued `.play()` is allowed as
  // long as it's still within the user gesture that opened this viewer. `useLayoutEffect` (not
  // `useEffect`) keeps this as close to that tap as React allows — Safari's activation window is
  // strict enough that the extra tick `useEffect` defers to can be the difference between sound
  // actually starting and silently getting blocked. Falls back to muted playback rather than
  // leaving the video frozen if the browser refuses anyway.
  useLayoutEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    const playResult = video.play();
    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(() => {
        if (!muted) {
          video.muted = true;
          onAutoplayBlocked?.();
          video.play().catch(() => {});
        }
      });
    }
  }, [uri, muted, onAutoplayBlocked]);

  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <video ref={videoRef} src={uri} loop playsInline style={style} />;
}
