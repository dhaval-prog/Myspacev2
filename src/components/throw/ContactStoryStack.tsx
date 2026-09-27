import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, LayoutChangeEvent, PanResponder, Platform, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Blackhole } from './Blackhole';
import { throwColor, throwNightColor, throwRadius } from '../../theme/throwTokens';
import type { ThrowStory } from '../../types/story';

const COMMIT_DISTANCE = 90;
const COMMIT_VELOCITY = 0.5;
const MAX_TILT_DEG = 10;
const FLIGHT_DURATION_MS = 480;
const MIN_SCALE = 0.12;
const DEFAULT_HEIGHT = 460;
const REST_1 = { scale: 0.94, translateY: 12, rotate: -3 };
const REST_2 = { scale: 0.88, translateY: 22, rotate: 3 };

// Same split-by-media-type reasoning as the rest of Throw's story components (see the retired
// StatusPhotoViewer) — hooks can't be conditional, so a photo story never touches useVideoPlayer.
function StoryVideoMedia({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <VideoView player={player as any} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} pointerEvents="none" />;
}

function StoryMedia({ story, isFront }: { story: ThrowStory; isFront?: boolean }) {
  if (story.mediaType === 'photo') {
    // pointerEvents="none" — react-native-web's Image renders a plain <img>, natively draggable by
    // browsers by default; without this, a drag starting over it triggers the browser's own HTML5
    // image-drag instead of a regular pointer gesture, swallowing every mousemove/mouseup after the
    // first (see the retired StatusPhotoViewer's own comment — same underlying bug, same fix).
    // testID only on the front card — up to two more of these can render behind it at once (see
    // REST_1/REST_2), and a shared testID across siblings breaks getByTestId's "exactly one" query.
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image
          testID={isFront ? 'contact-story-image' : undefined}
          source={{ uri: story.mediaUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      </View>
    );
  }
  return <StoryVideoMedia uri={story.mediaUrl} />;
}

interface ContactStoryStackProps {
  /** Oldest-first, same convention every other story component in Throw already uses — reversed
   * internally so the most recently posted one renders on top, per explicit request. */
  stories: ThrowStory[];
  isNight?: boolean;
  /** Fired once every story has been flicked away — the parent (ThrowHomeScreen) swaps back to
   * showing the compose/letter card in the exact same slot, which is what makes the letter read as
   * "the final card underneath" without this component needing to know anything about
   * FoldingLetter itself. */
  onExhausted: () => void;
  /** Fired once, right as each story becomes the front/interactive card — same "record a view"
   * contract the retired StoryViewerScreen's own onViewed prop had. */
  onViewed?: (storyId: string) => void;
}

/**
 * Replaces the compose letter, in the same card, while viewing a contact's (any contact's,
 * including your own) posted stories — a tactile stack of photo cards, most recent on top, that
 * you flick upward one at a time into a small blackhole at the top of the card. The next photo
 * rises smoothly into the primary position as each one disappears; once the last one is gone, this
 * unmounts (see onExhausted) and the letter underneath is what's left, exactly like it never left.
 * A slow/uncommitted drag just follows the finger and springs back — only a drag or flick that
 * crosses the distance/velocity threshold actually consumes the card.
 */
export function ContactStoryStack({ stories, isNight, onExhausted, onViewed }: ContactStoryStackProps) {
  // Most-recent-first — "the most recent/latest story should appear on top" per explicit request,
  // the reverse of the oldest-first order `stories` itself is always handed down in.
  const ordered = useMemo(() => [...stories].reverse(), [stories]);
  const [index, setIndex] = useState(0);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const wrapRef = useRef<View>(null);
  const [consumeCount, setConsumeCount] = useState(0);

  // How far up a flicked card travels before it's considered "reached" the blackhole — scaled off
  // the card's own real height (measured via onLayout) so the flight always covers roughly the top
  // half of the card regardless of device size, rather than a fixed pixel distance that would look
  // wrong on a much taller or shorter card.
  const flightDistance = Math.max(160, height * 0.5 - 60);

  // Read inside commit() without needing the raw-DOM gesture effect's dependency array to include
  // it (that effect only ever needs to be set up once per dragY/dragX identity, not re-bound every
  // time the card's own measured height changes).
  const latestFlightDistance = useRef(flightDistance);
  latestFlightDistance.current = flightDistance;

  const onLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height);

  const front = ordered[index];
  const behind1 = ordered[index + 1];
  const behind2 = ordered[index + 2];

  useEffect(() => {
    if (!front) {
      onExhausted();
      return;
    }
    onViewed?.(front.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [front?.id]);

  const commit = () => {
    setConsumeCount((c) => c + 1);
    Animated.parallel([
      Animated.timing(dragY, { toValue: -latestFlightDistance.current, duration: FLIGHT_DURATION_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(dragX, { toValue: 0, duration: FLIGHT_DURATION_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      dragY.setValue(0);
      dragX.setValue(0);
      setIndex((i) => i + 1);
    });
  };
  const springBack = () => {
    Animated.parallel([
      Animated.spring(dragY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 60 }),
      Animated.spring(dragX, { toValue: 0, useNativeDriver: true, friction: 8, tension: 60 }),
    ]).start();
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const springBackRef = useRef(springBack);
  springBackRef.current = springBack;

  // react-native-web's PanResponder polyfill has the same touch-history dedupe bug documented at
  // length elsewhere in Throw (FoldingLetter's own raw-DOM-listener effect, the retired
  // StatusPhotoViewer) — sidesteps it the same way: raw mouse/touch listeners computing the drag
  // purely from real pointer deltas, no RN gestureState involved. Velocity is tracked by hand too
  // (the same last-position/last-timestamp approach ThrowHomeScreen's own reminder-peek gesture
  // already uses), since a plain DOM pointer event carries no velocity of its own.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = wrapRef.current as any as HTMLElement | null;
    if (!node) return;
    let startX: number | null = null;
    let startY: number | null = null;
    let lastY = 0;
    let lastT = 0;
    let velocityY = 0;
    const getPoint = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if ('touches' in e && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if ('changedTouches' in e && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      if ('clientX' in e) return { x: e.clientX, y: e.clientY };
      return null;
    };
    const reset = () => {
      startX = null;
      startY = null;
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const p = getPoint(e);
      if (!p) return;
      startX = p.x;
      startY = p.y;
      lastY = p.y;
      lastT = Date.now();
      velocityY = 0;
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (startX === null || startY === null) return;
      const p = getPoint(e);
      if (!p) return;
      const now = Date.now();
      const dt = now - lastT;
      if (dt > 0) velocityY = (p.y - lastY) / dt;
      lastY = p.y;
      lastT = now;
      dragY.setValue(p.y - startY);
      dragX.setValue(p.x - startX);
    };
    const onUp = () => {
      if (startY === null) {
        reset();
        return;
      }
      const dy = lastY - startY;
      reset();
      if (dy < -COMMIT_DISTANCE || velocityY < -COMMIT_VELOCITY) {
        commitRef.current();
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
  }, [dragY, dragX]);

  // Native's real touch system doesn't have the bug above, so it keeps using PanResponder's own
  // gestureState (including its own velocity, vy) as-is.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => Platform.OS !== 'web',
        onMoveShouldSetPanResponder: () => Platform.OS !== 'web',
        onPanResponderMove: (_, g) => {
          if (Platform.OS === 'web') return;
          dragY.setValue(g.dy);
          dragX.setValue(g.dx);
        },
        onPanResponderRelease: (_, g) => {
          if (Platform.OS === 'web') return;
          if (g.dy < -COMMIT_DISTANCE || g.vy < -COMMIT_VELOCITY) {
            commit();
          } else {
            springBack();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragY, dragX],
  );

  if (!front) return null;

  const rotateDeg = Animated.add(
    dragY.interpolate({ inputRange: [-flightDistance, 0], outputRange: [-MAX_TILT_DEG, 0], extrapolate: 'clamp' }),
    dragX.interpolate({ inputRange: [-140, 0, 140], outputRange: [-6, 0, 6], extrapolate: 'clamp' }),
  );
  const frontStyle = {
    transform: [
      { translateY: dragY },
      { scale: dragY.interpolate({ inputRange: [-flightDistance, 0], outputRange: [MIN_SCALE, 1], extrapolate: 'clamp' }) },
      { rotate: rotateDeg.interpolate({ inputRange: [-40, 0, 40], outputRange: ['-40deg', '0deg', '40deg'], extrapolate: 'clamp' }) },
    ],
    opacity: dragY.interpolate({ inputRange: [-flightDistance, -flightDistance * 0.82, 0], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
  };
  // Stands in for a literal blur (RN has no reliable cross-platform per-node blur filter) — a soft
  // white veil that thickens as the card recedes, reading as "hazy/receding into the distance"
  // rather than perfectly sharp right up until it vanishes.
  const veilOpacity = dragY.interpolate({ inputRange: [-flightDistance, -flightDistance * 0.3, 0], outputRange: [0.55, 0.15, 0], extrapolate: 'clamp' });

  const restStyle = (rest: typeof REST_1) => ({
    transform: [
      { translateY: dragY.interpolate({ inputRange: [-flightDistance, 0], outputRange: [0, rest.translateY], extrapolate: 'clamp' as const }) },
      { scale: dragY.interpolate({ inputRange: [-flightDistance, 0], outputRange: [1, rest.scale], extrapolate: 'clamp' as const }) },
      { rotate: dragY.interpolate({ inputRange: [-flightDistance, 0], outputRange: ['0deg', `${rest.rotate}deg`], extrapolate: 'clamp' as const }) },
    ],
  });
  const behind1Style = {
    transform: [
      { translateY: dragY.interpolate({ inputRange: [-flightDistance, 0], outputRange: [REST_1.translateY, REST_2.translateY], extrapolate: 'clamp' as const }) },
      { scale: dragY.interpolate({ inputRange: [-flightDistance, 0], outputRange: [REST_1.scale, REST_2.scale], extrapolate: 'clamp' as const }) },
      { rotate: dragY.interpolate({ inputRange: [-flightDistance, 0], outputRange: [`${REST_1.rotate}deg`, `${REST_2.rotate}deg`], extrapolate: 'clamp' as const }) },
    ],
  };

  return (
    <View ref={wrapRef} onLayout={onLayout} style={styles.root} {...panResponder.panHandlers}>
      <View style={[styles.clip, { backgroundColor: isNight ? throwNightColor.paper : throwColor.paper }]}>
        {behind2 && (
          <Animated.View style={[StyleSheet.absoluteFill, restStyle(REST_2)]}>
            <StoryMedia key={behind2.id} story={behind2} />
          </Animated.View>
        )}
        {behind1 && (
          <Animated.View style={[StyleSheet.absoluteFill, behind1Style]}>
            <StoryMedia key={behind1.id} story={behind1} />
          </Animated.View>
        )}
      </View>

      <Animated.View style={[styles.card, frontStyle]}>
        <StoryMedia key={front.id} story={front} isFront />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, { opacity: veilOpacity }]} />
      </Animated.View>

      <View style={styles.blackholeWrap}>
        <Blackhole isNight={isNight} pulseSignal={consumeCount} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // No overflow constraint here — the front card needs to be able to visually travel up past its
  // own resting bounds toward the blackhole; only `clip`/`card` below (each individually rounded)
  // clip their own photo content.
  root: { flex: 1, position: 'relative' },
  clip: { ...StyleSheet.absoluteFill, borderRadius: throwRadius.paper, overflow: 'hidden' },
  card: { ...StyleSheet.absoluteFill, borderRadius: throwRadius.paper, overflow: 'hidden', ...throwColor.shadowSoft },
  veil: { backgroundColor: '#FFFFFF' },
  blackholeWrap: { position: 'absolute', top: 6, alignSelf: 'center', zIndex: 5 },
});
