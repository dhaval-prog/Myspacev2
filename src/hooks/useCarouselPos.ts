import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, View } from 'react-native';

// Same 10px "is this actually a horizontal drag" threshold every other Throw gesture (FoldingLetter's
// contact flick, ContactStoryStack's long-press slop) already uses.
const SLOP = 10;
// Past the first/last contact, the drag follows the finger at this fraction instead of 1:1 — a soft
// "there's nothing more this way" resistance rather than a hard stop.
const RESISTANCE = 0.3;
// Faster than this (screen px/ms, not index-units/ms — independent of which surface's own `unit`
// triggered it) commits to the next/previous contact regardless of how far the drag actually got.
const FLICK_VELOCITY = 0.3;
// Critically-damped-ish spring constants, ported directly from the interaction spec/reference —
// stiffness pulls pos toward the target, damping bleeds velocity, both applied every rAF tick
// rather than through RN's own Animated.spring (whose internal tuning doesn't match the spec's
// explicit k/c numbers or its own follow-the-finger-then-continue-from-that-velocity contract).
const STIFFNESS = 300;
const DAMPING = 33;
const SETTLE_POS_EPSILON = 0.0008;
const SETTLE_VEL_EPSILON = 0.02;
const MAX_STEP_SECONDS = 0.032;

export interface CarouselPosCore {
  /** The live position — a plain number in "contact index" units (can be fractional mid-swipe,
   * negative when min < 0). Non-native-driver, updated imperatively every rAF tick via
   * `setValue()` (never through `Animated.timing`/`spring`) so every consumer's own
   * `.interpolate()` stays purely derived and re-renders nothing on its own. */
  pos: Animated.Value;
  /** The current *committed* index — updates the instant a drag resolves to a new target or
   * `springTo` is called directly (e.g. from an avatar tap), not once the spring visually
   * settles — same timing convention ThrowHomeScreen's own onChangeIndex already used before this
   * hook existed, so nothing downstream needs to change how it reacts to a selection. */
  index: number;
  /** Animates toward `target` (clamped to [min,max]) using the shared spring, optionally carrying
   * over an initial velocity (index-units/sec) — e.g. from a released flick. Cancels and takes
   * over from wherever `pos` currently sits, so a fresh call mid-animation "catches" it exactly
   * where it was instead of restarting from the old target. */
  springTo: (target: number, initialVelocityPerSec?: number) => void;
  /** Drag primitives — shared physics/math, but gesture *recognition* (deciding a touch is
   * actually a horizontal drag, not a tap or a vertical one meant for something else) is each
   * surface's own job (see useCarouselSurface) so multiple independent touch surfaces can drive
   * the same core without fighting over responder claims. */
  beginDrag: () => void;
  updateDrag: (dxFromStart: number, dyFromStart: number, unit: number) => void;
  endDrag: (velocityXPxPerMs: number, unit: number) => void;
}

interface UseCarouselPosOptions {
  min: number;
  max: number;
  initial: number;
  /** Fired whenever the committed index actually changes (not on every springTo call with an
   * unchanged target) — mirrors the old RecipientCarousel's own onChangeIndex contract. */
  onSettle?: (index: number) => void;
}

/**
 * The one shared spring driving both the recipient rail's avatars and the status-camera letter
 * panel (see the interaction spec's own "a single value `pos` drives everything") — instantiated
 * once by the screen that owns both surfaces, then handed to each via useCarouselSurface below.
 * Deliberately not per-surface state: swiping the avatar row and swiping the letter both need to
 * move the exact same position, mid-gesture catches included, which only works if there is
 * genuinely one number and one in-flight animation loop, not two kept in sync after the fact.
 */
