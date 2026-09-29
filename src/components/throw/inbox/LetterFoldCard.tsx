import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { PaperPlaneStage } from '../PaperPlaneStage';
import { LetterPlaneGlyph } from './LetterPlaneGlyph';
import type { PaperPlaneStageHandle } from '../paperPlaneTypes';
import { inboxColor, inboxLayout } from '../../../theme/throwInboxTokens';
import type { StrokePath } from '../../../types/throw';

export type LetterStage = 'hidden' | 'flying' | 'ready' | 'trash' | 'empty';

export interface LetterCardData {
  from: string;
  date: string;
  place: string;
  distance: string;
  body: string;
  sig: string;
  count: string;
  /** Raw content baked onto the folded plane's own texture — same shape PaperPlaneStage's
   * setContent already takes for the Throw compose letter, so a received letter's folded plane
   * looks like real paper too, not a blank one. */
  strokes: StrokePath[] | null;
  messageText: string | null;
  photoUri: string | null;
}

export interface LetterFoldCardHandle {
  /** Folds the card closed (if currently open) and resolves once settled — resolves immediately
   * if it's already closed or hasn't been opened yet. Mirrors ThrowInboxScreen's own foldAway. */
  closeIfOpen: () => Promise<void>;
}

interface LetterFoldCardProps {
  stage: LetterStage;
  letter: LetterCardData | null;
  isEmpty: boolean;
  emptyName: string;
  scale: number;
  reduceMotion: boolean;
  /** Bakes the folded plane's texture as plain white vs. the night skin's own dark tone — same
   * flag Throw's own compose letter uses for its plane. */
  isNight: boolean;
  onThrowBack?: () => void;
  /** Fires once the user has dragged the letter open (or, under reduced motion, once it's
   * crossfaded open automatically) / closed again — lets the screen gate Replay and the
   * flick-to-switch-contact gesture to only the open state. */
  onOpenChange?: (open: boolean) => void;
  /** A clearly horizontal drag on the OPEN letter — only while open, matching FoldingLetter's own
   * restriction of its contact-flick gesture to the still-open writing paper. */
  onFlick?: (direction: 'left' | 'right') => void;
}

const s = (n: number, scale: number) => n * scale;

// Web-only: without this, a mouse-drag over the open letter's own text (the drag-to-close/flick
// gesture's touch area) triggers the browser's native text-selection highlight, same fix already
// used for ContactStoryStack/CardStack's own drag-covered content.
const noSelect: Record<string, unknown> = { userSelect: 'none', WebkitUserSelect: 'none' };

// ----- drag-to-open gesture tuning, mirrored from FoldingLetter's own fold-drag/contact-flick
// thresholds (FOLD_DRAG_DISTANCE/FOLD_CAPTURE_DY/RATIO, CONTACT_FLICK_CAPTURE_DX/RATIO) so this
// card's drag feels like the same gesture, just reversed (drag UP opens here, vs. drag DOWN folds
// there) since the two start from opposite ends of the same 0..1 fold timeline. -----
const OPEN_DRAG_DISTANCE = 150;
const OPEN_CAPTURE_DY = 14;
const OPEN_CAPTURE_RATIO = 1.7;
const FLICK_CAPTURE_DX = 20;
const FLICK_CAPTURE_RATIO = 1.7;
const SHRINK_EASING = Easing.bezier(0.5, 0, 0.8, 0.4);

/**
 * Drives the open/close drag (and, only while open, a horizontal flick-to-switch-contact) over a
 * single touch area — the same dual native-PanResponder/web-raw-listener convention already used
 * by PlaneSlider's useActiveChipGesture and FoldingLetter's own fold-drag, since RN Web's
 * PanResponder gesture state isn't reliable under a real drag (confirmed the hard way building
 * PlaneSlider's delete gesture). `onStartShouldSetPanResponder` deliberately never claims
 * immediately (native) / claims only past a move threshold (web) — the Throw Back button lives
 * inside this same touch area, and claiming on a bare touch-down would swallow its taps.
 */
