import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Icon } from '../Icon';
import { throwColor, throwNightColor, throwRadius } from '../../theme/throwTokens';
import { noSelect } from '../../theme/webStyles';
import type { ThrowStory } from '../../types/story';

// Where a single status photo currently lives — the whole point of this component is animating a
// photo between these three, never a fourth. 'bin' is a *local* purgatory (see pendingDeleteRef's
// own comment below), not a real backend state.
type PhotoLocation = 'avatar' | 'letter' | 'bin';

const AVATAR_SIZE = 64;
const CORNER_FULL = 28;
const CORNER_CIRCLE = AVATAR_SIZE / 2;
// The stack's own resting-position formula, straight out of the interaction spec — card k places
// from the top (k=0 is the front/interactive one).
const STACK_TILT_DEG = [0, -3, 2.5, -2];
const STACK_X_STEP = 5;
const STACK_Y_STEP = -11;
const STACK_SCALE_STEP = 0.04;
const MAX_STACK_K = 3;
const STACK_EASING = Easing.bezier(0.2, 0.9, 0.25, 1.05);
const RESETTLE_MS = 380;

const DROP_STAGGER_MS = 190;
const DROP_DURATION_MS = 560;
const DROP_FADE_MS = 200;

// Swipe-up-to-return (any contact's stack, not just your own — this is a local view-state change,
// not a destructive one).
const RETURN_DRAG_MAX = 300;
const RETURN_DRAG_SCALE_MIN = 0.75;
const RETURN_COMMIT_DISTANCE = 80;
const RETURN_COMMIT_VELOCITY = 0.5;
const RETURN_FLIGHT_MS = 460;
const RETURN_EASING = Easing.bezier(0.5, 0, 0.2, 1);
const RETURN_FADE_MS = 160;

// Long-press + drag-down-to-delete (own stories only, see isOwnStories).
const LONG_PRESS_MS = 450;
const LONG_PRESS_SLOP = 10;
const DELETE_ARM_SCALE = 0.965;
const DELETE_DRAG_SCALE_MIN = 0.765;
const DELETE_DRAG_SCALE_RATIO = DELETE_DRAG_SCALE_MIN / DELETE_ARM_SCALE;
const DELETE_DRAG_RANGE = 190;
const DELETE_DRAG_MIN_OPACITY = 0.65;
const DELETE_COMMIT_DISTANCE = 100;
const DELETE_COMMIT_VELOCITY = 0.5;
const DELETE_END_SCALE = 0.2;
const DELETE_FLIGHT_MS = 320;
const DELETE_FLIGHT_EXTRA_PX = 240;
const DELETE_COMMIT_EASING = Easing.bezier(0.5, 0, 0.8, 0.4);

const TRASH_ICON = 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6.5M13.5 10.5v6.5';

function StoryVideoMedia({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <VideoView player={player as any} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} pointerEvents="none" />;
}

