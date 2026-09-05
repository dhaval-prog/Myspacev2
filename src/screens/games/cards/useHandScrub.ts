import { useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

interface UseHandScrubOptions {
  /** Whether the hand can be browsed/tapped at all — false when it isn't the player's turn, or another action is in flight. */
  enabled: boolean;
  /** Current number of cards in the hand — sizes the per-card animated scale values. */
  count: number;
  /** The resting x-position of card `index`'s center, in the same coordinate space as the gesture overlay's own touch events. */
  getSlotX: (index: number) => number;
  /** A release with no meaningful movement landed on card `index` — the caller's tap-to-play behaviour. */
  onTapCard: (index: number) => void;
  /** Fires whenever the card currently "under the finger" while browsing changes, so its slot can be raised above its neighbours. */
  onActiveIndexChange?: (index: number | null) => void;
  /** A hard, fast upward flick released while card `index` was the one being browsed — the caller's throw-to-center behaviour. */
  onFlickCard?: (index: number) => void;
}

// Below this much combined finger travel, a touch is still a candidate for a plain
// tap — past it, the gesture has committed to browsing and a release no longer plays
// whatever card the finger happens to be over.
const TAP_MOVE_THRESHOLD = 6;
export const HAND_SCRUB_BROWSE_SCALE = 1.18;
// A hard, fast upward swipe counts as "thrown at the pile" even short of an exact
// distance — matches a real flick, which is felt more by speed than by precise aim.
const FLICK_MIN_DISTANCE = 60;
const FLICK_MIN_VELOCITY = 0.5;

/**
 * A single gesture recogniser for the whole hand row: sliding a finger left/right
 * across the stack zooms whichever card is nearest the finger, without ever moving a
 * card out of its resting slot. Cards are never draggable to an arbitrary point —
 * the only two ways to play one are a plain tap (no meaningful movement before
 * release) and a hard upward flick on the card currently being browsed, which the
 * caller animates as a throw to the center (see CardsBoardScreen's flight overlay).
 * Any other release (a slow drag, a horizontal-only release) just lets the browsed
 * card spring back into the stack.
 */
export function useHandScrub({ enabled, count, getSlotX, onTapCard, onActiveIndexChange, onFlickCard }: UseHandScrubOptions) {
  const scalesRef = useRef<Animated.Value[]>([]);
  while (scalesRef.current.length < count) scalesRef.current.push(new Animated.Value(1));
  scalesRef.current.length = count;
  const scales = scalesRef.current;

  // The PanResponder below is built exactly once, so every value its callbacks read
  // is routed through a ref kept current on every render instead of being captured
  // stale from whichever render first mounted it.
  const enabledRef = useRef(enabled);
  const countRef = useRef(count);
  const getSlotXRef = useRef(getSlotX);
  const onTapCardRef = useRef(onTapCard);
  const onActiveIndexChangeRef = useRef(onActiveIndexChange);
  const onFlickCardRef = useRef(onFlickCard);
  enabledRef.current = enabled;
  countRef.current = count;
  getSlotXRef.current = getSlotX;
  onTapCardRef.current = onTapCard;
  onActiveIndexChangeRef.current = onActiveIndexChange;
  onFlickCardRef.current = onFlickCard;

  const activeIndexRef = useRef<number | null>(null);
  const grantIndexRef = useRef<number | null>(null);
  const movedRef = useRef(false);

  const nearestIndex = (x: number): number | null => {
    const n = countRef.current;
    if (n === 0) return null;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(getSlotXRef.current(i) - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  };

  const setActive = (index: number | null) => {
    if (activeIndexRef.current === index) return;
    const prev = activeIndexRef.current;
    activeIndexRef.current = index;
    if (prev !== null && scales[prev]) {
      Animated.spring(scales[prev], { toValue: 1, useNativeDriver: true, friction: 7, tension: 150 }).start();
    }
    if (index !== null && scales[index]) {
      Animated.spring(scales[index], { toValue: HAND_SCRUB_BROWSE_SCALE, useNativeDriver: true, friction: 7, tension: 150 }).start();
    }
    onActiveIndexChangeRef.current?.(index);
  };

  const resetAll = () => {
    scales.forEach((v) => Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 7, tension: 150 }).start());
    activeIndexRef.current = null;
    onActiveIndexChangeRef.current?.(null);
  };

  const panResponderRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => enabledRef.current,
      onStartShouldSetPanResponderCapture: () => enabledRef.current,
      onMoveShouldSetPanResponder: () => enabledRef.current,
      onMoveShouldSetPanResponderCapture: () => enabledRef.current,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        movedRef.current = false;
        grantIndexRef.current = nearestIndex(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt, gesture) => {
        if (!movedRef.current) {
          if (Math.abs(gesture.dx) + Math.abs(gesture.dy) <= TAP_MOVE_THRESHOLD) return;
          movedRef.current = true;
        }
        setActive(nearestIndex(evt.nativeEvent.locationX));
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (!movedRef.current) {
          const idx = grantIndexRef.current;
          resetAll();
          if (idx !== null) onTapCardRef.current(idx);
          return;
        }
        const flungUp = gesture.dy < -FLICK_MIN_DISTANCE && gesture.vy < -FLICK_MIN_VELOCITY;
        if (flungUp) {
          const idx = activeIndexRef.current ?? grantIndexRef.current;
          resetAll();
          if (idx !== null) onFlickCardRef.current?.(idx);
          return;
        }
        resetAll();
      },
      onPanResponderTerminate: () => resetAll(),
    }),
  );

  return { panHandlers: panResponderRef.current.panHandlers, scales };
}