function useCardGesture(opts: {
  enabled: boolean;
  getProgress: () => number;
  onProgressChange: (next: number) => void;
  onSettle: (target: 0 | 1) => void;
  flickEnabled: boolean;
  onFlick?: (direction: 'left' | 'right') => void;
}) {
  const { enabled, getProgress, onProgressChange, onSettle, flickEnabled, onFlick } = opts;
  const nodeRef = useRef<View>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const startProgressRef = useRef(0);
  const anchorRef = useRef<{ y: number; progress: number } | null>(null);
  const kindRef = useRef<'none' | 'fold' | 'flick'>('none');

  const onStart = (x: number, y: number) => {
    if (!enabled) return;
    startRef.current = { x, y };
    startProgressRef.current = getProgress();
    anchorRef.current = null;
    kindRef.current = 'none';
  };
  const onMove = (x: number, y: number) => {
    const start = startRef.current;
    if (!start) return;
    if (anchorRef.current) {
      const a = anchorRef.current;
      onProgressChange(Math.max(0, Math.min(1, a.progress + (y - a.y) / OPEN_DRAG_DISTANCE)));
      return;
    }
    const dx = x - start.x;
    const dy = y - start.y;
    if (kindRef.current !== 'none') return;
    if (Math.abs(dy) > OPEN_CAPTURE_DY && Math.abs(dy) > Math.abs(dx) * OPEN_CAPTURE_RATIO) {
      kindRef.current = 'fold';
      const next = Math.max(0, Math.min(1, startProgressRef.current + dy / OPEN_DRAG_DISTANCE));
      anchorRef.current = { y, progress: next };
      onProgressChange(next);
      return;
    }
    if (flickEnabled && onFlick && Math.abs(dx) > FLICK_CAPTURE_DX && Math.abs(dx) > Math.abs(dy) * FLICK_CAPTURE_RATIO) {
      kindRef.current = 'flick';
      onFlick(dx < 0 ? 'left' : 'right');
    }
  };
  const onEnd = () => {
    if (kindRef.current === 'fold') onSettle(getProgress() >= 0.5 ? 1 : 0);
    startRef.current = null;
    anchorRef.current = null;
    kindRef.current = 'none';
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (e, g) => {
          if (!enabled) return false;
          if (Math.abs(g.dy) > OPEN_CAPTURE_DY && Math.abs(g.dy) > Math.abs(g.dx) * OPEN_CAPTURE_RATIO) return true;
          return flickEnabled && !!onFlick && Math.abs(g.dx) > FLICK_CAPTURE_DX && Math.abs(g.dx) > Math.abs(g.dy) * FLICK_CAPTURE_RATIO;
        },
        onPanResponderGrant: (e) => onStart(e.nativeEvent.pageX, e.nativeEvent.pageY),
        onPanResponderMove: (e) => onMove(e.nativeEvent.pageX, e.nativeEvent.pageY),
        onPanResponderRelease: onEnd,
        onPanResponderTerminate: onEnd,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, flickEnabled],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const node = nodeRef.current as unknown as HTMLElement | null;
    if (!node) return;
    const point = (e: MouseEvent | TouchEvent) => ('touches' in e ? e.touches[0] : e);
    const onDown = (e: MouseEvent | TouchEvent) => {
      const p = point(e);
      if (p) onStart(p.clientX, p.clientY);
    };
    const onMoveWeb = (e: MouseEvent | TouchEvent) => {
      const p = point(e);
      if (p) onMove(p.clientX, p.clientY);
    };
    node.addEventListener('mousedown', onDown);
    node.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mousemove', onMoveWeb);
    window.addEventListener('touchmove', onMoveWeb, { passive: true });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
    return () => {
      node.removeEventListener('mousedown', onDown);
      node.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMoveWeb);
      window.removeEventListener('touchmove', onMoveWeb);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchend', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, flickEnabled]);

  return { nodeRef, panHandlers: Platform.OS === 'web' ? {} : panResponder.panHandlers };
}

