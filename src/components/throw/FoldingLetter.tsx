import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { LetterCanvas } from './LetterCanvas';
import { PaperPlane } from './PaperPlane';
import { PaperPlaneStage } from './PaperPlaneStage';
import { throwColor, throwFont } from '../../theme/throwTokens';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { PaperPlaneStageHandle } from './paperPlaneTypes';
import type { StrokePath } from '../../types/throw';

const FOLD_DRAG_DISTANCE = 150;
const LAUNCH_THRESHOLD = 64;
const LAUNCH_VELOCITY = 0.5;
// A downward drag on the paper only starts a fold once it's clearly vertical and past this many
// px — short/lateral movement is left alone for LetterCanvas's own stroke gesture underneath.
const FOLD_CAPTURE_DY = 14;
const FOLD_CAPTURE_RATIO = 1.7;

type Phase = 'writing' | 'folding' | 'ready' | 'throwing';

interface FoldingLetterContent {
  messageText: string | null;
  strokes: StrokePath[] | null;
  penColor: string;
}

interface FoldingLetterProps {
  recipientName: string;
  recipientCity: string;
  /** No recipient to write to yet — disables the fold/throw gesture. */
  disabled?: boolean;
  /** Called once the user flicks the folded plane upward. Resolve with an error to spring the plane back to 'ready' with a message; resolve with null on success (the parent then navigates away). */
  onThrow: (content: FoldingLetterContent) => Promise<{ error: string | null }>;
  throwLabel?: string;
}

/**
 * The paper letter — pulling down anywhere on the paper itself folds it into a plane (reversible;
 * let go before it settles to keep writing), and flicking the folded plane upward throws it. The
 * fold/flight visual is a real 3D scene (PaperPlaneStage, ported from the design handoff's
 * three.js origami-fold engine) driven directly by the drag via `seek(progress)` rather than
 * autoplaying, with the user's actual handwriting baked onto the plane's texture right as the
 * fold starts (see paperContentTexture.web.ts / .native.tsx) so it's a real letter, not a blank
 * sheet. If WebGL init fails (old/unsupported device), it falls back to a static plane glyph.
 *
 * There's no separate fold handle: the same paper the user writes on is what they drag, so the
 * outer PanResponder here has to negotiate with LetterCanvas's own stroke-drawing responder for
 * the exact same touches. It does that via the "capture" phase, which is RN's documented
 * mechanism for a parent to steal an in-progress gesture from a child — it only steals once a
 * drag is unambiguously a downward pull (past FOLD_CAPTURE_DY, and more vertical than horizontal
 * by FOLD_CAPTURE_RATIO); anything shorter or more lateral is left alone as a stroke.
 */
