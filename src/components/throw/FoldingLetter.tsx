import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import { LetterCanvas } from './LetterCanvas';
import { PaperPlane } from './PaperPlane';
import { PaperPlaneStage } from './PaperPlaneStage';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { PaperPlaneStageHandle } from './paperPlaneTypes';
import type { StrokePath } from '../../types/throw';

const FOLD_DRAG_DISTANCE = 150;
const LAUNCH_THRESHOLD = 64;
const LAUNCH_VELOCITY = 0.5;

// RN's ViewStyle type doesn't model this CSS-only key — matches the same loosely-typed
// pattern used by CardStack.tsx/CardsBoardScreen.tsx's own `noSelect` for a drag handle
// that would otherwise start a native text selection mid-gesture.
const noSelect: Record<string, unknown> = { userSelect: 'none' };

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
 * The paper letter, physically foldable into a paper plane by a downward drag on its pull-handle
 * (reversible — drag back up before it settles to keep writing) and thrown by a flick upward once
 * fully folded. The handle owns the fold gesture so it never fights with LetterCanvas's own
 * freehand-stroke PanResponder on the paper itself.
 *
 * The fold/flight visual is a real 3D scene (PaperPlaneStage, ported from the design handoff's
 * three.js origami-fold engine) driven directly by the drag gesture via `seek(progress)`, rather
 * than autoplaying — reversible mid-fold exactly like the writing surface it replaces. If WebGL
 * init fails (old/unsupported device), it falls back to a static plane glyph rather than a blank
 * screen.
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

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled && phase !== 'throwing' && (phase !== 'writing' || hasContent),
        onMoveShouldSetPanResponder: () => !disabled && phase !== 'throwing' && (phase !== 'writing' || hasContent),
        onPanResponderGrant: () => {
          if (phase === 'ready') {
            liftY.setValue(0);
          }
        },
        onPanResponderMove: (_, g) => {
          if (phase === 'ready') {
            liftY.setValue(Math.min(0, g.dy));
            return;
          }
          const next = Math.max(0, Math.min(1, g.dy / FOLD_DRAG_DISTANCE));
          progress.setValue(next);
          if (phase !== 'folding' && next > 0) setPhase('folding');
        },
        onPanResponderRelease: (_, g) => {
          if (phase === 'ready') {
            if (g.dy <= -LAUNCH_THRESHOLD || g.vy <= -LAUNCH_VELOCITY) {
              launch();
            } else {
              springLiftBack();
            }
            return;
          }
          settleFold(progressRef.current >= 0.5 ? 1 : 0);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, phase, hasContent, content, reduceMotion, stageFailed],
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

      <View style={styles.paperArea} onLayout={onPaperLayout}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: canvasOpacity }]} pointerEvents={phase === 'writing' ? 'auto' : 'none'}>
          <LetterCanvas hideDoneButton onContentChange={setContent} />
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

      {error && <Text style={styles.error}>{error}</Text>}

      {!disabled && (
        <View style={[styles.handleWrap, noSelect]} {...panResponder.panHandlers}>
          <View style={styles.handleGrip} />
          <Text style={[styles.handleHint, noSelect]}>
            {phase === 'writing' ? (hasContent ? 'Pull down to fold your letter' : 'Write something, then pull down to fold') : phase === 'ready' ? throwLabel : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  toLine: { fontFamily: throwFont.ui600, fontSize: 12.5, color: throwColor.inkSoft, textAlign: 'center', marginBottom: 8 },
  paperArea: {
    flex: 1,
    minHeight: 220,
    backgroundColor: throwColor.paper,
    borderRadius: throwRadius.paper,
    borderWidth: 1,
    borderColor: throwColor.paperLine,
    overflow: 'hidden',
    ...throwColor.shadowSoft,
  },
  fallbackPlaneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: throwFont.ui400, fontSize: 12, color: '#B3413A', textAlign: 'center', marginTop: 8 },
  handleWrap: { alignItems: 'center', paddingVertical: 14, gap: 6 },
  handleGrip: { width: 44, height: 5, borderRadius: 3, backgroundColor: throwColor.paperLine },
  handleHint: { fontFamily: throwFont.ui600, fontSize: 12, color: throwColor.inkMute },
});
