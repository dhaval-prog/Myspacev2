import { useRef, useState } from 'react';
import { Animated, Easing, PanResponder } from 'react-native';

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

const DRAG_THRESHOLD = 8;
const MAX_ROTATE_DEG = 8;
const LIFT_Y = 10;

export function useCardDrag({ enabled, isPlayable, getDropZone, onPlay, onTap, onHoverChange }: UseCardDragOptions) {
  const [phase, setPhase] = useState<CardPhase>('idle');
  const phaseRef = useRef<CardPhase>('idle');
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const hoveringRef = useRef(false);

  const setPhaseBoth = (p: CardPhase) => {
    phaseRef.current = p;
    setPhase(p);
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

  const panResponderRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => enabled,
      onStartShouldSetPanResponderCapture: () => enabled,
      onMoveShouldSetPanResponder: (_evt, g) => enabled && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
      onMoveShouldSetPanResponderCapture: (_evt, g) => enabled && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
      // The hand sits inside a horizontal ScrollView, which otherwise renegotiates and
      // steals the responder mid-drag the instant a gesture has any horizontal component
      // (a well-known PanResponder-inside-ScrollView gotcha) — refuse to give it up once granted.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setPhaseBoth('pressed');
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.08, duration: 120, useNativeDriver: true }),
          Animated.timing(pan.y, { toValue: -LIFT_Y, duration: 120, useNativeDriver: true }),
        ]).start();
      },
      onPanResponderMove: (_evt, gesture) => {
        const dist = Math.hypot(gesture.dx, gesture.dy);
        if (phaseRef.current === 'pressed' && dist < DRAG_THRESHOLD) return;
        if (phaseRef.current === 'pressed') {
          setPhaseBoth('dragging');
          Animated.timing(scale, { toValue: 1.15, duration: 100, useNativeDriver: true }).start();
        }
        pan.setValue({ x: gesture.dx, y: gesture.dy - LIFT_Y });
        rotate.setValue(Math.max(-MAX_ROTATE_DEG, Math.min(MAX_ROTATE_DEG, gesture.dx / 8)));

        const zone = getDropZone();
        const hovering = !!zone && Math.hypot(gesture.moveX - zone.x, gesture.moveY - zone.y) <= zone.radius;
        if (hovering !== hoveringRef.current) {
          hoveringRef.current = hovering;
          onHoverChange?.(hovering && isPlayable);
        }
        const next: CardPhase = hovering ? (isPlayable ? 'valid' : 'invalid') : 'dragging';
        if (next !== phaseRef.current) setPhaseBoth(next);
      },
      onPanResponderRelease: async (_evt, gesture) => {
        const endedPhase = phaseRef.current;
        if (hoveringRef.current) {
          hoveringRef.current = false;
          onHoverChange?.(false);
        }

        if (endedPhase === 'pressed') {
          resetVisual(true);
          onTap?.();
          return;
        }
        if (endedPhase === 'invalid') {
          setPhaseBoth('snapping');
          shakeThenReset();
          return;
        }
        if (endedPhase !== 'valid') {
          setPhaseBoth('snapping');
          resetVisual(true);
          return;
        }

        // A legal card released at the pile — throw it home. Speed of the release
        // shortens/lengthens the flight so a fast swipe reads as a harder throw.
        // The card keeps rendering at its normal hand slot underneath this transform
        // until the server confirms and the real hand shrinks — no separate
        // optimistic-hide bookkeeping needed, since a failed play just springs back.
        setPhaseBoth('throwing');
        const zone = getDropZone();
        const targetX = zone ? gesture.dx + (zone.x - gesture.moveX) : gesture.dx;
        const targetY = zone ? gesture.dy - LIFT_Y + (zone.y - gesture.moveY) : gesture.dy - LIFT_Y;
        const speed = Math.hypot(gesture.vx, gesture.vy);
        const duration = Math.max(140, 300 - speed * 60);

        const playPromise = onPlay();
        Animated.parallel([
          Animated.timing(pan, { toValue: { x: targetX, y: targetY }, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.92, duration, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 0, duration, useNativeDriver: true }),
        ]).start();

        const result = await playPromise;
        if (result && 'error' in result && result.error) {
          resetVisual(true);
        }
      },
      onPanResponderTerminate: () => {
        if (hoveringRef.current) {
          hoveringRef.current = false;
          onHoverChange?.(false);
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
