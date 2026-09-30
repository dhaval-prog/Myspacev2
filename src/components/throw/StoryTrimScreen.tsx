import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Icon } from '../Icon';
import { throwColor, throwFont } from '../../theme/throwTokens';

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
const MAX_CLIP_MS = 15000;
// A clip has to be long enough to actually read as a video rather than a jump-cut sliver — chosen
// well under any duration this screen ever sees (it only shows for a video already confirmed over
// the 15s cap), so it never fights the video's own real length.
const MIN_CLIP_MS = 2000;
const TIMELINE_HEIGHT = 44;
const HANDLE_HIT_WIDTH = 28;
const HANDLE_VISUAL_WIDTH = 5;

interface StoryTrimScreenProps {
  localUri: string;
  /** The library-picked asset's own reported duration — used directly for the timeline's layout
   * math rather than waiting on the video player to finish loading its own metadata first. */
  durationMs: number;
  onCancel: () => void;
  onConfirm: (trim: { startMs: number; endMs: number }) => void;
}

/**
 * Shown only for a library-picked video over the 15s cap — lets the user drag either edge of the
 * highlighted window to choose any clip from MIN_CLIP_MS up to the full 15s cap (or drag the
 * middle to move a same-length window elsewhere), with the video itself playing that exact window
 * live on loop the whole time so the preview above always shows exactly what dragging just did.
 * Nothing is physically re-encoded here (no ffmpeg/native trim module in this project): the
 * confirmed start/end just ride along as the story's own trim_start_ms/trim_end_ms, and the story
 * viewer is what actually enforces them at playback time (seeking to the start, advancing at the
 * end) — the same "trim window" idea, just applied at watch-time instead of upload-time.
 */
