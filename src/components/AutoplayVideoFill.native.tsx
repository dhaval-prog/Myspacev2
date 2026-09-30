import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

interface AutoplayVideoFillProps {
  uri: string;
  /** A watch-time trim window (ms) — see the web sibling's own doc comment on this same prop pair
   * (MediaTrim in types/throw.ts). */
  trimStartMs?: number;
  trimEndMs?: number;
  /** Fires on expo-video's own `timeUpdate` event (see timeUpdateEventInterval below) with
   * playback position relative to the trim window — see the web sibling's own doc comment. */
  onTimeUpdate?: (currentMs: number, durationMs: number) => void;
}

/** A muted, looping, autoplaying video filling its parent — shared by StoryPreviewScreen (before
 * posting), ContactStoryStack (a posted status), and LetterFoldCard's own polaroid viewer (a
 * letter's video attachment), so all three render a story/attachment video identically instead of
 * three near-duplicate `useVideoPlayer`/`VideoView` copies drifting out of sync. */
export function AutoplayVideoFill({ uri, trimStartMs, trimEndMs, onTimeUpdate }: AutoplayVideoFillProps) {
  const startSec = (trimStartMs ?? 0) / 1000;
  const endSec = trimEndMs != null ? trimEndMs / 1000 : null;

  const player = useVideoPlayer(uri, (p) => {
    // Native loop only reaches the file's own true end — fine when untrimmed, but a trimmed clip
    // needs the loop-back to trimStartMs to happen *before* that, which the timeUpdate handler
    // below does instead; native loop is switched off in that case so the two don't fight each
    // other right at the boundary.
    p.loop = endSec == null;
    p.muted = true;
    if (startSec > 0) p.currentTime = startSec;
    p.timeUpdateEventInterval = 0.25;
    p.play();
  });

  useEffect(() => {
    if (endSec == null && !onTimeUpdate) return undefined;
    const sub = player.addListener('timeUpdate', ({ currentTime }) => {
      if (endSec != null && currentTime >= endSec) {
        player.currentTime = startSec;
      }
      if (onTimeUpdate) {
        const windowDurationMs = (endSec != null ? endSec - startSec : player.duration || 0) * 1000;
        onTimeUpdate(Math.max(0, (currentTime - startSec) * 1000), windowDurationMs);
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, endSec, startSec]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <VideoView player={player as any} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} pointerEvents="none" />;
}