/**
 * The letter card at (18,262) in the 390×844 reference frame, 354×330 — now backed by the SAME
 * real WebGL paper-fold engine Throw's own compose letter uses (see PaperPlaneStage/
 * paperPlaneEngine.ts), driven by a drag gesture rather than a scripted timeline: a letter lands
 * folded/at-rest (stage 'ready'), and the user drags UP on it to unfold it into the readable open
 * letter, exactly mirroring the compose paper's own drag-DOWN-to-fold gesture but starting from
 * the opposite end of the same 0..1 fold timeline (1 = folded plane, 0 = flat open sheet).
 * Dragging back down re-folds it. See ThrowInboxScreen for the arrival flight (a separate 2D
 * sprite, unrelated to this engine) that ends with this card mounting in stage 'ready'.
 */
export const LetterFoldCard = forwardRef<LetterFoldCardHandle, LetterFoldCardProps>(function LetterFoldCard(
  { stage, letter, isEmpty, emptyName, scale, reduceMotion, isNight, onThrowBack, onOpenChange, onFlick },
  ref,
) {
  const w = s(inboxLayout.letter.w, scale);
  const h = s(inboxLayout.letter.h, scale);

  const stageRef = useRef<PaperPlaneStageHandle>(null);
  const progress = useRef(new Animated.Value(1)).current; // 1 = folded/closed, 0 = open/flat
  const progressRef = useRef(1);
  const [open, setOpen] = useState(false);
  const bakedRef = useRef(false);

  const mountOpacity = useRef(new Animated.Value(0)).current;
  const trashScale = useRef(new Animated.Value(1)).current;
  const trashTranslateY = useRef(new Animated.Value(0)).current;
  const trashOpacity = useRef(new Animated.Value(1)).current;

  const getProgress = useCallback(() => progressRef.current, []);

  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      progressRef.current = value;
      stageRef.current?.seek(value);
    });
    return () => progress.removeListener(id);
  }, [progress]);

  const rebake = useCallback(() => {
    if (!letter) return;
    stageRef.current?.setContent({ strokes: letter.strokes, messageText: letter.messageText, penColor: inboxColor.inkBlue, photoUri: letter.photoUri, isNight }, { width: w, height: h });
  }, [letter, isNight, w, h]);

  // The engine (a real WebGLRenderer + three.js scene) is constructed asynchronously — a
  // ResizeObserver's first non-zero layout on web, GLView's onContextCreate on native — so the
  // seek(1)/holdReady() this card fires the instant it mounts (see the stage-'ready' effect
  // below) can land before the engine exists and silently no-op against a still-null
  // engineRef.current. FoldingLetter's own usage doesn't hit this: its first real seek() only
  // ever comes from a later user drag, by which point the engine has long since initialized. Once
  // PaperPlaneStage reports it's actually ready, re-apply whatever pose/bake should already be
  // showing so the plane doesn't render stuck at the engine's own default flat/idle pose.
  const handleStageReady = useCallback(() => {
    stageRef.current?.seek(progressRef.current);
    if (progressRef.current >= 1) stageRef.current?.holdReady();
    if (bakedRef.current) rebake();
  }, [rebake]);

  const setOpenProgress = useCallback(
    (next: number) => {
      progress.setValue(next);
      progressRef.current = next;
      stageRef.current?.seek(next);
      if (!bakedRef.current) {
        bakedRef.current = true;
        rebake();
      }
    },
    [progress, rebake],
  );

  const settleTo = useCallback(
    (target: 0 | 1) =>
      new Promise<void>((resolve) => {
        Animated.spring(progress, { toValue: target, useNativeDriver: false, friction: 9, tension: 55 }).start(() => {
          progressRef.current = target;
          if (target === 1) stageRef.current?.holdReady();
          setOpen(target === 0);
          onOpenChange?.(target === 0);
          resolve();
        });
      }),
    [progress, onOpenChange],
  );

  useImperativeHandle(
    ref,
    () => ({
      closeIfOpen: async () => {
        if (progressRef.current >= 1) return;
        await settleTo(1);
      },
    }),
    [settleTo],
  );

  // A fresh letter/contact landed — fold state resets to closed, re-bake queued for the first
  // open-drag (or immediately under reduced motion, below).
  useEffect(() => {
    if (stage !== 'ready') return;
    bakedRef.current = false;
    mountOpacity.setValue(0);
    Animated.timing(mountOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    if (reduceMotion) {
      // "Skip the flight and unfolding, and just crossfade the letter" — no drag needed, straight
      // to the readable open state, with only the content's own opacity animating in.
      progress.setValue(0);
      progressRef.current = 0;
      bakedRef.current = true;
      rebake();
      setOpen(true);
      onOpenChange?.(true);
    } else {
      progress.setValue(1);
      progressRef.current = 1;
      stageRef.current?.seek(1);
      stageRef.current?.holdReady();
      setOpen(false);
      onOpenChange?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, letter?.from, letter?.date, reduceMotion]);

  useEffect(() => {
    if (stage === 'trash') {
      trashScale.setValue(1);
      trashTranslateY.setValue(0);
      trashOpacity.setValue(1);
      Animated.timing(trashTranslateY, { toValue: 420, duration: 500, easing: SHRINK_EASING, useNativeDriver: true }).start();
      Animated.timing(trashScale, { toValue: 0.3, duration: 500, easing: SHRINK_EASING, useNativeDriver: true }).start();
      Animated.timing(trashOpacity, { toValue: 0, duration: 500, easing: SHRINK_EASING, useNativeDriver: true }).start();
    }
  }, [stage, trashScale, trashTranslateY, trashOpacity]);

  const gesture = useCardGesture({
    enabled: stage === 'ready' && !reduceMotion,
    getProgress,
    onProgressChange: setOpenProgress,
    onSettle: settleTo,
    flickEnabled: open,
    onFlick,
  });

  if (isEmpty) {
    return (
      <View style={[styles.emptyWrap, { width: w, height: h, borderRadius: s(24, scale) }]}>
        <Text style={[styles.emptyTitle, { fontSize: s(16, scale) }]}>No letters from {emptyName}</Text>
        <Text style={[styles.emptySub, { fontSize: s(10.5, scale) }]}>NEW ONES WILL FLY IN HERE</Text>
      </View>
    );
  }

  if (stage === 'trash') {
    return (
      <Animated.View
        pointerEvents="none"
        style={{ width: w, height: h, opacity: trashOpacity, transform: [{ translateY: trashTranslateY }, { scale: trashScale }] }}
      >
        <View style={{ alignItems: 'center', justifyContent: 'center', width: w, height: h }}>
          <LetterPlaneGlyph size={s(64, scale)} variant="delete" />
        </View>
      </Animated.View>
    );
  }

  if (stage !== 'ready' || !letter) return null;

  const L = letter;
  const stageOpacity = progress.interpolate({ inputRange: [0, 0.2], outputRange: [0, 1], extrapolate: 'clamp' });
  const contentOpacity = progress.interpolate({ inputRange: [0, 0.2], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <Animated.View
      ref={gesture.nodeRef}
      {...gesture.panHandlers}
      style={[{ width: w, height: h, opacity: mountOpacity, borderRadius: s(24, scale), overflow: 'hidden' }, noSelect]}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: stageOpacity }]}>
        <PaperPlaneStage ref={stageRef} onReady={handleStageReady} />
      </Animated.View>

      <Animated.View
        pointerEvents={open ? 'box-none' : 'none'}
        style={[StyleSheet.absoluteFill, { opacity: contentOpacity, backgroundColor: inboxColor.paper }]}
      >
        <RuledLines scale={scale} />
        <HeaderRow letter={L} scale={scale} />
        <BodyText body={L.body} scale={scale} />
        <SignatureRow letter={L} scale={scale} />
        {open && onThrowBack && (
          <View pointerEvents="box-none" style={[styles.throwBackWrap, { bottom: s(14, scale) }]}>
            <Text onPress={onThrowBack} style={[styles.throwBackBtn, { fontSize: s(12.5, scale), paddingHorizontal: s(14, scale), paddingVertical: s(8, scale), borderRadius: s(14, scale) }]}>
              Throw Back
            </Text>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
});

function RuledLines({ scale }: { scale: number }) {
  const lineGap = s(34, scale);
  const count = Math.ceil(s(inboxLayout.letter.h, scale) / lineGap);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: s(24, scale), right: s(24, scale), top: s(108, scale), bottom: s(62, scale), overflow: 'hidden' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ position: 'absolute', top: i * lineGap, left: 0, right: 0, height: 1, backgroundColor: inboxColor.ruleLine }} />
      ))}
    </View>
  );
}

