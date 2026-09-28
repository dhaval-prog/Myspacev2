import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Icon } from '../Icon';
import { throwColor, throwFont } from '../../theme/throwTokens';

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
const PLAY_ICON = 'M8 5v14l11-7z';
const PAUSE_ICON = 'M7 5h4v14H7z M13 5h4v14h-4z';
const MAX_CLIP_MS = 15000;
const TIMELINE_HEIGHT = 44;

interface StoryTrimScreenProps {
  localUri: string;
  /** The library-picked asset's own reported duration — used directly for the timeline's layout
   * math rather than waiting on the video player to finish loading its own metadata first. */
  durationMs: number;
  onCancel: () => void;
  onConfirm: (trim: { startMs: number; endMs: number }) => void;
}

/**
 * Shown only for a library-picked video over the 15s cap — lets the user drag a fixed 15s-wide
 * window over the full timeline to choose which slice becomes the story. Nothing is physically
 * re-encoded here (no ffmpeg/native trim module in this project): the confirmed start/end just
 * ride along as the story's own trim_start_ms/trim_end_ms, and the story viewer is what actually
 * enforces them at playback time (seeking to the start, advancing at the end) — the same "trim
 * window" idea, just applied at watch-time instead of upload-time.
 */
export function StoryTrimScreen({ localUri, durationMs, onCancel, onConfirm }: StoryTrimScreenProps) {
  const clipMs = Math.min(MAX_CLIP_MS, durationMs);
  const maxStartMs = Math.max(0, durationMs - clipMs);
  const [windowStartMs, setWindowStartMs] = useState(0);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const dragStartRef = useRef(0);
  const previewStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useVideoPlayer(localUri, (p) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(
    () => () => {
      if (previewStopTimerRef.current) clearTimeout(previewStopTimerRef.current);
    },
    [],
  );

  const stopPreview = () => {
    if (previewStopTimerRef.current) {
      clearTimeout(previewStopTimerRef.current);
      previewStopTimerRef.current = null;
    }
    player.pause();
    setPreviewing(false);
  };

  const togglePreview = () => {
    if (previewing) {
      stopPreview();
      return;
    }
    player.currentTime = windowStartMs / 1000;
    player.play();
    setPreviewing(true);
    previewStopTimerRef.current = setTimeout(stopPreview, clipMs);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          if (previewing) stopPreview();
          dragStartRef.current = windowStartMs;
        },
        onPanResponderMove: (_, g) => {
          if (timelineWidth <= 0) return;
          const msPerPx = durationMs / timelineWidth;
          const next = Math.max(0, Math.min(maxStartMs, dragStartRef.current + g.dx * msPerPx));
          setWindowStartMs(next);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }),
    [timelineWidth, durationMs, maxStartMs, windowStartMs, previewing],
  );

  const windowLeftPct = durationMs > 0 ? (windowStartMs / durationMs) * 100 : 0;
  const windowWidthPct = durationMs > 0 ? (clipMs / durationMs) * 100 : 100;

  return (
    <View style={styles.screen}>
      <Pressable onPress={onCancel} hitSlop={12} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Cancel">
        <Icon path={CLOSE_ICON} size={22} color="#FFFFFF" strokeWidth={2.2} />
      </Pressable>

      <Text style={styles.title}>Choose 15 seconds</Text>
      <Text style={styles.subtitle}>Drag the highlighted window to pick which part of the video to post.</Text>

      <View style={styles.videoWrap}>
        {/* expo-video's own .d.ts/.web.d.ts split resolves inconsistently under this project's
            moduleSuffixes (VideoView's prop type and useVideoPlayer's return type end up as two
            different declarations of the same runtime object) — a real player at runtime, just a
            package-typing quirk tsc can't reconcile, hence the cast. */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <VideoView player={player as any} style={styles.video} contentFit="contain" nativeControls={false} />
        <Pressable onPress={togglePreview} style={styles.playOverlay} accessibilityRole="button" accessibilityLabel={previewing ? 'Pause preview' : 'Preview clip'}>
          <View style={styles.playBadge}>
            <Icon path={previewing ? PAUSE_ICON : PLAY_ICON} size={22} color="#FFFFFF" strokeWidth={1.8} />
          </View>
        </Pressable>
      </View>

      <View style={styles.timeline} onLayout={(e) => setTimelineWidth(e.nativeEvent.layout.width)}>
        <View
          {...panResponder.panHandlers}
          style={[styles.timelineWindow, { left: `${windowLeftPct}%`, width: `${windowWidthPct}%` }]}
        />
      </View>

      <Pressable
        onPress={() => onConfirm({ startMs: Math.round(windowStartMs), endMs: Math.round(windowStartMs + clipMs) })}
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
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' },
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
  confirmBtn: {
    marginTop: 24,
    backgroundColor: throwColor.storyRing,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmText: { fontFamily: throwFont.ui700, fontSize: 15, color: '#00230F' },
});