export function StoryTrimScreen({ localUri, durationMs, onCancel, onConfirm }: StoryTrimScreenProps) {
  const initialClipMs = Math.min(MAX_CLIP_MS, durationMs);
  const [windowStartMs, setWindowStartMs] = useState(0);
  const [windowEndMs, setWindowEndMs] = useState(initialClipMs);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const dragStartRef = useRef({ start: 0, end: 0 });

  // Read by the timeUpdate loop-back listener below, which is bound once (not re-bound on every
  // drag frame) — these always hold the live values without it needing to be in that effect's deps.
  const windowStartRef = useRef(windowStartMs);
  windowStartRef.current = windowStartMs;
  const windowEndRef = useRef(windowEndMs);
  windowEndRef.current = windowEndMs;

  const player = useVideoPlayer(localUri, (p) => {
    p.loop = false;
    p.muted = false;
    p.timeUpdateEventInterval = 0.1;
  });

  // Seeds playback to the initial window's start and starts it once per video — the live preview
  // plays continuously the whole time this screen is open rather than needing a tap; dragging
  // either handle doesn't restart this, it just moves the loop-back boundaries the listener below
  // is already watching.
  useEffect(() => {
    player.currentTime = windowStartRef.current / 1000;
    player.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  useEffect(() => {
    const sub = player.addListener('timeUpdate', ({ currentTime }) => {
      const startSec = windowStartRef.current / 1000;
      const endSec = windowEndRef.current / 1000;
      if (currentTime >= endSec || currentTime < startSec) {
        player.currentTime = startSec;
      }
    });
    return () => sub.remove();
  }, [player]);

  const makeResponder = (kind: 'start' | 'end' | 'move') =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartRef.current = { start: windowStartRef.current, end: windowEndRef.current };
      },
      onPanResponderMove: (_, g) => {
        if (timelineWidth <= 0) return;
        const msPerPx = durationMs / timelineWidth;
        const deltaMs = g.dx * msPerPx;
        const { start, end } = dragStartRef.current;
        if (kind === 'start') {
          const next = Math.max(0, Math.min(end - MIN_CLIP_MS, start + deltaMs));
          setWindowStartMs(Math.max(next, end - MAX_CLIP_MS));
        } else if (kind === 'end') {
          const lowerBound = start + MIN_CLIP_MS;
          const next = Math.min(durationMs, Math.max(lowerBound, end + deltaMs));
          setWindowEndMs(Math.min(next, start + MAX_CLIP_MS));
        } else {
          const clipLen = end - start;
          const nextStart = Math.max(0, Math.min(durationMs - clipLen, start + deltaMs));
          setWindowStartMs(nextStart);
          setWindowEndMs(nextStart + clipLen);
        }
      },
    });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const moveResponder = useMemo(() => makeResponder('move'), [timelineWidth, durationMs]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startResponder = useMemo(() => makeResponder('start'), [timelineWidth, durationMs]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const endResponder = useMemo(() => makeResponder('end'), [timelineWidth, durationMs]);

  const windowLeftPct = durationMs > 0 ? (windowStartMs / durationMs) * 100 : 0;
  const windowWidthPct = durationMs > 0 ? ((windowEndMs - windowStartMs) / durationMs) * 100 : 100;
  const clipSeconds = (windowEndMs - windowStartMs) / 1000;

  return (
    <View style={styles.screen}>
      <Pressable onPress={onCancel} hitSlop={12} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Cancel">
        <Icon path={CLOSE_ICON} size={22} color="#FFFFFF" strokeWidth={2.2} />
      </Pressable>

      <Text style={styles.title}>Choose up to 15 seconds</Text>
      <Text style={styles.subtitle}>Drag either edge to trim the clip, or drag the middle to move it — {clipSeconds.toFixed(1)}s selected.</Text>

      <View style={styles.videoWrap}>
        {/* expo-video's own .d.ts/.web.d.ts split resolves inconsistently under this project's
            moduleSuffixes (VideoView's prop type and useVideoPlayer's return type end up as two
            different declarations of the same runtime object) — a real player at runtime, just a
            package-typing quirk tsc can't reconcile, hence the cast. */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <VideoView player={player as any} style={styles.video} contentFit="contain" nativeControls={false} />
      </View>

      <View style={styles.timeline} onLayout={(e) => setTimelineWidth(e.nativeEvent.layout.width)}>
        <View {...moveResponder.panHandlers} style={[styles.timelineWindow, { left: `${windowLeftPct}%`, width: `${windowWidthPct}%` }]} />
        <View
          {...startResponder.panHandlers}
          hitSlop={{ top: 10, bottom: 10, left: HANDLE_HIT_WIDTH / 2, right: HANDLE_HIT_WIDTH / 2 }}
          style={[styles.handle, { left: `${windowLeftPct}%`, marginLeft: -HANDLE_VISUAL_WIDTH / 2 }]}
        />
        <View
          {...endResponder.panHandlers}
          hitSlop={{ top: 10, bottom: 10, left: HANDLE_HIT_WIDTH / 2, right: HANDLE_HIT_WIDTH / 2 }}
          style={[styles.handle, { left: `${windowLeftPct + windowWidthPct}%`, marginLeft: -HANDLE_VISUAL_WIDTH / 2 }]}
        />
      </View>

      <Pressable
        onPress={() => onConfirm({ startMs: Math.round(windowStartMs), endMs: Math.round(windowEndMs) })}
        style={styles.confirmBtn}
        accessibilityRole="button"
        accessibilityLabel="Use this clip"
      >
        <Text style={styles.confirmText}>Use this clip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000', paddingHorizontal: 20, paddingTop: 64, paddingBottom: 40 },
  closeBtn: {
    position: 'absolute',
    top: 24,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: throwFont.ui700, fontSize: 18, color: '#FFFFFF', textAlign: 'center' },
  subtitle: { fontFamily: throwFont.ui400, fontSize: 13, color: 'rgba(255,255,255,.6)', textAlign: 'center', marginTop: 6, marginBottom: 20 },
  videoWrap: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#111111' },
  video: { flex: 1 },
  timeline: {
    height: TIMELINE_HEIGHT,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,.15)',
    marginTop: 20,
    justifyContent: 'center',
  },
  timelineWindow: {
    position: 'absolute',
    height: TIMELINE_HEIGHT,
    borderRadius: 10,
    backgroundColor: throwColor.storyRing,
  },
  handle: {
    position: 'absolute',
    top: 6,
    width: HANDLE_VISUAL_WIDTH,
    height: TIMELINE_HEIGHT - 12,
    borderRadius: HANDLE_VISUAL_WIDTH / 2,
    backgroundColor: '#FFFFFF',
  },
  confirmBtn: {
    marginTop: 24,
    backgroundColor: throwColor.storyRing,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmText: { fontFamily: throwFont.ui700, fontSize: 15, color: '#00230F' },
});
