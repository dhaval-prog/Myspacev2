import { useRef, useState } from 'react';
import { Animated, Easing, PanResponder, type PanResponderGestureState } from 'react-native';

export type CardPhase = 'idle' | 'pressed' | 'dragging' | 'valid' | 'invalid' | 'throwing' | 'snapping';

export interface DropZone {
  /** Window-absolute center of the discard pile. */
  x: number;
  y: number;
  /** A single forgiving radius — release anywhere inside it counts as "at the pile" (spec's inner+outer zones, simplified to one generous zone). */
  radius: number;
}

interface UseCardDragOptions {
  /** Whether this card can be picked up at all — false when it isn't the player's turn, or another action is in flight. */
  enabled: boolean;
  /** The result of game-rule validation for this exact card. The hook only ever displays this — it never decides legality itself. */
  isPlayable: boolean;
  /** Reads the current discard-pile drop zone; a function so it always sees the latest measured layout. */
  getDropZone: () => DropZone | null;
  /** Fires the actual play RPC. The hook awaits it purely to know whether to spring the card back on failure. */
  onPlay: () => Promise<{ error: string | null } | void>;
  /** A release with no meaningful drag — the card's tap behavior (open a wild-suit sheet, or play directly) belongs to the caller. */
  onTap?: () => void;
  /** Fires whenever this card starts/stops hovering a legal drop — used to glow the discard pile. */
  onHoverChange?: (hovering: boolean) => void;
}

// A plain tap needs zero hold time and zero drift to still register as a tap — either
// holding past LONG_PRESS_MS or moving past DRAG_THRESHOLD promotes the touch into a
// pick-up, whichever happens first, so both a deliberate hold-then-drag and a fast
// flick-without-pausing feel equally responsive.
const LONG_PRESS_MS = 260;
const DRAG_THRESHOLD = 8;
const MAX_ROTATE_DEG = 8;
// How far to lift the card once it's genuinely picked up (out of the stack, above its
// neighbours) — deliberately more than a light touch-feedback nudge.
const SELECT_LIFT_Y = 26;
// A hard upward swipe counts as "thrown at the pile" even if the release point falls a
// little short of the drop zone itself — matches a real flick, which is felt more by
// speed and distance than by pixel-perfect aim.
const FLICK_MIN_DISTANCE = 60;
const FLICK_MIN_VELOCITY = 0.5;