export function FoldingLetter({ recipientName, recipientCity, disabled, onThrow, throwLabel = 'Swipe up to throw' }: FoldingLetterProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('writing');
  const [content, setContent] = useState<FoldingLetterContent>({ messageText: null, strokes: null, penColor: throwColor.ink });
  const [error, setError] = useState<string | null>(null);
  const [paperSize, setPaperSize] = useState({ width: 0, height: 0 });
  const [stageFailed, setStageFailed] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;
  const progressRef = useRef(0);
  const liftY = useRef(new Animated.Value(0)).current;
  const liftOpacity = useRef(new Animated.Value(1)).current;
  const stageRef = useRef<PaperPlaneStageHandle>(null);
  const flyDoneRef = useRef<(() => void) | null>(null);
  const bakedRef = useRef(false);
  // Web-only fold-drag tracking, entirely independent of RN's PanResponder gestureState — see the
  // comment on the effect further down for why. `rawStart` is where a touch/mouse-down landed
  // (while still just possibly-a-stroke); `dragAnchor` is set once that's confirmed to be a fold
  // (past FOLD_CAPTURE_DY/RATIO) and is the { y, progress } pair everything since is measured from.
  const rawStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragAnchorRef = useRef<{ y: number; progress: number } | null>(null);
  const paperAreaRef = useRef<View>(null);

  const handleStageError = useCallback((err: unknown) => {
    console.warn('[Throw] paper plane 3D stage failed to initialize, falling back to a static glyph:', err);
    setStageFailed(true);
  }, []);

  const handleStagePhase = useCallback((p: string) => {
    if (p === 'done') flyDoneRef.current?.();
  }, []);

  React.useEffect(() => {
    const id = progress.addListener(({ value }) => {
      progressRef.current = value;
      stageRef.current?.seek(value);
    });
    return () => progress.removeListener(id);
  }, [progress]);

  const hasContent = content.strokes !== null || (content.messageText?.trim().length ?? 0) > 0;

  const settleFold = (target: 0 | 1) => {
    Animated.spring(progress, { toValue: target, useNativeDriver: false, friction: 9, tension: 55 }).start(() => {
      setPhase(target === 1 ? 'ready' : 'writing');
      if (target === 1) stageRef.current?.holdReady();
      if (target === 0) bakedRef.current = false;
      dragAnchorRef.current = null;
    });
  };

  const springLiftBack = () => {
    Animated.parallel([
      Animated.spring(liftY, { toValue: 0, useNativeDriver: false, friction: 7, tension: 50 }),
      Animated.spring(liftOpacity, { toValue: 1, useNativeDriver: false, friction: 7, tension: 50 }),
    ]).start();
  };

  const launch = async () => {
    setError(null);
    setPhase('throwing');
    // The pre-commit "lifting off the table" nudge is a plain 2D transform on the wrapper; the
    // 3D engine's own fly() sequence takes the visual from here, so reset that nudge first.
    liftY.setValue(0);
    liftOpacity.setValue(1);

    const canFly = !reduceMotion && !stageFailed && stageRef.current;
    let err: string | null;
    if (canFly) {
      const flyDone = new Promise<void>((resolve) => {
        flyDoneRef.current = resolve;
      });
      stageRef.current!.fly();
      [{ error: err }] = await Promise.all([onThrow(content), flyDone]);
    } else {
      ({ error: err } = await onThrow(content));
    }

    if (err) {
      setError(err);
      setPhase('ready');
      stageRef.current?.seek(1);
      stageRef.current?.holdReady();
    }
    // On success the parent navigates away — nothing left to reset here.
  };

  // The PanResponder below is built exactly once (see the empty useMemo deps) and never rebuilt
  // for the component's lifetime. It used to depend on `phase`/`hasContent`/`content`/`paperSize`
  // — but `onPanResponderMove` itself calls `setPhase('folding')` the instant a fold-drag starts,
  // which recreated the whole PanResponder (and its panHandlers) mid-gesture. Swapping the DOM's
  // touch/mouse handlers out from under an in-progress touch broke tracking: RN Web's responder
  // polyfill doesn't hand the live gesture off to the new instance, so `dy` froze a few pixels
  // into the drag no matter how far the user kept dragging (the fold visibly stalled after its
  // first couple of steps). This ref mirrors whatever state and closures the responder's
  // callbacks need, updated every render, so they always read fresh values without the responder
  // object itself ever changing identity while a touch is active.
  const latest = useRef({ disabled, phase, hasContent, content, paperSize, launch, settleFold, springLiftBack });
  latest.current = { disabled, phase, hasContent, content, paperSize, launch, settleFold, springLiftBack };

  const applyFoldProgress = useCallback(
    (next: number) => {
      progress.setValue(next);
      if (latest.current.phase !== 'folding' && next > 0) setPhase('folding');
      // RN Web's responder polyfill doesn't reliably fire onPanResponderGrant when this capture
      // steals the gesture from LetterCanvas mid-touch (only Move/Release fire on the new owner),
      // so the one-time content bake is triggered from here instead, guarded by bakedRef rather
      // than relying on Grant.
      if (!bakedRef.current && next > 0) {
        bakedRef.current = true;
        stageRef.current?.setContent(latest.current.content, latest.current.paperSize);
      }
    },
    [progress],
  );

  // react-native-web's PanResponder polyfill dedupes move dispatch against
  // `touchHistory.mostRecentTimeStamp`, and once `onMoveShouldSetPanResponderCapture` below steals
  // the gesture from LetterCanvas mid-touch, that shared history essentially stops advancing for
  // this touch — not deterministically "exactly once", but unpredictably: `onPanResponderMove`
  // (and even `onMoveShouldSetPanResponderCapture` itself, sharing the same dedupe) fires for a
  // few of the real pointer-move events and silently drops the rest, so how far the fold actually
  // gets by release is closer to a coin flip than a function of drag distance — verified directly:
  // a short drag and a very long one can both stall at nearly the same low progress, while
  // occasionally a long one happens to get enough lucky retries to reach the end. Three narrower
  // fixes targeting just *where* to read gestureState from (onPanResponderMove, then also seeding
  // from onMoveShouldSetPanResponderCapture, then an always-attached window fallback anchored to
  // whichever of those fired) all hit this same ceiling, because all three still ultimately trust
  // RN's gestureState numbers. So on web this bypasses that machinery entirely: raw mouse/touch
  // listeners on the paper's own DOM node re-implement the same FOLD_CAPTURE_DY/RATIO threshold
  // this component already uses to decide "is this a fold, not a stroke", and once confirmed,
  // compute progress purely from real pointer position deltas — no RN gestureState involved at
  // any point. RN's PanResponder is still what makes LetterCanvas relinquish the touch (that part
  // does work reliably), it's just no longer trusted for *measuring* the drag. Native's real touch
  // system doesn't have the underlying bug, so it keeps using PanResponder's own tracking as-is.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = paperAreaRef.current as any as HTMLElement | null;
    if (!node) return;
    const getPoint = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if ('touches' in e) {
        const t = e.touches[0];
        return t ? { x: t.clientX, y: t.clientY } : null;
      }
      return { x: e.clientX, y: e.clientY };
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const { disabled, phase, hasContent } = latest.current;
      if (disabled || phase !== 'writing' || !hasContent) return;
      rawStartRef.current = getPoint(e);
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      const p = getPoint(e);
      if (!p) return;
      const anchor = dragAnchorRef.current;
      if (anchor) {
        const next = Math.max(0, Math.min(1, anchor.progress + (p.y - anchor.y) / FOLD_DRAG_DISTANCE));
        applyFoldProgress(next);
        return;
      }
      const start = rawStartRef.current;
      if (!start || latest.current.phase !== 'writing') return;
      const dy = p.y - start.y;
      const dx = p.x - start.x;
      if (dy > FOLD_CAPTURE_DY && dy > Math.abs(dx) * FOLD_CAPTURE_RATIO) {
        const next = Math.max(0, Math.min(1, dy / FOLD_DRAG_DISTANCE));
        dragAnchorRef.current = { y: p.y, progress: next };
        applyFoldProgress(next);
      }
    };
    const onUp = () => {
      rawStartRef.current = null;
      if (!dragAnchorRef.current) return;
      // Clear the anchor first — this is what actually stops tracking, synchronously, before
      // settleFold's spring even starts. Everything after this point no-ops in onMove above.
      dragAnchorRef.current = null;
      if (latest.current.phase === 'folding') {
        latest.current.settleFold(progressRef.current >= 0.5 ? 1 : 0);
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
  }, [applyFoldProgress]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // A brand-new gesture only needs an immediate claim in the 'ready' phase (swipe-up-to-
        // throw) — a fold-drag starting from 'writing' is negotiated via move-capture below, since
        // LetterCanvas's own stroke responder needs first refusal on short/lateral touches.
        onStartShouldSetPanResponder: () => !latest.current.disabled && latest.current.phase === 'ready',
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: (_, g) => {
          const { disabled, phase, hasContent } = latest.current;
          if (disabled || phase === 'throwing') return false;
          if (phase === 'ready' || phase === 'folding') return true;
          return hasContent && g.dy > FOLD_CAPTURE_DY && g.dy > Math.abs(g.dx) * FOLD_CAPTURE_RATIO;
        },
        onPanResponderGrant: () => {
          if (latest.current.phase === 'ready') {
            liftY.setValue(0);
          }
        },
        onPanResponderMove: (_, g) => {
          if (latest.current.phase === 'ready') {
            liftY.setValue(Math.min(0, g.dy));
            return;
          }
          if (Platform.OS === 'web') {
            // On web, progress is driven entirely by the raw DOM listeners in the effect above —
            // RN's own gestureState.dy here is unreliable (see that effect's comment) and writing
            // it into dragAnchorRef would fight with the raw tracker's own anchor.
            return;
          }
          const next = Math.max(0, Math.min(1, g.dy / FOLD_DRAG_DISTANCE));
          applyFoldProgress(next);
        },
        onPanResponderRelease: (_, g) => {
          if (latest.current.phase === 'ready') {
            if (g.dy <= -LAUNCH_THRESHOLD || g.vy <= -LAUNCH_VELOCITY) {
              latest.current.launch();
            } else {
              latest.current.springLiftBack();
            }
            return;
          }
          // On web, the fold-drag's release is handled by the raw window listener above — RN
          // Web's touch-history dedupe bug that freezes onPanResponderMove mid-drag (see the
          // effect's comment) also leaves gestureState stale by the time release fires here.
          if (Platform.OS !== 'web') {
            latest.current.settleFold(progressRef.current >= 0.5 ? 1 : 0);
          }
        },
        onPanResponderTerminationRequest: () => true,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onPaperLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setPaperSize({ width, height });
  };

  const canvasOpacity = progress.interpolate({ inputRange: [0, 0.2], outputRange: [1, 0], extrapolate: 'clamp' });
  const stageOpacity = progress.interpolate({ inputRange: [0, 0.2], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={styles.wrap}>
      <Text style={styles.toLine} numberOfLines={1}>
        {phase === 'ready' || phase === 'throwing' ? 'Ready to throw' : `Writing to ${recipientName}`} · {recipientCity}
      </Text>

      <View ref={paperAreaRef} style={styles.paperArea} onLayout={onPaperLayout} {...panResponder.panHandlers}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: canvasOpacity }]} pointerEvents={phase === 'writing' ? 'auto' : 'none'}>
          <LetterCanvas onContentChange={setContent} />
        </Animated.View>

        {paperSize.width > 0 && (
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: stageOpacity, transform: [{ translateY: liftY }] }]}
            pointerEvents="none"
          >
            {stageFailed ? (
              <Animated.View style={[styles.fallbackPlaneWrap, { opacity: liftOpacity }]}>
                <PaperPlane size={64} color={throwColor.clayDeep} />
              </Animated.View>
            ) : (
              <PaperPlaneStage ref={stageRef} onPhase={handleStagePhase} onError={handleStageError} />
            )}
          </Animated.View>
        )}
      </View>

      {phase === 'ready' && <Text style={styles.readyHint}>{throwLabel}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  toLine: {
    fontFamily: throwFont.ui600,
    fontSize: 12.5,
    color: throwColor.inkSoft,
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(255,255,255,.65)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  paperArea: { flex: 1, minHeight: 220 },
  fallbackPlaneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  readyHint: { fontFamily: throwFont.ui600, fontSize: 12, color: throwColor.inkMute, textAlign: 'center', marginTop: 10 },
  error: { fontFamily: throwFont.ui400, fontSize: 12, color: '#B3413A', textAlign: 'center', marginTop: 8 },
});
