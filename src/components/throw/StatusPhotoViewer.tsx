import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Platform, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { throwColor, throwNightColor, throwRadius } from '../../theme/throwTokens';
import type { ThrowStory } from '../../types/story';

const PHOTO_DURATION_MS = 5000;
const SWIPE_DISTANCE = 50;
const SWIPE_VELOCITY = 0.4;
const FADE_MS = 350;

// Split into two components (rather than one branching on mediaType) so a photo story never
// calls useVideoPlayer at all — hooks can't be conditional, and there's no reason to spin up a
// video player for a plain image.
function StatusVideoMedia({ uri }: { uri: string }) {
  // Muted/no-controls — this is a fixed-cadence slideshow (see PHOTO_DURATION_MS), not a normal
  // video player; the external timer below governs advancing regardless of the clip's own length.
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <VideoView player={player as any} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} pointerEvents="none" />;
}

function StatusMedia({ story }: { story: ThrowStory }) {
  if (story.mediaType === 'photo') {
    // pointerEvents="none" — react-native-web's Image renders a plain <img>, which browsers make
    // natively draggable by default; without this, dragging over it starts an HTML5 image-drag
    // instead of a regular pointer gesture, which swallows every mousemove/mouseup after the
    // first (confirmed directly: a real Playwright drag showed exactly one 'mousemove' reaching
    // the wrapper's own listeners, then silence, with no error or unmount). This routes every
    // pointer event straight to the wrapping View's own raw listeners instead.
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image testID="status-photo-image" source={{ uri: story.mediaUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </View>
    );
  }
  return <StatusVideoMedia uri={story.mediaUrl} />;
}

interface StatusPhotoViewerProps {
  /** The signed-in user's own active stories, oldest first — same shape/order the story viewer
   * elsewhere in Throw already uses. */
  stories: ThrowStory[];
  /** Swiping right past the last (or only) photo — returns to the normal compose card for
   * "Own Contact", mirroring the tilt/flick left that opened this view in the first place. */
  onExit: () => void;
  isNight?: boolean;
}

/**
 * Replaces the compose letter, in the same card, when a tilt/flick left off "Own Contact" lands
 * on the "Status" slot — the user's own already-posted story photos/videos, filling the exact
 * same paper area (same rounded rect, same dimensions) rather than opening a separate screen.
 * Multiple items auto-advance every 5s (stopping at the last one, not looping) with a fade
 * between each; a single item just stays put. A manual right swipe skips ahead a photo at a
 * time, and resets that 5s timer — except on the last (or only) photo, where it means "done
 * looking, go back" instead, per explicit request.
 */
export function StatusPhotoViewer({ stories, onExit, isNight }: StatusPhotoViewerProps) {
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const story = stories[Math.min(index, stories.length - 1)];
  const wrapRef = useRef<View>(null);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
  }, [index, fade]);

  useEffect(() => {
    if (stories.length <= 1 || index >= stories.length - 1) return;
    const timer = setTimeout(() => setIndex((i) => i + 1), PHOTO_DURATION_MS);
    return () => clearTimeout(timer);
  }, [index, stories.length]);

  const advance = () => {
    if (index < stories.length - 1) {
      setIndex((i) => i + 1);
    } else {
      onExit();
    }
  };
  // Read by both gesture paths below without either needing to be rebuilt on every index change —
  // mirrors FoldingLetter's own `latest` ref pattern for the same reason (a PanResponder built via
  // useMemo/useEffect only once shouldn't need `index`/`stories.length` in its dependency array
  // just so its callbacks see fresh values).
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // react-native-web's PanResponder polyfill has the same touch-history dedupe bug documented at
  // length on FoldingLetter's own raw-DOM-listener effect (gestureState.dx silently stops tracking
  // real pointer movement for a significant fraction of drags) — confirmed here the same way: a
  // real swipe-right in a Playwright web harness never crossed SWIPE_DISTANCE via PanResponder's
  // own onPanResponderRelease. This sidesteps it exactly like FoldingLetter does: raw mouse/touch
  // listeners computing the swipe purely from real pointer deltas, no RN gestureState involved.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = wrapRef.current as any as HTMLElement | null;
    if (!node) return;
    let startX: number | null = null;
    let startY: number | null = null;
    const getPoint = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if ('changedTouches' in e) {
        const t = e.changedTouches[0];
        return t ? { x: t.clientX, y: t.clientY } : null;
      }
      return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const p = getPoint(e);
      if (!p) return;
      startX = p.x;
      startY = p.y;
    };
    const onUp = (e: MouseEvent | TouchEvent) => {
      if (startX === null || startY === null) return;
      const p = getPoint(e);
      const dx = p ? p.x - startX : 0;
      const dy = p ? p.y - startY : 0;
      startX = null;
      startY = null;
      if (dx > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) advanceRef.current();
    };
    node.addEventListener('mousedown', onDown);
    node.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      node.removeEventListener('mousedown', onDown);
      node.removeEventListener('touchstart', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  // Native's real touch system doesn't have the bug above, so it keeps using PanResponder's own
  // gestureState tracking as-is.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Platform.OS !== 'web' && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_, g) => {
          if (Platform.OS === 'web') return;
          if (g.dx > SWIPE_DISTANCE || g.vx > SWIPE_VELOCITY) advanceRef.current();
        },
      }),
    [],
  );

  if (!story) return null;

  return (
    <View
      ref={wrapRef}
      style={[styles.clip, { backgroundColor: isNight ? throwNightColor.paper : throwColor.paper }]}
      {...panResponder.panHandlers}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <StatusMedia key={story.id} story={story} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { flex: 1, borderRadius: throwRadius.paper, overflow: 'hidden' },
});