function HeaderRow({ letter, scale }: { letter: LetterCardData; scale: number }) {
  return (
    <View style={{ paddingHorizontal: s(24, scale), paddingTop: s(22, scale), flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: s(12, scale) }}>
      <View style={{ gap: s(4, scale) }}>
        <Text style={[styles.fromLabel, { fontSize: s(12, scale) }]}>From</Text>
        <Text style={[styles.fromName, { fontSize: s(20, scale) }]}>{letter.from}</Text>
        <Text style={[styles.mono, { fontSize: s(10.5, scale), letterSpacing: 0.7 }]}>{letter.date}</Text>
      </View>
      <View style={[styles.postmark, { width: s(62, scale), height: s(62, scale), borderRadius: s(31, scale) }]}>
        <Text style={[styles.mono, styles.postmarkPlace, { fontSize: s(9, scale) }]}>{letter.place}</Text>
        <Text style={[styles.mono, styles.postmarkKm, { fontSize: s(8.5, scale) }]}>{letter.distance}</Text>
      </View>
    </View>
  );
}

function BodyText({ body, scale }: { body: string; scale: number }) {
  return <Text style={[styles.body, { paddingHorizontal: s(24, scale), paddingTop: s(14, scale), fontSize: s(25, scale), lineHeight: s(34, scale) }]}>{body}</Text>;
}

