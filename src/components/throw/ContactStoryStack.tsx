import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Icon } from '../Icon';
import { throwColor, throwNightColor, throwRadius } from '../../theme/throwTokens';
import type { ThrowStory } from '../../types/story';

const COMMIT_DISTANCE = 90;
const COMMIT_VELOCITY = 0.5;
const MAX_TILT_DEG = 10;
const FLIGHT_DURATION_MS = 480;
const MIN_SCALE = 0.12;
// Used only until the real measurement below resolves (effectively instant — see the layout
// effect) or as a last resort if flightTargetY is never given at all.
const DEFAULT_FLIGHT_DISTANCE = 260;
const REST_1 = { scale: 0.94, translateY: 12, rotate: -3 };
const REST_2 = { scale: 0.88, translateY: 22, rotate: 3 };
// Same trash glyph the rest of Throw already uses for delete affordances (ChatThreadScreen,
// GroupChatScreen, LetterCard) — a known-good path rather than a fresh approximation.
const TRASH_ICON = 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6.5M13.5 10.5v6.5';
// Long-press-to-arm-delete (own stories only, see isOwnStories) — same "hold still, then it
// commits to a different gesture" shape as StoryCaptureScreen's own shutter hold-to-record, and
// the same small-movement tolerance FoldingLetter's own flick-capture thresholds use elsewhere.
const LONG_PRESS_MS = 450;
const LONG_PRESS_SLOP = 10;
const DELETE_COMMIT_DISTANCE = 100;
const DELETE_COMMIT_VELOCITY = 0.5;
// How far down the photo travels while "getting crushed" before it's gone — arbitrary (nothing
// on screen to fly toward, unlike the upward consume/post flights), just far enough to clear the
// card entirely.
const DELETE_TRAVEL_DISTANCE = 320;
const CRUSH_SCALE_Y = 0.22;
const CRUSH_SCALE_X = 1.15;
// The stack's own falling-into-place entrance (own stories only, see isOwnStories) — how far above
// its resting spot each layer starts, how long each one takes to fall, and the delay between one
// landing and the next starting (back-to-front, see the stagger call itself).
const ENTRY_DROP_DISTANCE = 220;
const ENTRY_DURATION_MS = 420;
const ENTRY_STAGGER_MS = 130;
// Alternating signs per layer read as a more natural, less mechanical tumble than every photo
// rotating the same way as it falls.
const ENTRY_START_ROTATE_DEG: Record<'front' | 'behind1' | 'behind2', number> = { front: -13, behind1: 10, behind2: -8 };

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
  /** The selected contact's own ring in RecipientCarousel, in absolute screen coordinates (see
   * ThrowHomeScreen's own storyFlightTargetY) — a flicked-away card flies toward this exact point
   * rather than to some destination invented just for this component, since the contact's ring is
   * already the one thing on screen that's naturally "theirs" to disappear into. Falls back to a
   * fixed distance if omitted (tests, or before the first real layout pass resolves it). */
  flightTargetY?: number;
  /** Fired once every story has been flicked away — the parent (ThrowHomeScreen) swaps back to
   * showing the compose/letter card in the exact same slot, which is what makes the letter read as
   * "the final card underneath" without this component needing to know anything about
   * FoldingLetter itself. */
  onExhausted: () => void;
  /** Fired once, right as each story becomes the front/interactive card — same "record a view"
   * contract the retired StoryViewerScreen's own onViewed prop had. */
  onViewed?: (storyId: string) => void;
  /** True only while viewing your OWN posted stories (see RecipientCarousel's own blue "active"
   * ring on your avatar) — enables two behaviors that only make sense there: the stack's own
   * entrance plays as all its photos falling into place (see entryFront/entryBehind1/entryBehind2
   * below) rather than just appearing already in place, and each photo can be long-pressed to
   * reveal a delete affordance. Neither belongs on a contact whose stories you can only view. */
  isOwnStories?: boolean;
  /** Fired once a story's delete gesture actually commits (see isOwnStories) — this component has
   * already made room for the next photo locally by the time this fires; the parent (ThrowHomeScreen,
   * wired to ThrowStoriesContext's own deleteStory) is what actually removes it from the backend. */
  onDeleteStory?: (storyId: string) => void;
}