export function useCarouselPos({ min, max, initial, onSettle }: UseCarouselPosOptions): CarouselPosCore {
  const pos = useRef(new Animated.Value(initial)).current;
  const posRef = useRef(initial);
  const velRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const dragStartPosRef = useRef(initial);
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;
  const [index, setIndex] = useState(initial);
  const indexRef = useRef(initial);
  // `min`/`max` (e.g. friendsWithLocation.length - 1) can change across renders — read from these
  // refs inside springTo/updateDrag/endDrag rather than closing over the destructured values
  // above, since those functions' own identities only get refreshed by the final useMemo when
  // `pos`/`index` themselves change, not on every render.
  const minRef = useRef(min);
  minRef.current = min;
  const maxRef = useRef(max);
  maxRef.current = max;

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const render = () => pos.setValue(posRef.current);

  const commit = (next: number) => {
    if (indexRef.current === next) return;
    indexRef.current = next;
    setIndex(next);
    onSettleRef.current?.(next);
  };

  const springTo = (target: number, initialVelocityPerSec?: number) => {
    const clamped = Math.max(minRef.current, Math.min(maxRef.current, target));
    if (initialVelocityPerSec !== undefined) velRef.current = initialVelocityPerSec;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(MAX_STEP_SECONDS, (now - last) / 1000);
      last = now;
      velRef.current += (-STIFFNESS * (posRef.current - clamped) - DAMPING * velRef.current) * dt;
      posRef.current += velRef.current * dt;
      if (Math.abs(posRef.current - clamped) < SETTLE_POS_EPSILON && Math.abs(velRef.current) < SETTLE_VEL_EPSILON) {
        posRef.current = clamped;
        velRef.current = 0;
        render();
        rafRef.current = null;
        return;
      }
      render();
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    // Committed immediately (see `index`'s own doc comment), not once the animation above
    // finishes — everything downstream (which letter content is mounted, the map's focus target)
    // already expects "selection changes the instant you release/tap", not "once it lands".
    commit(clamped);
  };

  const beginDrag = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    velRef.current = 0;
    dragStartPosRef.current = posRef.current;
  };

  const updateDrag = (dxFromStart: number, dyFromStart: number, unit: number) => {
    const min = minRef.current;
    const max = maxRef.current;
    let p = dragStartPosRef.current - dxFromStart / unit;
    if (p < min) p = min + (p - min) * RESISTANCE;
    if (p > max) p = max + (p - max) * RESISTANCE;
    posRef.current = p;
    render();
  };

  const endDrag = (velocityXPxPerMs: number, unit: number) => {
    let target = Math.round(posRef.current);
    if (Math.abs(velocityXPxPerMs) > FLICK_VELOCITY) {
      target = velocityXPxPerMs < 0 ? Math.floor(posRef.current) + 1 : Math.ceil(posRef.current) - 1;
    }
    springTo(Math.max(minRef.current, Math.min(maxRef.current, target)), (-velocityXPxPerMs * 1000) / unit);
  };

  return useMemo(() => ({ pos, index, springTo, beginDrag, updateDrag, endDrag }), [pos, index]);
}

/**
 * One touch surface (the avatar row, or the letter panel) feeding the shared core above — each
 * surface has its own `unit` (how many px of drag equals one whole contact) and its own gesture
 * recognition, since only a real horizontal drag should ever claim the responder (a tap must keep
 * reaching each avatar's own Pressable, and a vertical drag on the letter must keep reaching
 * ContactStoryStack's own long-press/swipe-up gestures untouched).
 */
export function useCarouselSurface(core: CarouselPosCore, unit: number, enabled = true) {
  const ref = useRef<View>(null);
  const unitRef = useRef(unit);
  unitRef.current = unit;

  // react-native-web's PanResponder polyfill drops move events under a real drag (the same
  // touch-history dedupe bug documented at length elsewhere in Throw — FoldingLetter's own
  // contact flick, ContactStoryStack's own gesture effect) — sidestepped the same way, with raw
  // pointer listeners doing their own slop/direction recognition before ever touching the core.
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = ref.current as any as HTMLElement | null;
    if (!node) return;
    let state: 'idle' | 'pending' | 'h' | 'dead' = 'idle';
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let velocityX = 0;
    const getPoint = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if ('touches' in e && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if ('changedTouches' in e && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      if ('clientX' in e) return { x: e.clientX, y: e.clientY };
      return null;
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const p = getPoint(e);
      if (!p) return;
      state = 'pending';
      startX = lastX = p.x;
      startY = lastY = p.y;
      lastT = performance.now();
      velocityX = 0;
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (state === 'idle') return;
      const p = getPoint(e);
      if (!p) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      velocityX = (p.x - lastX) / dt;
      lastX = p.x;
      lastY = p.y;
      lastT = now;
      const dx = p.x - startX;
      const dy = p.y - startY;
      if (state === 'pending') {
        if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy)) {
          state = 'h';
          core.beginDrag();
        } else if (Math.hypot(dx, dy) > SLOP) {
          state = 'dead';
        }
      }
      if (state === 'h') core.updateDrag(dx, dy, unitRef.current);
    };
    const onUp = () => {
      if (state === 'h') core.endDrag(velocityX, unitRef.current);
      state = 'idle';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, enabled]);

  // Native's real touch system doesn't have the bug above — onMoveShouldSetPanResponder already
  // does the same slop/direction recognition before granting, so by the time onPanResponderMove
  // fires the drag is already committed and gestureState's own dx/dy/vx (relative to grant, not
  // raw screen coordinates) can drive the core directly.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => enabled && Platform.OS !== 'web' && Math.abs(g.dx) > SLOP && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => core.beginDrag(),
        onPanResponderMove: (_, g) => core.updateDrag(g.dx, g.dy, unitRef.current),
        onPanResponderRelease: (_, g) => core.endDrag(g.vx, unitRef.current),
        onPanResponderTerminate: (_, g) => core.endDrag(g.vx, unitRef.current),
      }),
    [core, enabled],
  );

  return { ref, panHandlers: Platform.OS === 'web' ? {} : panResponder.panHandlers };
}

/** `d = i - pos` and `a = min(1, |d|)` — the two derived values every avatar/letter transform in
 * the spec is built from (see RecipientCarousel's own per-item transform and the status panel's
 * own letter-track transform), factored out once so both read from the exact same math. */
export function tentDeviation(pos: Animated.Value, i: number) {
  const d = Animated.multiply(Animated.add(pos, -i), -1); // i - pos
  const absD = d.interpolate({ inputRange: [-100000, 0, 100000], outputRange: [100000, 0, 100000] });
  const a = absD.interpolate({ inputRange: [0, 1, 100000], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  return { d, a };
}