function SignatureRow({ letter, scale }: { letter: LetterCardData; scale: number }) {
  return (
    <View style={{ position: 'absolute', left: s(24, scale), right: s(24, scale), bottom: s(20, scale), flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={[styles.sig, { fontSize: s(22, scale) }]}>{letter.sig}</Text>
      <Text style={[styles.mono, { fontSize: s(10.5, scale) }]}>{letter.count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fromLabel: { fontFamily: 'Figtree_700Bold', color: inboxColor.muted },
  fromName: { fontFamily: 'Figtree_800ExtraBold', color: inboxColor.ink },
  mono: { fontFamily: 'DMMono_500Medium', color: inboxColor.muted },
  postmark: {
    borderWidth: 1.5,
    borderColor: 'rgba(47,107,255,.55)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-12deg' }],
  },
  postmarkPlace: { color: inboxColor.accentBlue, letterSpacing: 1 },
  postmarkKm: { color: 'rgba(47,107,255,.8)' },
  body: { fontFamily: 'Caveat_500Medium', color: inboxColor.inkBlue },
  sig: { fontFamily: 'Caveat_600SemiBold', color: inboxColor.inkBlue },
  emptyWrap: {
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,.2)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTitle: { fontFamily: 'Figtree_800ExtraBold', color: inboxColor.ink },
  emptySub: { fontFamily: 'DMMono_500Medium', letterSpacing: 1.4, color: inboxColor.muted },
  throwBackWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  throwBackBtn: {
    fontFamily: 'Figtree_700Bold',
    color: '#FFFFFF',
    backgroundColor: inboxColor.accentBlue,
    overflow: 'hidden',
  },
});