/**
 * Replaces the compose letter, in the same card, while viewing a contact's (any contact's,
 * including your own) posted stories — a tactile stack of photo cards, most recent on top, that
 * you flick upward one at a time, back into that same contact's own ring in the carousel above.
 * The next photo rises smoothly into the primary position as each one disappears; once the last
 * one is gone, this unmounts (see onExhausted) and the letter underneath is what's left, exactly
 * like it never left. A slow/uncommitted drag just follows the finger and springs back — only a
 * drag or flick that crosses the distance/velocity threshold actually consumes the card.
 */
export function ContactStoryStack({ stories, isNight, flightTargetY, onExhausted, onViewed, isOwnStories, onDeleteStory }: ContactStoryStackProps) {
  // Most-recent-first — "the most recent/latest story should appear on top" per explicit request,
  // the reverse of the oldest-first order `stories` itself is always handed down in.
  const reversed = useMemo(() => [...stories].reverse(), [stories]);
  // Deleted locally the instant the delete gesture commits (see deleteCommit) — the backend delete
  // itself (onDeleteStory) happens in the background and only actually removes the row from
  // `stories` once the next refresh lands, which could be a moment later; without this, the just-
  // deleted photo would still count toward `ordered` (and could even flash back into view behind
  // the next one) until that refresh catches up.
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const ordered = useMemo(() => (deletedIds.size === 0 ? reversed : reversed.filter((s) => !deletedIds.has(s.id))), [reversed, deletedIds]);
  const [index, setIndex] = useState(0);
  const [flightDistance, setFlightDistance] = useState(DEFAULT_FLIGHT_DISTANCE);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const wrapRef = useRef<View>(null);
  // Long-press-to-arm-delete state (own stories only) — `armed` is read synchronously inside the
  // gesture callbacks below (a ref, not state, so it's never stale mid-gesture); `deleteArmed`
  // mirrors it purely to drive the overlay's own render.
  const armedRef = useRef(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const armedOpacity = useRef(new Animated.Value(0)).current;
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // How far the front card has traveled while being "crushed" on delete — 0 normally, animates to
  // 1 only during deleteCommit (see frontStyle's own crush-derived scaleY/scaleX/opacity below).
  const crush = useRef(new Animated.Value(0)).current;

  // The stack's own entrance, own stories only (see isOwnStories) — each of the (up to three)
  // visible layers falls straight down from above, rotating in as it goes and fading in quickly
  // (never just a fade — the drop itself has to read clearly), landing in its normal resting
  // position/scale exactly as if it had always been there. One independent progress value per
  // layer, each purely additive on top of that layer's own existing (dragY-driven) transform (see
  // frontStyle/behind1Style/restStyle below), so once a layer's own entry finishes it contributes
  // nothing further and every bit of existing gesture logic is untouched. Staggered back-to-front
  // (furthest/oldest first, most recent — front — landing last, on top) so it reads as photos
  // being dropped into a pile one by one, not all snapping down together.
  const entryFront = useRef(new Animated.Value(isOwnStories ? 0 : 1)).current;
  const entryBehind1 = useRef(new Animated.Value(isOwnStories ? 0 : 1)).current;
  const entryBehind2 = useRef(new Animated.Value(isOwnStories ? 0 : 1)).current;
  useEffect(() => {
    if (!isOwnStories) return;
    Animated.stagger(ENTRY_STAGGER_MS, [
      Animated.timing(entryBehind2, { toValue: 1, duration: ENTRY_DURATION_MS, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      Animated.timing(entryBehind1, { toValue: 1, duration: ENTRY_DURATION_MS, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      Animated.timing(entryFront, { toValue: 1, duration: ENTRY_DURATION_MS, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
    ]).start();
    // Runs once, right as the stack first mounts (see ThrowHomeScreen's own key={selectedFriend.userId}) —
    // never replayed for a live index change while already open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const armDelete = () => {
    armedRef.current = true;
    setDeleteArmed(true);
    Animated.timing(armedOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  };
  const disarmDelete = () => {
    armedRef.current = false;
    setDeleteArmed(false);
    armedOpacity.setValue(0);
  };
  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };
  const startLongPressTimer = () => {
    if (!isOwnStories) return;
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      armDelete();
    }, LONG_PRESS_MS);
  };
  useEffect(() => clearLongPressTimer, []);

  // Read inside commit() without needing the raw-DOM gesture effect's dependency array to include
  // it (that effect only ever needs to be set up once per dragY/dragX identity, not re-bound every
  // time the measured distance to the ring changes).
  const latestFlightDistance = useRef(flightDistance);
  latestFlightDistance.current = flightDistance;

  // Actual pixel distance from this card's own current center up to the contact's ring — measured
  // rather than assumed, since the ring's screen position depends on the device's safe-area inset
  // as well as this card's own (also somewhat variable) position. Re-measures on every relayout,
  // which covers e.g. a rotation or a keyboard opening/closing.
  const onLayout = () => {
    if (flightTargetY == null) return;
    requestAnimationFrame(() => {
      wrapRef.current?.measureInWindow((_x, y, _width, height) => {
        const ownCenterY = y + height / 2;
        setFlightDistance(Math.max(140, ownCenterY - flightTargetY));
      });
    });
  };

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
    disarmDelete();
  };
  // The delete gesture's own commit — continues the photo on down past the card (rather than up
  // toward the ring, nothing to fly toward here) while squashing it flat (see crush's own
  // scaleY/scaleX below), reading as "crushed" rather than just slid away, then fades it out right
  // at the very end.
  const deleteCommit = () => {
    const deletedId = front.id;
    Animated.parallel([
      Animated.timing(dragY, { toValue: DELETE_TRAVEL_DISTANCE, duration: FLIGHT_DURATION_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(crush, { toValue: 1, duration: FLIGHT_DURATION_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      dragY.setValue(0);
      dragX.setValue(0);
      crush.setValue(0);
      disarmDelete();
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.add(deletedId);
        return next;
      });
      onDeleteStory?.(deletedId);
    });
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const springBackRef = useRef(springBack);
  springBackRef.current = springBack;
  const deleteCommitRef = useRef(deleteCommit);
  deleteCommitRef.current = deleteCommit;

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
      startLongPressTimer();
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
      const dx = p.x - startX;
      const dy = p.y - startY;
      if ((Math.abs(dx) > LONG_PRESS_SLOP || Math.abs(dy) > LONG_PRESS_SLOP) && longPressTimerRef.current) {
        clearLongPressTimer();
      }
      dragY.setValue(dy);
      dragX.setValue(dx);
    };
    const onUp = () => {
      if (startY === null) {
        reset();
        return;
      }
      const dy = lastY - startY;
      reset();
      clearLongPressTimer();
      if (armedRef.current) {
        if (dy > DELETE_COMMIT_DISTANCE || velocityY > DELETE_COMMIT_VELOCITY) {
          deleteCommitRef.current();
        } else {
          springBackRef.current();
        }
        return;
      }
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
        onPanResponderGrant: () => {
          if (Platform.OS === 'web') return;
          startLongPressTimer();
        },
        onPanResponderMove: (_, g) => {
          if (Platform.OS === 'web') return;
          if ((Math.abs(g.dx) > LONG_PRESS_SLOP || Math.abs(g.dy) > LONG_PRESS_SLOP) && longPressTimerRef.current) {
            clearLongPressTimer();
          }
          dragY.setValue(g.dy);
          dragX.setValue(g.dx);
        },
        onPanResponderRelease: (_, g) => {
          if (Platform.OS === 'web') return;
          clearLongPressTimer();
          if (armedRef.current) {
            if (g.dy > DELETE_COMMIT_DISTANCE || g.vy > DELETE_COMMIT_VELOCITY) {
              deleteCommitRef.current();
            } else {
              springBackRef.current();
            }
            return;
          }
          if (g.dy < -COMMIT_DISTANCE || g.vy < -COMMIT_VELOCITY) {
            commitRef.current();
          } else {
            springBackRef.current();
          }
        },
        onPanResponderTerminate: () => {
          if (Platform.OS === 'web') return;
          clearLongPressTimer();
          disarmDelete();
          springBackRef.current();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragY, dragX],
  );

  if (!front) return null;

  // The three extra (purely additive, see entryFront/entryBehind1/entryBehind2's own comment)
  // transform entries + opacity factor that give a layer its own falling-in entrance — identity
  // (no-op) once `entryValue` reaches 1, so this is always safe to splice onto any layer's existing
  // gesture-driven style, own-stories stack or not.
  const entryExtras = (entryValue: Animated.Value, startRotateDeg: number) => ({
    transform: [
      { translateY: entryValue.interpolate({ inputRange: [0, 1], outputRange: [-ENTRY_DROP_DISTANCE, 0], extrapolate: 'clamp' as const }) },
      { rotate: entryValue.interpolate({ inputRange: [0, 1], outputRange: [`${startRotateDeg}deg`, '0deg'], extrapolate: 'clamp' as const }) },
    ],
    opacity: entryValue.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' as const }),
  });
  const frontEntry = entryExtras(entryFront, ENTRY_START_ROTATE_DEG.front);
  const behind1Entry = entryExtras(entryBehind1, ENTRY_START_ROTATE_DEG.behind1);
  const behind2Entry = entryExtras(entryBehind2, ENTRY_START_ROTATE_DEG.behind2);

  const rotateDeg = Animated.add(
    dragY.interpolate({ inputRange: [-flightDistance, 0], outputRange: [-MAX_TILT_DEG, 0], extrapolate: 'clamp' }),
    dragX.interpolate({ inputRange: [-140, 0, 140], outputRange: [-6, 0, 6], extrapolate: 'clamp' }),
  );
  // The consume-flight's own recede scale (MIN_SCALE..1) — clamped, so this stays a constant 1
  // during delete's positive dragY, leaving `crush` below as the only thing shrinking it then.
  const dragYScale = dragY.interpolate({ inputRange: [-flightDistance, 0], outputRange: [MIN_SCALE, 1], extrapolate: 'clamp' });
  // The delete gesture's own "crush": squashes flat + splays wide first (like real paper being
  // pressed down on), then both axes shrink together the rest of the way to nothing as it
  // disappears — a no-op (1/1) outside of deleteCommit, since `crush` only ever moves there.
  const crushScaleY = crush.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, CRUSH_SCALE_Y, 0.05], extrapolate: 'clamp' });
  const crushScaleX = crush.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, CRUSH_SCALE_X, 0.05], extrapolate: 'clamp' });
  const frontStyle = {
    transform: [
      { translateY: dragY },
      { scaleY: Animated.multiply(dragYScale, crushScaleY) },
      { scaleX: Animated.multiply(dragYScale, crushScaleX) },
      { rotate: rotateDeg.interpolate({ inputRange: [-40, 0, 40], outputRange: ['-40deg', '0deg', '40deg'], extrapolate: 'clamp' }) },
      ...frontEntry.transform,
    ],
    opacity: Animated.multiply(
      dragY.interpolate({ inputRange: [-flightDistance, -flightDistance * 0.82, 0], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
      Animated.multiply(frontEntry.opacity, crush.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0], extrapolate: 'clamp' })),
    ),
  };
  // Stands in for a literal blur (RN has no reliable cross-platform per-node blur filter) — a soft
  // white veil that thickens as the card recedes, reading as "hazy/receding into the distance"
  // rather than perfectly sharp right up until it vanishes.
  const veilOpacity = dragY.interpolate({ inputRange: [-flightDistance, -flightDistance * 0.3, 0], outputRange: [0.55, 0.15, 0], extrapolate: 'clamp' });

  const restStyle = (rest: typeof REST_1, entry: ReturnType<typeof entryExtras>) => ({
    transform: [
      { translateY: dragY.interpolate({ inputRange: [-flightDistance, 0], outputRange: [0, rest.translateY], extrapolate: 'clamp' as const }) },
      { scale: dragY.interpolate({ inputRange: [-flightDistance, 0], outputRange: [1, rest.scale], extrapolate: 'clamp' as const }) },
      { rotate: dragY.interpolate({ inputRange: [-flightDistance, 0], outputRange: ['0deg', `${rest.rotate}deg`], extrapolate: 'clamp' as const }) },
      ...entry.transform,
    ],
    opacity: entry.opacity,
  });
  const behind1Style = {
    transform: [
      { translateY: dragY.interpolate({ inputRange: [-flightDistance, 0], outputRange: [REST_1.translateY, REST_2.translateY], extrapolate: 'clamp' as const }) },
      { scale: dragY.interpolate({ inputRange: [-flightDistance, 0], outputRange: [REST_1.scale, REST_2.scale], extrapolate: 'clamp' as const }) },
      { rotate: dragY.interpolate({ inputRange: [-flightDistance, 0], outputRange: [`${REST_1.rotate}deg`, `${REST_2.rotate}deg`], extrapolate: 'clamp' as const }) },
      ...behind1Entry.transform,
    ],
    opacity: behind1Entry.opacity,
  };

  return (
    <View ref={wrapRef} onLayout={onLayout} style={styles.root} {...panResponder.panHandlers}>
      <View style={[styles.clip, { backgroundColor: isNight ? throwNightColor.paper : throwColor.paper }]}>
        {behind2 && (
          <Animated.View style={[StyleSheet.absoluteFill, restStyle(REST_2, behind2Entry)]}>
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
        {/* The trash icon travels with the photo (it's drawn "on" it, per explicit request) — the
            hint text below deliberately isn't in here: it's pinned to the screen/card's own
            bottom, not the dragged photo's, so it stays put and readable no matter how far down
            the photo has already been dragged. */}
        {deleteArmed && (
          <Animated.View testID="delete-overlay" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.deleteOverlay, { opacity: armedOpacity }]}>
            <View style={styles.deleteIconWrap}>
              <Icon path={TRASH_ICON} size={30} color="#FFFFFF" strokeWidth={2} />
            </View>
          </Animated.View>
        )}
      </Animated.View>

      {deleteArmed && (
        <Animated.View pointerEvents="none" style={[styles.deleteHintWrap, { opacity: armedOpacity }]}>
          <Text style={styles.deleteHintText}>Flick the photo down to delete</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // No overflow constraint here — the front card needs to be able to visually travel up past its
  // own resting bounds toward the contact's ring in the carousel; only `clip`/`card` below (each
  // individually rounded) clip their own photo content.
  root: { flex: 1, position: 'relative' },
  clip: { ...StyleSheet.absoluteFill, borderRadius: throwRadius.paper, overflow: 'hidden' },
  card: { ...StyleSheet.absoluteFill, borderRadius: throwRadius.paper, overflow: 'hidden', ...throwColor.shadowSoft },
  veil: { backgroundColor: '#FFFFFF' },
  // The long-press-to-delete affordance (own stories only, see isOwnStories) — a dark veil so the
  // trash icon/hint read clearly over any photo, bright or dark.
  deleteOverlay: { backgroundColor: 'rgba(0,0,0,.35)', alignItems: 'center', justifyContent: 'center' },
  deleteIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pinned to the card's own bottom, not the (potentially already far-dragged) photo's — see the
  // render's own comment on why this is a sibling of `card`, not a child of it.
  deleteHintWrap: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
  deleteHintText: {
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