function StoryMedia({ story, testID }: { story: ThrowStory; testID?: string }) {
  if (story.mediaType === 'photo') {
    // pointerEvents="none" — react-native-web's Image renders a plain <img>, natively draggable
    // by browsers by default; without this, a drag starting over it triggers the browser's own
    // HTML5 image-drag instead of a regular pointer gesture.
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image testID={testID} source={{ uri: story.mediaUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </View>
    );
  }
  return <StoryVideoMedia uri={story.mediaUrl} />;
}

interface CardAnim {
  /** 0 = a 64px circle sitting at the avatar; 1 = the full letter card. Only ever moves during a
   * drop-in (0→1) or a return-to-avatar flight (1→0) — otherwise parked at 1. Drives width/
   * height/borderRadius/center, i.e. the one thing RN can't do the CSS-percentage-radius way, so
   * it's animated as real layout geometry instead (JS-driven, see the render's own comment). */
  boxProgress: Animated.Value;
  /** This card's own settled position in the stack (translate/rotate/scale for its current k) —
   * retargeted via settleCard() whenever k changes, independent of any live gesture. */
  stackX: Animated.Value;
  stackY: Animated.Value;
  stackRotate: Animated.Value;
  stackScale: Animated.Value;
  /** Live/animated vertical gesture offset — only ever driven for whichever card is currently on
   * top (letterOrder[0]); every other card's stays permanently 0, making every interpolation
   * below a no-op for them without needing to special-case "is this the top card". Negative while
   * lifting (swipe-up-return), positive while armed-and-dragging (delete). */
  dragY: Animated.Value;
  /** 1 → DELETE_ARM_SCALE the instant a long-press arms delete, before any drag distance. */
  armScale: Animated.Value;
  /** 1 → DELETE_END_SCALE/DELETE_DRAG_SCALE_MIN, only moves during the final delete-commit
   * flight — multiplies on top of the drag-driven shrink so the card keeps shrinking smoothly
   * from wherever the drag left it down to DELETE_END_SCALE. */
  commitScale: Animated.Value;
  /** The 28% black delete-armed overlay's own opacity. */
  dim: Animated.Value;
  opacity: Animated.Value;
}

function makeCardAnim(): CardAnim {
  return {
    boxProgress: new Animated.Value(1),
    stackX: new Animated.Value(0),
    stackY: new Animated.Value(0),
    stackRotate: new Animated.Value(0),
    stackScale: new Animated.Value(1),
    dragY: new Animated.Value(0),
    armScale: new Animated.Value(1),
    commitScale: new Animated.Value(1),
    dim: new Animated.Value(0),
    opacity: new Animated.Value(1),
  };
}

function stackTarget(k: number) {
  return {
    x: k * STACK_X_STEP,
    y: k * STACK_Y_STEP,
    rotate: STACK_TILT_DEG[Math.min(k, STACK_TILT_DEG.length - 1)] ?? 0,
    scale: 1 - k * STACK_SCALE_STEP,
  };
}

interface ContactStoryStackProps {
  /** Oldest-first, same convention every other story component in Throw already uses. */
  stories: ThrowStory[];
  isNight?: boolean;
  /** First/display name, for the empty-state copy ("Tap {name}'s status to open"). */
  contactName: string;
  /** The selected contact's own avatar center, in absolute screen coordinates (see
   * ThrowHomeScreen's own flightTargetX/storyFlightTargetY) — every photo's circle-shaped
   * avatar/letter morph animates to/from this exact point. */
  flightTargetX: number;
  flightTargetY: number;
  /** Increments every time the (already-open) contact's avatar is tapped — each change drops
   * whatever's currently sitting in the avatar into the letter, staggered 190ms apart. Also
   * covers the very first open, since this effect runs on mount too. */
  dropSignal: number;
  /** Fired once, right as each story lands in the letter. */
  onViewed?: (storyId: string) => void;
  /** True only while viewing your OWN posted stories — the only case where the delete gesture
   * (long-press + drag down) is available; a viewer can't delete someone else's status. */
  isOwnStories?: boolean;
  /** Fired once a deleted photo's local undo window has actually closed (this component unmounts
   * or restores it first — see pendingDeleteRef's own comment) — this is when the real backend
   * delete actually happens. */
  onDeleteStory?: (storyId: string) => void;
  /** However many of this contact's photos are still sitting in the avatar right now — mirrors
   * RecipientCarousel's own count badge/ring for the open contact without that component needing
   * to know anything about this one's internal state. */
  onAvatarCountChange?: (count: number) => void;
  /** Fired whenever the avatar should do its own little scale pulse (a photo just landed in the
   * letter, or one just flew back into it). */
  onPulseAvatar?: () => void;
  /** Fired the instant the letter becomes empty — whether the last card was deleted or just
   * swiped back up into the avatar — so the parent can leave story mode immediately and show the
   * compose letter instead of this component's own "Tap X's status to open" / "Status deleted"
   * placeholder. */
  onLetterEmptied?: () => void;
}

/**
 * The "letter" photo stack — replaces the compose letter, in the same card, while viewing a
 * contact's (any contact's, including your own) posted stories. Every photo lives in exactly one
 * of three places (avatar / letter / bin, see PhotoLocation) rather than being "watched once and
 * gone": tapping the contact's avatar drops whatever's still there into the letter one at a time;
 * swiping the top card up sends it back into the avatar; long-pressing then dragging down (own
 * stories only) deletes it. The parent otherwise only leaves story mode when the user picks a
 * different contact — except the instant the letter itself empties out (by either of those last
 * two gestures), which hands control straight back to the parent (see onLetterEmptied) instead of
 * showing an empty placeholder here.
 */
export function ContactStoryStack({
  stories,
  isNight,
  contactName,
  flightTargetX,
  flightTargetY,
  dropSignal,
  onViewed,
  isOwnStories,
  onDeleteStory,
  onAvatarCountChange,
  onPulseAvatar,
  onLetterEmptied,
}: ContactStoryStackProps) {
  const onLetterEmptiedRef = useRef(onLetterEmptied);
  onLetterEmptiedRef.current = onLetterEmptied;
  const [locations, setLocationsState] = useState<Map<string, PhotoLocation>>(() => new Map(stories.map((s) => [s.id, 'avatar' as PhotoLocation])));
  const locationsRef = useRef(locations);
  locationsRef.current = locations;
  const setLocation = (id: string, loc: PhotoLocation) =>
    setLocationsState((prev) => {
      const next = new Map(prev);
      next.set(id, loc);
      return next;
    });

  const [letterOrder, setLetterOrder] = useState<string[]>([]);
  const letterOrderRef = useRef(letterOrder);
  letterOrderRef.current = letterOrder;

  // Any id currently ever seen, so a fresh mount's initial dropSignal effect (and the resync
  // effect below) can tell "genuinely new" apart from "already tracked".
  useEffect(() => {
    const ids = new Set(stories.map((s) => s.id));
    setLocationsState((prev) => {
      let changed = false;
      const next = new Map(prev);
      ids.forEach((id) => {
        if (!next.has(id)) {
          next.set(id, 'avatar');
          changed = true;
        }
      });
      Array.from(next.keys()).forEach((id) => {
        if (!ids.has(id)) {
          next.delete(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setLetterOrder((prev) => prev.filter((id) => ids.has(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stories]);

  // Deleted locally the instant delete commits, but the real backend delete (onDeleteStory) is
  // deferred until this component unmounts (switching to a different contact) or the photo is
  // explicitly restored first — the only way "Bring them back" can actually mean it, since Throw
  // has no soft-delete/undo concept server-side.
  const pendingDeleteRef = useRef<Set<string>>(new Set());
  const onDeleteStoryRef = useRef(onDeleteStory);
  onDeleteStoryRef.current = onDeleteStory;
  useEffect(
    () => () => {
      pendingDeleteRef.current.forEach((id) => onDeleteStoryRef.current?.(id));
    },
    [],
  );

  const isOwnStoriesRef = useRef(isOwnStories);
  isOwnStoriesRef.current = isOwnStories;
  const onPulseAvatarRef = useRef(onPulseAvatar);
  onPulseAvatarRef.current = onPulseAvatar;
  const onViewedRef = useRef(onViewed);
  onViewedRef.current = onViewed;

  const animsRef = useRef<Map<string, CardAnim>>(new Map());
  const getOrCreateAnim = (id: string): CardAnim => {
    let anim = animsRef.current.get(id);
    if (!anim) {
      anim = makeCardAnim();
      animsRef.current.set(id, anim);
    }
    return anim;
  };

  const settleCard = (id: string, idx: number, ms = RESETTLE_MS) => {
    const anim = getOrCreateAnim(id);
    const target = stackTarget(Math.min(MAX_STACK_K, idx));
    Animated.parallel([
      Animated.timing(anim.stackX, { toValue: target.x, duration: ms, easing: STACK_EASING, useNativeDriver: false }),
      Animated.timing(anim.stackY, { toValue: target.y, duration: ms, easing: STACK_EASING, useNativeDriver: false }),
      Animated.timing(anim.stackRotate, { toValue: target.rotate, duration: ms, easing: STACK_EASING, useNativeDriver: false }),
      Animated.timing(anim.stackScale, { toValue: target.scale, duration: ms, easing: STACK_EASING, useNativeDriver: false }),
    ]).start();
  };

  const dropCard = (id: string, idx: number) => {
    const anim = getOrCreateAnim(id);
    const target = stackTarget(Math.min(MAX_STACK_K, idx));
    anim.boxProgress.setValue(0);
    anim.stackX.setValue(0);
    anim.stackY.setValue(0);
    anim.stackRotate.setValue(0);
    anim.stackScale.setValue(1);
    anim.dragY.setValue(0);
    anim.armScale.setValue(1);
    anim.commitScale.setValue(1);
    anim.dim.setValue(0);
    anim.opacity.setValue(0);
    Animated.parallel([
      Animated.timing(anim.boxProgress, { toValue: 1, duration: DROP_DURATION_MS, easing: STACK_EASING, useNativeDriver: false }),
      Animated.timing(anim.stackX, { toValue: target.x, duration: DROP_DURATION_MS, easing: STACK_EASING, useNativeDriver: false }),
      Animated.timing(anim.stackY, { toValue: target.y, duration: DROP_DURATION_MS, easing: STACK_EASING, useNativeDriver: false }),
      Animated.timing(anim.stackRotate, { toValue: target.rotate, duration: DROP_DURATION_MS, easing: STACK_EASING, useNativeDriver: false }),
      Animated.timing(anim.stackScale, { toValue: target.scale, duration: DROP_DURATION_MS, easing: STACK_EASING, useNativeDriver: false }),
      Animated.timing(anim.opacity, { toValue: 1, duration: DROP_FADE_MS, useNativeDriver: false }),
    ]).start();
  };

  // 1) Tap avatar → drop whatever's still in the avatar into the letter, most-recently-posted
  // first (so it ends up on top — matches every other Throw story component's own "newest on
  // top" convention), each one landing under the ones already there.
  const dropTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const mostRecentFirst = [...stories].reverse();
    const toDrop = mostRecentFirst.filter((s) => (locationsRef.current.get(s.id) ?? 'avatar') === 'avatar');
    toDrop.forEach((story, n) => {
      const timer = setTimeout(() => {
        setLocation(story.id, 'letter');
        setLetterOrder((prev) => {
          const next = [...prev, story.id];
          dropCard(story.id, next.length - 1);
          return next;
        });
        onViewedRef.current?.(story.id);
        onPulseAvatarRef.current?.();
      }, n * DROP_STAGGER_MS);
      dropTimersRef.current.push(timer);
    });
    return () => {
      dropTimersRef.current.forEach(clearTimeout);
      dropTimersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropSignal]);

  // 2) Swipe top photo up → flies back into the avatar as a circle.
  const returnToAvatar = (id: string) => {
    const anim = getOrCreateAnim(id);
    Animated.parallel([
      Animated.timing(anim.dragY, { toValue: 0, duration: RETURN_FLIGHT_MS, easing: RETURN_EASING, useNativeDriver: false }),
      Animated.timing(anim.boxProgress, { toValue: 0, duration: RETURN_FLIGHT_MS, easing: RETURN_EASING, useNativeDriver: false }),
      Animated.timing(anim.opacity, { toValue: 0, duration: RETURN_FADE_MS, delay: Math.max(0, RETURN_FLIGHT_MS - RETURN_FADE_MS), useNativeDriver: false }),
    ]).start(() => {
      animsRef.current.delete(id);
      setLocation(id, 'avatar');
      const next = letterOrderRef.current.filter((x) => x !== id);
      next.forEach((otherId, idx) => settleCard(otherId, idx));
      setLetterOrder(next);
      onPulseAvatarRef.current?.();
      if (next.length === 0) onLetterEmptiedRef.current?.();
    });
  };
  const springBackTop = (id: string) => {
    const anim = getOrCreateAnim(id);
    Animated.spring(anim.dragY, { toValue: 0, useNativeDriver: false, friction: 8, tension: 60 }).start();
  };

  // 3) Long-press + drag down → delete (own stories only).
  const [armedId, setArmedId] = useState<string | null>(null);
  const [hot, setHot] = useState(false);
  const ringPulse = useRef(new Animated.Value(0)).current;
  const ringPulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const armDelete = (id: string) => {
    const anim = getOrCreateAnim(id);
    setArmedId(id);
    setHot(false);
    Animated.timing(anim.armScale, { toValue: DELETE_ARM_SCALE, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    Animated.timing(anim.dim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    ringPulse.setValue(0);
    ringPulseLoop.current?.stop();
    ringPulseLoop.current = Animated.loop(Animated.timing(ringPulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: false }));
    ringPulseLoop.current.start();
  };
  const resetDelete = (id: string) => {
    const anim = getOrCreateAnim(id);
    setArmedId(null);
    setHot(false);
    ringPulseLoop.current?.stop();
    Animated.timing(anim.armScale, { toValue: 1, duration: 200, useNativeDriver: false }).start();
    Animated.timing(anim.dim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
    Animated.spring(anim.dragY, { toValue: 0, useNativeDriver: false, friction: 8, tension: 60 }).start();
  };
  const deleteCommit = (id: string, currentDy: number) => {
    const anim = getOrCreateAnim(id);
    setArmedId(null);
    setHot(false);
    ringPulseLoop.current?.stop();
    Animated.parallel([
      Animated.timing(anim.dragY, { toValue: currentDy + DELETE_FLIGHT_EXTRA_PX, duration: DELETE_FLIGHT_MS, easing: DELETE_COMMIT_EASING, useNativeDriver: false }),
      Animated.timing(anim.commitScale, { toValue: DELETE_END_SCALE / DELETE_DRAG_SCALE_MIN, duration: DELETE_FLIGHT_MS, easing: DELETE_COMMIT_EASING, useNativeDriver: false }),
      Animated.timing(anim.opacity, { toValue: 0, duration: DELETE_FLIGHT_MS, easing: DELETE_COMMIT_EASING, useNativeDriver: false }),
    ]).start(() => {
      animsRef.current.delete(id);
      setLocation(id, 'bin');
      pendingDeleteRef.current.add(id);
      const next = letterOrderRef.current.filter((x) => x !== id);
      next.forEach((otherId, idx) => settleCard(otherId, idx));
      setLetterOrder(next);
      if (next.length === 0) onLetterEmptiedRef.current?.();
    });
  };

  // react-native-web's PanResponder polyfill has the same touch-history dedupe bug documented
  // elsewhere in Throw (FoldingLetter's own raw-DOM-listener effect) — sidesteps it the same way,
  // with raw mouse/touch listeners bound once on the whole stack container. Which card is "live"
  // is resolved fresh on every gesture start (letterOrderRef.current[0]) rather than needing to
  // rebind whenever the top card changes — the same approach the interaction spec's own reference
  // implementation uses.
  const wrapRef = useRef<View>(null);
  type GestureState = 'idle' | 'lift' | 'armed' | 'drag' | 'cancelled';
  const gsRef = useRef<GestureState>('idle');
  const gsCardIdRef = useRef<string | null>(null);
  const gsStartRef = useRef({ x: 0, y: 0 });
  const gsLastRef = useRef({ y: 0, t: 0 });
  const gsVelocityRef = useRef(0);
  const gsRawRef = useRef(0);
  const gsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearGsTimer = () => {
    if (gsTimerRef.current) {
      clearTimeout(gsTimerRef.current);
      gsTimerRef.current = null;
    }
  };

  const gestureStart = (x: number, y: number) => {
    const cardId = letterOrderRef.current[0];
    if (!cardId) return;
    gsCardIdRef.current = cardId;
    gsRef.current = 'idle';
    gsStartRef.current = { x, y };
    gsLastRef.current = { y, t: Date.now() };
    gsVelocityRef.current = 0;
    gsRawRef.current = 0;
    clearGsTimer();
    if (isOwnStoriesRef.current) {
      gsTimerRef.current = setTimeout(() => {
        gsTimerRef.current = null;
        if (gsCardIdRef.current) {
          gsRef.current = 'armed';
          armDelete(gsCardIdRef.current);
        }
      }, LONG_PRESS_MS);
    }
  };
  const gestureMove = (x: number, y: number) => {
    const cardId = gsCardIdRef.current;
    if (!cardId) return;
    const anim = getOrCreateAnim(cardId);
    const now = Date.now();
    const dt = now - gsLastRef.current.t;
    if (dt > 0) gsVelocityRef.current = (y - gsLastRef.current.y) / dt;
    gsLastRef.current = { y, t: now };
    const dx = x - gsStartRef.current.x;
    const raw = y - gsStartRef.current.y;
    gsRawRef.current = raw;

    if (gsRef.current === 'idle') {
      if (raw < -LONG_PRESS_SLOP) {
        clearGsTimer();
        gsRef.current = 'lift';
      } else if (Math.abs(dx) > LONG_PRESS_SLOP || Math.abs(raw) > LONG_PRESS_SLOP) {
        clearGsTimer();
        gsRef.current = 'cancelled';
      }
    }
    if (gsRef.current === 'lift') {
      anim.dragY.setValue(Math.min(0, raw));
      return;
    }
    if (gsRef.current !== 'armed' && gsRef.current !== 'drag') return;
    const dy = Math.max(0, raw);
    if (dy > 4 && gsRef.current === 'armed') gsRef.current = 'drag';
    if (gsRef.current === 'drag') {
      anim.dragY.setValue(dy);
      const nextHot = dy > DELETE_COMMIT_DISTANCE;
      setHot((prev) => (prev === nextHot ? prev : nextHot));
    }
  };
  const gestureEnd = () => {
    const cardId = gsCardIdRef.current;
    const state = gsRef.current;
    const vel = gsVelocityRef.current;
    const raw = gsRawRef.current;
    clearGsTimer();
    gsCardIdRef.current = null;
    gsRef.current = 'idle';
    if (!cardId) return;
    if (state === 'lift') {
      const ly = Math.min(0, raw);
      if (ly < -RETURN_COMMIT_DISTANCE || vel < -RETURN_COMMIT_VELOCITY) returnToAvatar(cardId);
      else springBackTop(cardId);
      return;
    }
    if (state === 'armed') {
      resetDelete(cardId);
      return;
    }
    if (state === 'drag') {
      const dy = Math.max(0, raw);
      if (dy > DELETE_COMMIT_DISTANCE || vel > DELETE_COMMIT_VELOCITY) deleteCommit(cardId, dy);
      else resetDelete(cardId);
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = wrapRef.current as any as HTMLElement | null;
    if (!node) return;
    const getPoint = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if ('touches' in e && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if ('changedTouches' in e && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      if ('clientX' in e) return { x: e.clientX, y: e.clientY };
      return null;
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const p = getPoint(e);
      if (p) gestureStart(p.x, p.y);
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      const p = getPoint(e);
      if (p) gestureMove(p.x, p.y);
    };
    const onUp = () => gestureEnd();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => Platform.OS !== 'web',
        onMoveShouldSetPanResponder: () => Platform.OS !== 'web',
        onPanResponderGrant: (e) => {
          if (Platform.OS === 'web') return;
          gestureStart(e.nativeEvent.pageX, e.nativeEvent.pageY);
        },
        onPanResponderMove: (e) => {
          if (Platform.OS === 'web') return;
          gestureMove(e.nativeEvent.pageX, e.nativeEvent.pageY);
        },
        onPanResponderRelease: () => {
          if (Platform.OS === 'web') return;
          gestureEnd();
        },
        onPanResponderTerminate: () => {
          if (Platform.OS === 'web') return;
          const cardId = gsCardIdRef.current;
          clearGsTimer();
          gsCardIdRef.current = null;
          gsRef.current = 'idle';
          if (cardId) resetDelete(cardId);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Measures the card area's own on-screen rect so the avatar's absolute screen position can be
  // translated into this container's local coordinate space (see boxProgress's own center
  // interpolation below) — re-measures on every relayout, same reasoning ContactStoryStack has
  // always used for its flight target.
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const measure = () => {
    requestAnimationFrame(() => {
      wrapRef.current?.measureInWindow((x, y, width, height) => setRect({ x, y, width, height }));
    });
  };
  useEffect(measure, [flightTargetX, flightTargetY]);

  const avatarCount = useMemo(() => stories.filter((s) => (locations.get(s.id) ?? 'avatar') === 'avatar').length, [stories, locations]);
  const binnedCount = useMemo(() => stories.filter((s) => locations.get(s.id) === 'bin').length, [stories, locations]);
  const onAvatarCountChangeRef = useRef(onAvatarCountChange);
  onAvatarCountChangeRef.current = onAvatarCountChange;
  useEffect(() => {
    onAvatarCountChangeRef.current?.(avatarCount);
  }, [avatarCount]);

  const handleRestore = () => {
    const binnedIds = stories.filter((s) => locations.get(s.id) === 'bin').map((s) => s.id);
    if (binnedIds.length === 0) return;
    binnedIds.forEach((id) => {
      pendingDeleteRef.current.delete(id);
      setLocation(id, 'avatar');
    });
    onPulseAvatarRef.current?.();
  };

  const cardW = rect?.width ?? 300;
  const cardH = rect?.height ?? 260;
  const cardCenterX = cardW / 2;
  const cardCenterY = cardH / 2;
  const avatarLocalX = rect ? flightTargetX - rect.x : cardCenterX;
  const avatarLocalY = rect ? flightTargetY - rect.y : cardCenterY;

  const renderCard = (id: string, idx: number) => {
    const anim = getOrCreateAnim(id);
    const story = stories.find((s) => s.id === id);
    if (!story) return null;

    const width = anim.boxProgress.interpolate({ inputRange: [0, 1], outputRange: [AVATAR_SIZE, cardW] });
    const height = anim.boxProgress.interpolate({ inputRange: [0, 1], outputRange: [AVATAR_SIZE, cardH] });
    const centerX = anim.boxProgress.interpolate({ inputRange: [0, 1], outputRange: [avatarLocalX, cardCenterX] });
    const centerY = anim.boxProgress.interpolate({ inputRange: [0, 1], outputRange: [avatarLocalY, cardCenterY] });
    const left = Animated.subtract(centerX, Animated.divide(width, 2));
    const top = Animated.subtract(centerY, Animated.divide(height, 2));
    const baseRadius = anim.boxProgress.interpolate({ inputRange: [0, 1], outputRange: [CORNER_CIRCLE, CORNER_FULL] });
    // "Corners get rounder" while lifting (swipe-up-return) — only the lift direction of dragY
    // (negative) contributes; the delete-drag direction (positive) never touches this.
    const liftT = anim.dragY.interpolate({ inputRange: [-RETURN_DRAG_MAX, 0], outputRange: [1, 0], extrapolate: 'clamp' });
    const cornerBoost = liftT.interpolate({ inputRange: [0, 1], outputRange: [0, 60] });
    const radius = Animated.add(baseRadius, cornerBoost);

    const liftScale = liftT.interpolate({ inputRange: [0, 1], outputRange: [1, RETURN_DRAG_SCALE_MIN] });
    const liftRotateDeg = liftT.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
    const dragScale = anim.dragY.interpolate({ inputRange: [0, DELETE_DRAG_RANGE], outputRange: [1, DELETE_DRAG_SCALE_RATIO], extrapolate: 'clamp' });
    const dragOpacity = anim.dragY.interpolate({ inputRange: [0, DELETE_DRAG_RANGE], outputRange: [1, DELETE_DRAG_MIN_OPACITY], extrapolate: 'clamp' });

    const totalRotateDeg = Animated.add(anim.stackRotate, liftRotateDeg);
    const scale = Animated.multiply(Animated.multiply(anim.stackScale, anim.armScale), Animated.multiply(anim.commitScale, Animated.multiply(dragScale, liftScale)));
    const translateY = Animated.add(anim.stackY, anim.dragY);

    return (
      <Animated.View
        key={id}
        pointerEvents={idx === 0 ? 'auto' : 'none'}
        style={[
          styles.cardBox,
          noSelect,
          {
            left,
            top,
            width,
            height,
            borderRadius: radius,
            opacity: Animated.multiply(anim.opacity, dragOpacity),
            transform: [
              { translateX: anim.stackX },
              { translateY },
              { rotate: totalRotateDeg.interpolate({ inputRange: [-60, 60], outputRange: ['-60deg', '60deg'] }) },
              { scale },
            ],
          },
        ]}
      >
        <StoryMedia story={story} testID={idx === 0 ? 'contact-story-image' : undefined} />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, { opacity: anim.dim }]} />
      </Animated.View>
    );
  };

  const cardElements = letterOrder.map((id, idx) => renderCard(id, idx)).reverse();

  const showEmpty = letterOrder.length === 0;
  const firstName = contactName.split(' ')[0] || contactName;
  const emptyText = avatarCount > 0 ? `Tap ${firstName}'s status to open` : binnedCount > 0 ? 'Status deleted' : 'No status yet';

  const ringScale = ringPulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.35] });
  const ringOpacity = ringPulse.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.6, 0.22, 0] });

  return (
    <View ref={wrapRef} onLayout={measure} style={[styles.root, noSelect]} {...panResponder.panHandlers}>
      {showEmpty && (
        <View style={styles.emptyWrap} pointerEvents="box-none">
          <Text style={[styles.emptyText, isNight && styles.emptyTextNight]}>{emptyText}</Text>
          {avatarCount === 0 && binnedCount > 0 && (
            <Pressable onPress={handleRestore} style={[styles.restoreButton, isNight && styles.restoreButtonNight]} hitSlop={8}>
              <Text style={[styles.restoreButtonText, isNight && styles.restoreButtonTextNight]}>Bring them back</Text>
            </Pressable>
          )}
        </View>
      )}

      {cardElements}

      {armedId && (
        <View pointerEvents="none" style={[styles.deleteTargetWrap, { left: cardCenterX - 46, top: cardCenterY - 46 }]}>
          <Animated.View style={[styles.deleteRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
          <View style={[styles.deleteDisc, hot && styles.deleteDiscHot]}>
            <Icon path={TRASH_ICON} size={30} color={hot ? throwColor.ink : '#FFFFFF'} strokeWidth={2} />
          </View>
          <Text style={styles.deleteLabel}>{hot ? 'RELEASE TO DELETE' : 'DRAG DOWN TO DELETE'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: 'relative' },
  cardBox: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: throwColor.cardBg,
    ...throwColor.shadowSoft,
  },
  dim: { backgroundColor: 'rgba(0,0,0,.28)' },
  emptyWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: throwRadius.paper,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,.14)',
    backgroundColor: 'rgba(255,255,255,.4)',
  },
  emptyText: { fontSize: 14, fontWeight: '700', color: throwColor.ink, textAlign: 'center', paddingHorizontal: 24 },
  emptyTextNight: { color: throwNightColor.ink },
  restoreButton: { height: 40, paddingHorizontal: 18, borderRadius: 999, backgroundColor: throwColor.ink, alignItems: 'center', justifyContent: 'center' },
  restoreButtonNight: { backgroundColor: throwNightColor.iconBg },
  restoreButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  restoreButtonTextNight: { color: throwNightColor.ink },
  deleteTargetWrap: { position: 'absolute', width: 92, height: 92, alignItems: 'center' },
  deleteRing: { position: 'absolute', top: 0, left: 0, width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: 'rgba(255,255,255,.9)' },
  deleteDisc: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(17,17,17,.72)',
    alignItems: 'center',
    justifyContent: 'center',
    ...throwColor.shadowSoft,
  },
  deleteDiscHot: { backgroundColor: '#FFFFFF' },
  deleteLabel: {
    position: 'absolute',
    top: 104,
    width: 180,
    left: -44,
    textAlign: 'center',
    fontSize: 10.5,
    letterSpacing: 1,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,.6)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
});
