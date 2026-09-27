import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, LayoutChangeEvent, PanResponder, Platform, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { throwColor, throwNightColor, throwRadius } from '../../theme/throwTokens';
import type { ThrowStory } from '../../types/story';

const PHOTO_DURATION_MS = 5000;
const COMMIT_DISTANCE = 80;
const MAX_ROTATION_DEG = 8;
const COMMIT_DURATION_MS = 220;
const DEFAULT_WIDTH = 400;

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
  isNight?: boolean;
}

/**
 * Replaces the compose letter, in the same card, when a tilt/flick left off "Own Contact" lands
 * on the "Status" slot — the user's own already-posted story photos/videos, filling the exact
 * same paper area (same rounded rect, same dimensions) rather than opening a separate screen.
 * Browsed like a stack of cards: drag left to reveal the next photo, right for the previous one,
 * with the neighbour peeking from underneath as the current one slides away; multiple items also
 * auto-advance every 5s the same way. At either end of the stack (or with only one photo), a drag
 * just springs back to place instead of doing anything — there's nothing further to reveal.
 * Getting back to "Own Contact" itself isn't this component's job any more (see ThrowHomeScreen's
 * own isStatusMode/onChangeIndex) — tapping any contact in the carousel above does that.
 */
export function StatusPhotoViewer({ stories, isNight }: StatusPhotoViewerProps) {
  const [index, setIndex] = useState(0);
  // Which neighbour (if any) is peeking out from underneath the current drag — null once no drag
  // is in progress (and briefly during a commit's own slide-off animation).
  const [peek, setPeek] = useState<'next' | 'prev' | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const translateX = useRef(new Animated.Value(0)).current;
  const wrapRef = useRef<View>(null);
  const story = stories[Math.min(index, stories.length - 1)];

  // Read by the gesture effects below without forcing either to be rebuilt on every index/stories
  // change — mirrors FoldingLetter's own `latest` ref pattern for the same reason.
  const latest = useRef({ index, total: stories.length });
  latest.current = { index, total: stories.length };

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const commit = (direction: 'next' | 'prev') => {
    setPeek(direction);
    Animated.timing(translateX, { toValue: direction === 'next' ? -width : width, duration: COMMIT_DURATION_MS, useNativeDriver: true }).start(() => {
      translateX.setValue(0);
      setIndex((i) => (direction === 'next' ? i + 1 : i - 1));
      setPeek(null);
    });
  };
  const springBack = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 8, tension: 60 }).start(() => setPeek(null));
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const springBackRef = useRef(springBack);
  springBackRef.current = springBack;

  // Auto-advances exactly like a committed left-drag would (same slide-off animation), stopping
  // at the last photo rather than looping back to the first.
  useEffect(() => {
    if (stories.length <= 1 || index >= stories.length - 1) return;
    const timer = setTimeout(() => commitRef.current('next'), PHOTO_DURATION_MS);
    return () => clearTimeout(timer);
  }, [index, stories.length]);

  // react-native-web's PanResponder polyfill has the same touch-history dedupe bug documented at
  // length on FoldingLetter's own raw-DOM-listener effect (gestureState.dx silently stops tracking
  // real pointer movement partway through a drag) — sidesteps it the same way: raw mouse/touch
  // listeners computing the drag purely from real pointer deltas, no RN gestureState involved.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = wrapRef.current as any as HTMLElement | null;
    if (!node) return;
    let startX: number | null = null;
    let startY: number | null = null;
    let dragging = false;
    let direction: 'next' | 'prev' | null = null;
    const getPoint = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if ('touches' in e && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if ('changedTouches' in e && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      if ('clientX' in e) return { x: e.clientX, y: e.clientY };
      return null;
    };
    const reset = () => {
      startX = null;
      startY = null;
      dragging = false;
      direction = null;
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const p = getPoint(e);
      if (!p) return;
      startX = p.x;
      startY = p.y;
      dragging = false;
      direction = null;
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (startX === null || startY === null) return;
      const p = getPoint(e);
      if (!p) return;
      const dx = p.x - startX;
      const dy = p.y - startY;
      if (!dragging) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          dragging = true;
        } else {
          return;
        }
      }
      if (direction === null) {
        direction = dx < 0 ? 'next' : 'prev';
        const hasNeighbor = direction === 'next' ? latest.current.index < latest.current.total - 1 : latest.current.index > 0;
        setPeek(hasNeighbor ? direction : null);
      }
      translateX.setValue(dx);
    };
    const onUp = (e: MouseEvent | TouchEvent) => {
      if (startX === null) {
        reset();
        return;
      }
      const p = getPoint(e);
      const dx = p ? p.x - startX : 0;
      const wasDragging = dragging;
      const dir = direction;
      reset();
      if (!wasDragging || !dir) return;
      const hasNeighbor = dir === 'next' ? latest.current.index < latest.current.total - 1 : latest.current.index > 0;
      if (hasNeighbor && Math.abs(dx) > COMMIT_DISTANCE) {
        commitRef.current(dir);
      } else {
        springBackRef.current();
      }
    };
    node.addEventListener('mousedown', onDown);
    node.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      node.removeEventListener('mousedown', onDown);
      node.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [translateX]);

  // Native's real touch system doesn't have the bug above, so it keeps using PanResponder's own
  // gestureState tracking as-is.
  const directionRef = useRef<'next' | 'prev' | null>(null);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Platform.OS !== 'web' && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderGrant: () => {
          directionRef.current = null;
        },
        onPanResponderMove: (_, g) => {
          if (Platform.OS === 'web') return;
          if (directionRef.current === null) {
            directionRef.current = g.dx < 0 ? 'next' : 'prev';
            const hasNeighbor =
              directionRef.current === 'next' ? latest.current.index < latest.current.total - 1 : latest.current.index > 0;
            setPeek(hasNeighbor ? directionRef.current : null);
          }
          translateX.setValue(g.dx);
        },
        onPanResponderRelease: (_, g) => {
          if (Platform.OS === 'web') return;
          const dir = directionRef.current;
          directionRef.current = null;
          if (!dir) return;
          const hasNeighbor = dir === 'next' ? latest.current.index < latest.current.total - 1 : latest.current.index > 0;
          if (hasNeighbor && Math.abs(g.dx) > COMMIT_DISTANCE) {
            commit(dir);
          } else {
            springBack();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [translateX],
  );

  if (!story) return null;

  const peekStory = peek === 'next' ? stories[index + 1] : peek === 'prev' ? stories[index - 1] : null;
  const rotate = translateX.interpolate({
    inputRange: [-Math.max(width, 1), 0, Math.max(width, 1)],
    outputRange: [`-${MAX_ROTATION_DEG}deg`, '0deg', `${MAX_ROTATION_DEG}deg`],
    extrapolate: 'clamp',
  });

  return (
    <View
      ref={wrapRef}
      onLayout={onLayout}
      style={[styles.clip, { backgroundColor: isNight ? throwNightColor.paper : throwColor.paper }]}
      {...panResponder.panHandlers}
    >
      {peekStory && (
        <View style={styles.peekWrap}>
          <StatusMedia key={peekStory.id} story={peekStory} />
        </View>
      )}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }, { rotate }] }]}>
        <StatusMedia key={story.id} story={story} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { flex: 1, borderRadius: throwRadius.paper, overflow: 'hidden' },
  // A slightly scaled-down, static layer behind the actively-dragged top card — just enough to
  // read as "another card in the stack" underneath, per explicit request.
  peekWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transform: [{ scale: 0.94 }] },
});