export function useCardDrag({ enabled, isPlayable, getDropZone, onPlay, onTap, onHoverChange }: UseCardDragOptions) {
  const [phase, setPhase] = useState<CardPhase>('idle');
  const phaseRef = useRef<CardPhase>('idle');
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const hoveringRef = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The PanResponder below is built exactly once (useRef's initializer only ever
  // runs on the first render), so any value its callbacks close over directly would
  // stay frozen at whatever it was when this card instance first mounted — including
  // `enabled`/`isPlayable`, which flip every time the turn changes. A card dealt on
  // someone else's turn would stay draggable forever, and one dealt as playable would
  // keep reporting "valid" after it stopped being legal, throwing at the server as a
  // rejected "not your turn" / illegal-card play. Route every value the responder
  // reads through a ref that's kept current on every render instead.
  const enabledRef = useRef(enabled);
  const isPlayableRef = useRef(isPlayable);
  const getDropZoneRef = useRef(getDropZone);
  const onPlayRef = useRef(onPlay);
  const onTapRef = useRef(onTap);
  const onHoverChangeRef = useRef(onHoverChange);
  enabledRef.current = enabled;
  isPlayableRef.current = isPlayable;
  getDropZoneRef.current = getDropZone;
  onPlayRef.current = onPlay;
  onTapRef.current = onTap;
  onHoverChangeRef.current = onHoverChange;

  const setPhaseBoth = (p: CardPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const resetVisual = (animated: boolean) => {
    if (!animated) {
      pan.setValue({ x: 0, y: 0 });
      scale.setValue(1);
      rotate.setValue(0);
      setPhaseBoth('idle');
      return;
    }
    Animated.parallel([
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 7, tension: 60 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 60 }),
      Animated.spring(rotate, { toValue: 0, useNativeDriver: true, friction: 7, tension: 60 }),
    ]).start(() => setPhaseBoth('idle'));
  };

  const shakeThenReset = () => {
    Animated.sequence([
      Animated.timing(pan.x, { toValue: 8, duration: 55, useNativeDriver: true }),
      Animated.timing(pan.x, { toValue: -8, duration: 90, useNativeDriver: true }),
      Animated.timing(pan.x, { toValue: 4, duration: 70, useNativeDriver: true }),
    ]).start(() => resetVisual(true));
  };

  // Promotes a still-held touch into a pick-up: the card zooms up out of the stack
  // and lifts above its neighbours. Callable either from the long-press timer (finger
  // hasn't moved yet) or from the move handler once the drag threshold is crossed —
  // whichever fires first — so it's a no-op if the card is already past 'pressed'.
  const enterDragging = () => {
    if (phaseRef.current !== 'pressed') return;
    clearLongPressTimer();
    setPhaseBoth('dragging');
    Animated.parallel([
      Animated.spring(scale, { toValue: 1.16, useNativeDriver: true, friction: 6, tension: 140 }),
      Animated.spring(pan.y, { toValue: -SELECT_LIFT_Y, useNativeDriver: true, friction: 6, tension: 140 }),
    ]).start();
  };

  // The successful "throw" — flies to the discard pile and settles with a little
  // squash-and-spring-back landing rather than just stopping dead.
  const throwToCenter = async (gesture: PanResponderGestureState) => {
    setPhaseBoth('throwing');
    const zone = getDropZoneRef.current();
    const targetX = zone ? gesture.dx + (zone.x - gesture.moveX) : gesture.dx;
    const targetY = zone ? gesture.dy - SELECT_LIFT_Y + (zone.y - gesture.moveY) : gesture.dy - SELECT_LIFT_Y;
    const speed = Math.hypot(gesture.vx, gesture.vy);
    const duration = Math.max(120, 260 - speed * 60);

    const playPromise = onPlayRef.current();
    Animated.parallel([
      Animated.timing(pan, { toValue: { x: targetX, y: targetY }, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.92, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 200 }),
      ]),
      Animated.timing(rotate, { toValue: 0, duration, useNativeDriver: true }),
    ]).start();

    const result = await playPromise;
    if (result && 'error' in result && result.error) {
      resetVisual(true);
    }
  };

  const panResponderRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => enabledRef.current,
      onStartShouldSetPanResponderCapture: () => enabledRef.current,
      onMoveShouldSetPanResponder: (_evt, g) => enabledRef.current && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
      onMoveShouldSetPanResponderCapture: (_evt, g) => enabledRef.current && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
      // The hand sits inside a horizontal ScrollView, which otherwise renegotiates and
      // steals the responder mid-drag the instant a gesture has any horizontal component
      // (a well-known PanResponder-inside-ScrollView gotcha) — refuse to give it up once granted.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        // No visual change yet — a plain tap should show nothing until it's proven to
        // be a hold or a drag, so it doesn't compete with a normal tap-to-play.
        setPhaseBoth('pressed');
        clearLongPressTimer();
        longPressTimer.current = setTimeout(() => {
          longPressTimer.current = null;
          enterDragging();
        }, LONG_PRESS_MS);
      },
      onPanResponderMove: (_evt, gesture) => {
        if (phaseRef.current === 'pressed') {
          const dist = Math.hypot(gesture.dx, gesture.dy);
          if (dist < DRAG_THRESHOLD) return;
          enterDragging();
        }

        pan.setValue({ x: gesture.dx, y: gesture.dy - SELECT_LIFT_Y });

        const zone = getDropZoneRef.current();
        const distToZone = zone ? Math.hypot(gesture.moveX - zone.x, gesture.moveY - zone.y) : Infinity;
        // Ramps from 0 (far away) to 1 (at the pile) over roughly three drop-zone
        // radii, so the card visibly straightens out as it approaches instead of
        // snapping upright only at the last pixel.
        const closeness = zone ? Math.max(0, Math.min(1, 1 - distToZone / (zone.radius * 3))) : 0;
        const rawRotate = Math.max(-MAX_ROTATE_DEG, Math.min(MAX_ROTATE_DEG, gesture.dx / 8));
        rotate.setValue(rawRotate * (1 - closeness));

        const hovering = !!zone && distToZone <= zone.radius;
        if (hovering !== hoveringRef.current) {
          hoveringRef.current = hovering;
          onHoverChangeRef.current?.(hovering && isPlayableRef.current);
        }
        const next: CardPhase = hovering ? (isPlayableRef.current ? 'valid' : 'invalid') : 'dragging';
        if (next !== phaseRef.current) setPhaseBoth(next);
      },
      onPanResponderRelease: async (_evt, gesture) => {
        const endedPhase = phaseRef.current;
        clearLongPressTimer();
        if (hoveringRef.current) {
          hoveringRef.current = false;
          onHoverChangeRef.current?.(false);
        }

        if (endedPhase === 'pressed') {
          resetVisual(true);
          onTapRef.current?.();
          return;
        }
        if (endedPhase === 'invalid') {
          setPhaseBoth('snapping');
          shakeThenReset();
          return;
        }
        if (endedPhase === 'valid') {
          await throwToCenter(gesture);
          return;
        }

        // Never reached the drop zone itself — a hard, fast upward flick still counts
        // as "thrown at the pile" (real flicks are felt by speed/distance, not exact aim).
        const flungUp = gesture.dy < -FLICK_MIN_DISTANCE && gesture.vy < -FLICK_MIN_VELOCITY;
        if (flungUp) {
          if (isPlayableRef.current) {
            await throwToCenter(gesture);
          } else {
            setPhaseBoth('snapping');
            shakeThenReset();
          }
          return;
        }

        setPhaseBoth('snapping');
        resetVisual(true);
      },
      onPanResponderTerminate: () => {
        clearLongPressTimer();
        if (hoveringRef.current) {
          hoveringRef.current = false;
          onHoverChangeRef.current?.(false);
        }
        resetVisual(true);
      },
    }),
  );

  const rotateDeg = rotate.interpolate({ inputRange: [-MAX_ROTATE_DEG, MAX_ROTATE_DEG], outputRange: [`-${MAX_ROTATE_DEG}deg`, `${MAX_ROTATE_DEG}deg`] });

  return {
    panHandlers: panResponderRef.current.panHandlers,
    phase,
    animatedStyle: {
      transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }, { rotate: rotateDeg }],
      zIndex: phase === 'idle' ? 1 : 50,
    },
  };
}
