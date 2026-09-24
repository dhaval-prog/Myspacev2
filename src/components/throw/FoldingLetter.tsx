import React, { useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LetterCanvas } from './LetterCanvas';
import { PaperPlane } from './PaperPlane';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
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

function strokeToPathD(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/**
 * The paper letter, physically foldable into a paper plane by a downward drag on its pull-handle
 * (reversible — drag back up before it settles to keep writing) and thrown by a flick upward once
 * fully folded. The handle owns the fold gesture so it never fights with LetterCanvas's own
 * freehand-stroke PanResponder on the paper itself.
 */
export function FoldingLetter({ recipientName, recipientCity, disabled, onThrow, throwLabel = 'Swipe up to throw' }: FoldingLetterProps) {
  const [phase, setPhase] = useState<Phase>('writing');
  const [content, setContent] = useState<FoldingLetterContent>({ messageText: null, strokes: null, penColor: throwColor.ink });
  const [error, setError] = useState<string | null>(null);
  const [paperSize, setPaperSize] = useState({ width: 0, height: 0 });

  const progress = useRef(new Animated.Value(0)).current;
  const progressRef = useRef(0);
  const liftY = useRef(new Animated.Value(0)).current;
  const liftOpacity = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const id = progress.addListener(({ value }) => {
      progressRef.current = value;
    });
    return () => progress.removeListener(id);
  }, [progress]);

  const hasContent = content.strokes !== null || (content.messageText?.trim().length ?? 0) > 0;

  const settleFold = (target: 0 | 1) => {
    Animated.spring(progress, { toValue: target, useNativeDriver: false, friction: 9, tension: 55 }).start(() => {
      setPhase(target === 1 ? 'ready' : 'writing');
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
    Animated.timing(liftY, { toValue: -260, duration: 320, useNativeDriver: false }).start();
    Animated.timing(liftOpacity, { toValue: 0, duration: 320, useNativeDriver: false }).start();
    const { error: err } = await onThrow(content);
    if (err) {
      setError(err);
      setPhase('ready');
      liftY.setValue(0);
      liftOpacity.setValue(1);
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
    [disabled, phase, hasContent, content],
  );

  const onPaperLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setPaperSize({ width, height });
  };

  const canvasOpacity = progress.interpolate({ inputRange: [0, 0.2], outputRange: [1, 0], extrapolate: 'clamp' });
  const foldOpacity = progress.interpolate({ inputRange: [0, 0.2], outputRange: [0, 1], extrapolate: 'clamp' });

  const rectScaleY = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.35, 0.35], extrapolate: 'clamp' });
  const rectRotateX = progress.interpolate({ inputRange: [0, 0.5], outputRange: ['0deg', '-35deg'], extrapolate: 'clamp' });
  const rectOpacity = progress.interpolate({ inputRange: [0, 0.42, 0.58], outputRange: [1, 1, 0], extrapolate: 'clamp' });

  const triOpacity = progress.interpolate({ inputRange: [0.4, 0.58, 0.78, 0.92], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
  const triScaleX = progress.interpolate({ inputRange: [0.5, 0.9], outputRange: [1, 0.5], extrapolate: 'clamp' });

  const planeOpacity = progress.interpolate({ inputRange: [0.76, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const planeScale = progress.interpolate({ inputRange: [0.76, 1], outputRange: [0.55, 1], extrapolate: 'clamp' });
  const planeRotate = progress.interpolate({ inputRange: [0.76, 1], outputRange: ['8deg', '-6deg'], extrapolate: 'clamp' });

  const liftRotate = liftY.interpolate({ inputRange: [-260, 0], outputRange: ['-32deg', '0deg'], extrapolate: 'clamp' });

  const strokesToShow = content.strokes;
  const typedToShow = content.messageText;

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
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: foldOpacity }]} pointerEvents="none">
            <Animated.View
              style={[
                styles.foldRect,
                { width: paperSize.width, height: paperSize.height, opacity: rectOpacity, transform: [{ perspective: 800 }, { scaleY: rectScaleY }, { rotateX: rectRotateX }] },
              ]}
            >
              {strokesToShow ? (
                <Svg width="100%" height="100%" viewBox={`0 0 ${paperSize.width} ${paperSize.height}`}>
                  {strokesToShow.map((s, i) => (
                    <Path key={i} d={strokeToPathD(s.points)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                </Svg>
              ) : typedToShow ? (
                <Text style={styles.foldRectText} numberOfLines={6}>
                  {typedToShow}
                </Text>
              ) : null}
            </Animated.View>

            <Animated.View style={[styles.foldTriangleWrap, { opacity: triOpacity, transform: [{ scaleX: triScaleX }] }]}>
              <Svg width={120} height={90} viewBox="0 0 120 90">
                <Path d="M60,6 L114,82 L6,82 Z" fill={throwColor.paper} stroke={throwColor.paperLine} strokeWidth={1.5} />
              </Svg>
            </Animated.View>

            <Animated.View style={[styles.foldPlaneWrap, { transform: [{ translateY: liftY }, { rotate: liftRotate }], opacity: liftOpacity }]}>
              <Animated.View style={{ opacity: planeOpacity, transform: [{ scale: planeScale }, { rotate: planeRotate }] }}>
                <PaperPlane size={56} color={throwColor.clayDeep} />
              </Animated.View>
            </Animated.View>
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
  foldRect: {
    backgroundColor: throwColor.paper,
    borderRadius: throwRadius.paper,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foldRectText: { fontFamily: throwFont.hand500, fontSize: 20, color: throwColor.ink, lineHeight: 27 },
  foldTriangleWrap: { position: 'absolute', top: '50%', left: '50%', marginLeft: -60, marginTop: -45 },
  foldPlaneWrap: { position: 'absolute', top: '50%', left: '50%', marginLeft: -28, marginTop: -28 },
  error: { fontFamily: throwFont.ui400, fontSize: 12, color: '#B3413A', textAlign: 'center', marginTop: 8 },
  handleWrap: { alignItems: 'center', paddingVertical: 14, gap: 6 },
  handleGrip: { width: 44, height: 5, borderRadius: 3, backgroundColor: throwColor.paperLine },
  handleHint: { fontFamily: throwFont.ui600, fontSize: 12, color: throwColor.inkMute },
});
