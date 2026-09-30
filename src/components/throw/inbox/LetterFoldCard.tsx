import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { Icon } from '../../Icon';
import { GlassSurface } from '../../friends/GlassSurface';
import { AutoplayVideoFill } from '../../AutoplayVideoFill';
import { inboxColor, inboxLayout } from '../../../theme/throwInboxTokens';
import { formatClockMs } from '../../../utils/formatClock';
import { formatAlertSchedule } from '../../../utils/throwAlerts';
import type { AlertSchedule, MediaTrim } from '../../../types/throw';

const CHEVRON_LEFT_ICON = 'M15 18l-6-6 6-6';
const CHEVRON_RIGHT_ICON = 'M9 18l6-6-6-6';
// Two circular arrows — the same "flip/switch view" glyph StoryCaptureScreen's own camera-flip
// button uses, reused here for "flip back to the written text" rather than inventing a second
// visually-unrelated icon for the same "swap what you're looking at" idea.
const FLIP_ICON = 'M4 4v5h5 M20 20v-5h-5 M4 9a8 8 0 0114-4.9L20 9 M20 15a8 8 0 01-14 4.9L4 15';
// A standard "reply" glyph — an arrow curving up-and-left into a horizontal bar — rather than
// reusing the paper-plane "throw"/send icon, which already means something different elsewhere.
const REPLY_ICON = 'M9 14L4 9l5-5 M20 20v-7a4 4 0 00-4-4H4';
// A standard "image" glyph — rounded frame, sun, mountain line — replacing the previous flower
// glyph per explicit request for a more literal photo icon.
const IMAGE_ICON = 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 21';
const VOLUME_ICON = 'M11 5L6 9H2v6h4l5 4V5z M15.5 8.5a5 5 0 0 1 0 7 M18.5 5.5a9 9 0 0 1 0 13';
const VOLUME_MUTED_ICON = 'M11 5L6 9H2v6h4l5 4V5z M22.5 9.5l-6 6 M16.5 9.5l6 6';

// A flick up/down over the open photo/video moves to the next/previous attachment — same
// threshold-and-velocity commit convention ContactStoryStack's own swipe-up-to-return gesture
// uses (see its own long comment on why release-based measurement, not a live-following drag,
// sidesteps react-native-web's PanResponder move-event bug entirely: only the two endpoints are
// ever read, never anything in between).
const SWIPE_COMMIT_DISTANCE = 40;
const SWIPE_COMMIT_VELOCITY = 0.5;

export type LetterStage =
  | 'hidden'
  | 'flying'
  | 'landed'
  | 'wings'
  | 'corners'
  | 'expand'
  | 'open'
  | 'folding'
  | 'shrink'
  | 'fadeOut'
  | 'trash'
  | 'empty';

export interface LetterCardData {
  /** Stable per-letter id (not shown anywhere) — just so this card can tell when the underlying
   * letter has actually changed (switching chips, a delete landing on the next one) and reset its
   * own media-viewer toggle instead of carrying it over onto an unrelated letter. */
  id: string;
  from: string;
  date: string;
  place: string;
  distance: string;
  body: string;
  sig: string;
  count: string;
  /** Every photo/video attached to this letter, in the order they were sent — empty for a
   * text-only letter, which locks the media-viewer entry point below (see LetterFoldCard's own
   * "View attached photos or videos" glass button, beside Reply). */
  photoUrls: string[];
  /** Index-aligned with photoUrls — null entries mean "no trim" (a photo, or a video that was
   * already within the 15s cap). */
  photoTrims: (MediaTrim | null)[];
  /** The sender's own optional attached reminder request (see ThrowLetter's own alertSchedule) —
   * null for an ordinary letter with nothing attached. Shows a Confirm pill beside Reply until
   * alertConfirmed is true (see onConfirmAlert). */
  alertSchedule: AlertSchedule | null;
  alertConfirmed: boolean;
}

interface LetterFoldCardProps {
  stage: LetterStage;
  letter: LetterCardData | null;
  isEmpty: boolean;
  emptyName: string;
  scale: number;
  /** Independent vertical scale for the card's own height (and everything measured off it —
   * panelH, the ruled-lines/signature vertical placement) — defaults to `scale`. Callers with more
   * available height than width (the in-place received-letters panel, whose slot is much taller
   * than this card's own near-square 354:330 design ratio) pass a taller value here so the card
   * fills that height the way FoldingLetter's own plain flex:1 paper does, without also blowing up
   * the width past its slot's own margins — `scale` alone stays driving width, fonts, and padding. */
  heightScale?: number;
  reduceMotion: boolean;
  onThrowBack?: () => void;
  /** Confirms this letter's own attached reminder request (see LetterCardData's own alertSchedule)
   * — present only while there's actually something to confirm; the Confirm pill itself is what
   * decides whether to show (letter.alertSchedule present && !alertConfirmed), same convention as
   * onThrowBack. */
  onConfirmAlert?: () => void;
}

// ----- timings, ported verbatim from the design handoff's own renderVals() -----
const D = 500;
const LAG = 200;
// The plain crossfade duration for 'fadeOut'/'open' — the in-place received-letters panel's own
// switch-between-letters treatment (see useInboxArrival's own foldAway).
const FADE_MS = 260;
const HALF = 250;
const FOLD_EASING = Easing.bezier(0.6, 0, 0.3, 1);
const WING_EASING = Easing.bezier(0.3, 1.1, 0.4, 1);
const FLAP_EASING = Easing.bezier(0.4, 0, 0.2, 1);
const EXPAND_EASING = Easing.bezier(0.3, 1.25, 0.5, 1);
const SHRINK_EASING = Easing.bezier(0.5, 0, 0.8, 0.4);

const s = (n: number, scale: number) => n * scale;

/**
 * The tri-fold envelope-shaped "sheet" a letter briefly takes right after landing, before
 * unfolding into the full open card — two wing halves plus two corner "nose flap" triangles.
 * The design's own reference rotates each flap about its diagonal via CSS `rotate3d(1,∓1,0,…)`
 * with a `clip-path` restoring the wing's missing corner as it does — neither `rotate3d` about an
 * arbitrary axis nor `clip-path` exist in React Native. This ports the *visual result* instead of
 * the literal CSS: a right-triangle drawn directly in SVG (so no clip-path is needed to produce
 * the triangle shape at all) inside a view whose transform chain is `rotateZ(45deg) → rotateX(θ)
 * → rotateZ(-45deg)` — the standard change-of-basis decomposition for rotating about a diagonal
 * axis using only axis-aligned rotations, which RN's rotateX/rotateY/rotateZ fully support. The
 * two endpoints (θ=180°, fully folded flat; θ=0°, flat in the corner) land in exactly the same
 * place a true rotate3d would; only the mid-fold trajectory is a close approximation rather than
 * a pixel-exact match.
 */
function NoseFlap({ rotate, side, scale }: { rotate: Animated.AnimatedInterpolation<string>; side: 'left' | 'right'; scale: number }) {
  const size = s(110, scale);
  const points = side === 'left' ? `0,0 ${size},0 0,${size}` : `0,0 ${size},0 ${size},${size}`;
  return (
    <View style={[styles.flapWrap, side === 'left' ? { left: 0, top: 0 } : { right: 0, top: 0 }, { width: size, height: size }]}>
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [{ perspective: s(700, scale) }, { rotateZ: '45deg' }, { rotateX: rotate }, { rotateZ: '-45deg' }],
        }}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Polygon points={points} fill={inboxColor.flap} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/**
 * The letter card at (18,262) in the 390×844 reference frame, 354×330 — the header/ruled-body/
 * signature content, its tri-fold open/close animation, and the brief post-landing envelope
 * "sheet" (wings + nose flaps) shown in between. Purely reactive to the `stage` prop the screen's
 * own state machine drives — see ThrowInboxScreen for the timer chain between stages.
 */
export function LetterFoldCard({ stage, letter, isEmpty, emptyName, scale, heightScale, reduceMotion, onThrowBack, onConfirmAlert }: LetterFoldCardProps) {
  const vScale = heightScale ?? scale;
  const w = s(inboxLayout.letter.w, scale);
  const h = s(inboxLayout.letter.h, vScale);
  const panelH = s(inboxLayout.letter.panelH, vScale);

  const folded = stage !== 'open';
  const sheetOn = stage === 'landed' || stage === 'wings' || stage === 'corners';
  const wingsOpen = stage !== 'landed';
  const flat = stage === 'corners';

  // The media viewer's own open/closed state — fades a full-bleed photo/video cover in over the
  // written body instead of replacing it in place, so the card's own silhouette never jumps. Reset
  // whenever the underlying letter itself changes (a different chip, a delete landing on the next
  // one) so a stale toggle never carries over onto an unrelated letter.
  const [mediaMode, setMediaMode] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const mediaOpacity = useRef(new Animated.Value(0)).current;
  // The while-viewing seconds guide for whichever attachment is currently showing — reset on
  // every index change so switching attachments never briefly shows the previous one's numbers.
  const [mediaElapsedMs, setMediaElapsedMs] = useState(0);
  const [mediaDurationMs, setMediaDurationMs] = useState(0);
  // Sound defaults on (the viewer only opens via a direct tap, real user activation) — reset per
  // letter/attachment the same as the clock above, so a mute choice never silently carries over
  // onto someone else's video.
  const [mediaMuted, setMediaMuted] = useState(false);
  useEffect(() => {
    setMediaMode(false);
    setMediaIndex(0);
    mediaOpacity.setValue(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter?.id]);
  useEffect(() => {
    setMediaElapsedMs(0);
    setMediaDurationMs(0);
    setMediaMuted(false);
  }, [mediaIndex]);
  const toggleMediaMode = () => {
    const next = !mediaMode;
    if (next) setMediaIndex(0);
    setMediaMode(next);
    Animated.timing(mediaOpacity, { toValue: next ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  };

  // Flick up/down over the open photo/video to move to the next/previous attachment — see
  // SWIPE_COMMIT_DISTANCE/VELOCITY's own comment on why this only ever reads a gesture's start and
  // end points, never anything continuous in between. `latest` lets the web listeners below (bound
  // once) always see the current photoUrls length without needing to re-bind on every letter/index
  // change — the same pattern FoldingLetter/StoryCaptureScreen's own web gesture paths use.
  const mediaWrapRef = useRef<View>(null);
  const swipeStartRef = useRef<{ y: number; t: number } | null>(null);
  const latest = useRef({ count: 0 });
  latest.current.count = letter?.photoUrls.length ?? 0;

  // `velocity` is px/ms either way — computed by hand for the web listeners below (dy/dt over the
  // gesture's own start/end timestamps), or read directly off PanResponder's own gestureState.vy
  // for native (already the same unit, no reconstruction needed).
  const commitSwipe = (dy: number, velocity: number) => {
    const n = latest.current.count;
    if (n < 2) return;
    if (dy < -SWIPE_COMMIT_DISTANCE || velocity < -SWIPE_COMMIT_VELOCITY) {
      setMediaIndex((i) => (i + 1) % n);
    } else if (dy > SWIPE_COMMIT_DISTANCE || velocity > SWIPE_COMMIT_VELOCITY) {
      setMediaIndex((i) => (i - 1 + n) % n);
    }
  };

  // The media overlay below is only ever mounted once the letter is actually open and has
  // attachments (see its own conditional render) — binding this effect at mount time (an empty
  // dep array) would run before that node exists at all on the very first render and then never
  // retry, since nothing else would ever re-run it. Depending on that same mount condition instead
  // re-binds (finding the now-real node) every time it flips true, and tears down when it flips
  // back false (a different letter, or this one closing).
  const mediaOverlayMounted = stage === 'open' && (letter?.photoUrls.length ?? 0) > 0;

  useEffect(() => {
    if (Platform.OS !== 'web' || !mediaOverlayMounted) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = mediaWrapRef.current as any as HTMLElement | null;
    if (!node) return;
    const getY = (e: MouseEvent | TouchEvent): number | null => {
      if ('touches' in e && e.touches[0]) return e.touches[0].clientY;
      if ('changedTouches' in e && e.changedTouches[0]) return e.changedTouches[0].clientY;
      if ('clientY' in e) return e.clientY;
      return null;
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const y = getY(e);
      if (y != null) swipeStartRef.current = { y, t: Date.now() };
    };
    const onUp = (e: MouseEvent | TouchEvent) => {
      const start = swipeStartRef.current;
      swipeStartRef.current = null;
      if (!start) return;
      const y = getY(e);
      if (y == null) return;
      const dy = y - start.y;
      const dt = Date.now() - start.t;
      commitSwipe(dy, dt > 0 ? dy / dt : 0);
    };
    node.addEventListener('mousedown', onDown);
    node.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      node.removeEventListener('mousedown', onDown);
      node.removeEventListener('touchstart', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaOverlayMounted]);

  const mediaPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => Platform.OS !== 'web' && latest.current.count > 1,
        onMoveShouldSetPanResponder: (_, g) => Platform.OS !== 'web' && latest.current.count > 1 && Math.abs(g.dy) > 12,
        onPanResponderRelease: (_, g) => commitSwipe(g.dy, g.vy),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const letterScale = useRef(new Animated.Value(0.3)).current;
  const letterRotate = useRef(new Animated.Value(-10)).current;
  const letterTranslateY = useRef(new Animated.Value(0)).current;
  const letterOpacity = useRef(new Animated.Value(0)).current;
  const topRotateX = useRef(new Animated.Value(-180)).current;
  const botRotateX = useRef(new Animated.Value(180)).current;
  const topFrontOpacity = useRef(new Animated.Value(0)).current;
  const topBackOpacity = useRef(new Animated.Value(1)).current;
  const botFrontOpacity = useRef(new Animated.Value(0)).current;
  const botBackOpacity = useRef(new Animated.Value(1)).current;
  const topShade = useRef(new Animated.Value(0.3)).current;
  const botShade = useRef(new Animated.Value(0.3)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const wingL = useRef(new Animated.Value(82)).current;
  const wingR = useRef(new Animated.Value(-82)).current;
  const flapL = useRef(new Animated.Value(180)).current;
  const flapR = useRef(new Animated.Value(180)).current;

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, reduceMotion ? 0 : ms));
  };

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const dur = reduceMotion ? 0 : undefined;
    const inst = { toValue: 0, duration: 0, useNativeDriver: true };

    // ----- outer letter scale/rotate/opacity/translate -----
    if (stage === 'hidden' || stage === 'flying' || stage === 'empty') {
      letterScale.setValue(0.3);
      letterRotate.setValue(-10);
      letterTranslateY.setValue(0);
      letterOpacity.setValue(0);
    } else if (stage === 'landed') {
      letterScale.setValue(0.45);
      letterRotate.setValue(-6);
      letterTranslateY.setValue(0);
      letterOpacity.setValue(1);
    } else if (stage === 'wings' || stage === 'corners') {
      Animated.timing(letterScale, { ...inst, toValue: 0.45, useNativeDriver: true }).start();
      Animated.timing(letterRotate, { ...inst, toValue: -6, useNativeDriver: true }).start();
      letterOpacity.setValue(1);
    } else if (stage === 'expand') {
      Animated.parallel([
        Animated.timing(letterScale, { toValue: 1, duration: dur ?? 500, easing: EXPAND_EASING, useNativeDriver: true }),
        Animated.timing(letterRotate, { toValue: 0, duration: dur ?? 500, easing: EXPAND_EASING, useNativeDriver: true }),
      ]).start();
      letterOpacity.setValue(1);
    } else if (stage === 'open') {
      letterScale.setValue(1);
      letterRotate.setValue(0);
      letterTranslateY.setValue(0);
      // A plain crossfade in every case now, not just reduced motion — per explicit request, the
      // incoming letter should simply fade in once the plane lands (see useInboxArrival's own
      // foldAway/'fadeOut', the matching fade-out on the way out) rather than snap in instantly.
      Animated.timing(letterOpacity, { toValue: 1, duration: reduceMotion ? 220 : FADE_MS, useNativeDriver: true }).start();
    } else if (stage === 'fadeOut') {
      // The currently-open letter, about to be replaced by a different one (see useInboxArrival's
      // own foldAway) — just fades out in place, scale/rotate/position untouched, instead of the
      // fold-closed-then-shrink-away flourish 'folding'/'shrink' below still drive for
      // ThrowInboxScreen's own standalone arrival flow.
      Animated.timing(letterOpacity, { toValue: 0, duration: dur ?? FADE_MS, useNativeDriver: true }).start();
    } else if (stage === 'shrink') {
      Animated.timing(letterTranslateY, { toValue: 260, duration: dur ?? 340, easing: SHRINK_EASING, useNativeDriver: true }).start();
      Animated.timing(letterScale, { toValue: 0.25, duration: dur ?? 340, easing: SHRINK_EASING, useNativeDriver: true }).start();
      Animated.timing(letterRotate, { toValue: 10, duration: dur ?? 340, easing: SHRINK_EASING, useNativeDriver: true }).start();
      later(() => letterOpacity.setValue(0), 50);
    } else if (stage === 'trash') {
      Animated.timing(letterTranslateY, { toValue: 420, duration: dur ?? 500, easing: SHRINK_EASING, useNativeDriver: true }).start();
      Animated.timing(letterScale, { toValue: 0.3, duration: dur ?? 500, easing: SHRINK_EASING, useNativeDriver: true }).start();
      Animated.timing(letterRotate, { toValue: 16, duration: dur ?? 500, easing: SHRINK_EASING, useNativeDriver: true }).start();
      later(() => letterOpacity.setValue(0), 150);
    }

    // ----- tri-fold panels -----
    // 'open' and 'fadeOut' both keep the panels fully unfolded/front-facing, set instantly
    // (setValue, not Animated.timing) rather than animated — per explicit request, the in-place
    // received-letters panel no longer plays the tri-fold fold/unfold flourish at all, on either
    // the incoming letter (useInboxArrival's play() jumps straight from 'flying' to 'open') or the
    // outgoing one ('fadeOut' just fades the outer opacity down — see the block above — without
    // ever touching the fold geometry, so the currently-open letter visibly fades out as itself
    // instead of snapping to its folded/back-of-envelope appearance first). Leaving 'open' this
    // way for any *other* stage (folded true — 'folding'/'shrink'/etc., still used by
    // ThrowInboxScreen's own standalone arrival flow) keeps its animated fold exactly as before.
    if (stage === 'open' || stage === 'fadeOut') {
      topRotateX.setValue(0);
      botRotateX.setValue(0);
      topFrontOpacity.setValue(1);
      topBackOpacity.setValue(0);
      botFrontOpacity.setValue(1);
      botBackOpacity.setValue(0);
      topShade.setValue(0);
      botShade.setValue(0);
    } else {
      const topDelay = folded ? LAG : 0;
      const botDelay = folded ? 0 : LAG;
      later(() => Animated.timing(topRotateX, { toValue: folded ? -180 : 0, duration: dur ?? D, easing: FOLD_EASING, useNativeDriver: true }).start(), topDelay);
      later(() => Animated.timing(botRotateX, { toValue: folded ? 180 : 0, duration: dur ?? D, easing: FOLD_EASING, useNativeDriver: true }).start(), botDelay);
      later(() => {
        topFrontOpacity.setValue(folded ? 0 : 1);
        topBackOpacity.setValue(folded ? 1 : 0);
      }, topDelay + HALF);
      later(() => {
        botFrontOpacity.setValue(folded ? 0 : 1);
        botBackOpacity.setValue(folded ? 1 : 0);
      }, botDelay + HALF);
      Animated.timing(topShade, { toValue: folded ? 0.3 : 0, duration: dur ?? 500, useNativeDriver: true }).start();
      Animated.timing(botShade, { toValue: folded ? 0.3 : 0, duration: dur ?? 500, useNativeDriver: true }).start();
    }

    // ----- envelope sheet: wings + nose flaps -----
    sheetOpacity.setValue(sheetOn ? 1 : 0);
    if (stage === 'landed') {
      wingL.setValue(82);
      wingR.setValue(-82);
    } else if (wingsOpen) {
      Animated.timing(wingL, { toValue: 0, duration: dur ?? 500, easing: WING_EASING, useNativeDriver: true }).start();
      Animated.timing(wingR, { toValue: 0, duration: dur ?? 500, easing: WING_EASING, useNativeDriver: true }).start();
    }
    if (flat) {
      Animated.timing(flapL, { toValue: 0, duration: dur ?? 450, easing: FLAP_EASING, useNativeDriver: true }).start();
      Animated.timing(flapR, { toValue: 0, duration: dur ?? 450, easing: FLAP_EASING, useNativeDriver: true }).start();
    } else if (stage === 'landed' || stage === 'wings') {
      flapL.setValue(180);
      flapR.setValue(180);
    }

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, reduceMotion]);

  const outerStyle = {
    opacity: letterOpacity,
    transform: [{ translateY: letterTranslateY }, { scale: letterScale }, { rotate: letterRotate.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] }) }],
  };

  if (isEmpty) {
    return (
      <View style={[styles.emptyWrap, { width: w, height: h, borderRadius: s(24, scale) }]}>
        <Text style={[styles.emptyTitle, { fontSize: s(16, scale) }]}>No letters from {emptyName}</Text>
        <Text style={[styles.emptySub, { fontSize: s(10.5, scale) }]}>NEW ONES WILL FLY IN HERE</Text>
      </View>
    );
  }

  const L = letter ?? { id: '', from: '', date: '', place: '', distance: '', body: '', sig: '', count: '', photoUrls: [], photoTrims: [], alertSchedule: null, alertConfirmed: false };

  return (
    <Animated.View pointerEvents="none" style={[{ width: w, height: h }, outerStyle]}>
      {/* Middle panel — static, always visible, the tri-fold's own hinge anchor. */}
      <View style={[styles.midPanel, { top: panelH, height: panelH, width: w }]}>
        <View style={{ position: 'absolute', left: 0, top: -panelH, width: w, height: h }}>
          <RuledLines scale={scale} vScale={vScale} />
          <HeaderRow letter={L} scale={scale} />
          <BodyText body={L.body} scale={scale} />
          <SignatureRow letter={L} scale={scale} vScale={vScale} />
        </View>
      </View>

      {/*
        Bottom/top panels — each rendered as two INDEPENDENT sibling faces (not one face nested
        inside the other's animated parent) with their own directly-computed rotation, rather than
        relying on a static local rotateX(180) on the back face composing with its parent's own
        rotateX to cancel out to "upright" — that nested-3D-transform composition is exactly what
        CSS's `transform-style: preserve-3d` guarantees and React Native has no equivalent for, so
        two independently-rotating nested views here don't reliably cancel the way the design
        handoff's own CSS does (confirmed directly via a visual check: the back face rendered
        rotated/mirrored instead of upright once folded). Each face computes its own absolute
        rotation from the SAME driving Animated.Value instead, so the two are correct by
        construction — no cross-view 3D composition required. */}

      {/* Bottom panel — hinge at its own TOP edge, each face a panelH-tall clipping+rotating box
          in its own right (not an outer non-clipping wrapper around a full-height inner face,
          which left the middle panel's content visible through the "gap" — confirmed via a
          visual check). The front face's inner content is the full 330-tall letter shifted up by
          -panelH*2 so this box's own 110px window lands on the bottom slice.
          The hinge itself uses a translate/rotate/translate pivot shift (to the panel's own top
          edge) rather than the `transformOrigin` style prop — confirmed via a visual check that
          RN Web doesn't reliably apply `transformOrigin` here, silently rotating around the
          element's own center instead; the same translate-pivot technique already used correctly
          for the wing panels below sidesteps that entirely. */}
      <Animated.View
        style={[
          styles.panelFace,
          {
            position: 'absolute',
            left: 0,
            top: panelH * 2,
            width: w,
            height: panelH,
            opacity: botFrontOpacity,
            borderBottomLeftRadius: s(24, scale),
            borderBottomRightRadius: s(24, scale),
            transform: [
              { perspective: s(1200, scale) },
              { translateY: panelH / 2 },
              { rotateX: botRotateX.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] }) },
              { translateY: -panelH / 2 },
            ],
          },
        ]}
      >
        <View style={{ position: 'absolute', left: 0, top: -panelH * 2, width: w, height: h }}>
          <RuledLines scale={scale} vScale={vScale} />
          <View style={{ height: s(64, scale) }} />
          <BodyText body={L.body} scale={scale} />
          <SignatureRow letter={L} scale={scale} vScale={vScale} />
        </View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: botShade }]} />
      </Animated.View>
      {/* Back faces don't rotate at all — folding a rigid panelH-tall panel 180° about its own
          edge lands it swung fully onto the middle panel's own slot (a right-angle fold's far
          edge ends up panelH past the hinge, i.e. exactly the adjacent slot), and since these are
          only ever visible while folded (opacity-gated below, the same instant halfway-point
          swap the design's own CSS `opacity 0s` transition uses), there's nothing to animate
          into that position — they can just sit there statically, which also sidesteps needing
          any readability counter-rotation. */}
      <Animated.View
        style={[
          styles.panelBack,
          {
            position: 'absolute',
            left: 0,
            top: panelH,
            width: w,
            height: panelH,
            opacity: botBackOpacity,
            backgroundColor: inboxColor.paperBack2,
          },
        ]}
      />

      {/* Top panel — hinge at its own BOTTOM edge, same translate-pivot technique. */}
      <Animated.View
        style={[
          styles.panelFace,
          {
            position: 'absolute',
            left: 0,
            top: 0,
            width: w,
            height: panelH,
            opacity: topFrontOpacity,
            borderTopLeftRadius: s(24, scale),
            borderTopRightRadius: s(24, scale),
            transform: [
              { perspective: s(1200, scale) },
              { translateY: -panelH / 2 },
              { rotateX: topRotateX.interpolate({ inputRange: [-180, 0], outputRange: ['-180deg', '0deg'] }) },
              { translateY: panelH / 2 },
            ],
          },
        ]}
      >
        <View style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}>
          <RuledLines scale={scale} vScale={vScale} />
          <HeaderRow letter={L} scale={scale} />
          <BodyText body={L.body} scale={scale} />
        </View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: topShade }]} />
      </Animated.View>
      <Animated.View
        style={[
          styles.panelBack,
          styles.topBack,
          {
            position: 'absolute',
            left: 0,
            top: panelH,
            width: w,
            height: panelH,
            opacity: topBackOpacity,
            backgroundColor: inboxColor.paperBack,
            paddingHorizontal: s(22, scale),
          },
        ]}
      >
        <View style={{ gap: s(3, scale) }}>
          <Text style={[styles.mono, { fontSize: s(10, scale), letterSpacing: 1.2 }]}>TO</Text>
          <Text style={[styles.toName, { fontSize: s(19, scale) }]}>You</Text>
        </View>
        <View style={[styles.postmark, { width: s(58, scale), height: s(58, scale), borderRadius: s(29, scale) }]}>
          <Text style={[styles.mono, styles.postmarkPlace, { fontSize: s(9, scale) }]}>{L.place}</Text>
        </View>
      </Animated.View>

      {/* Envelope sheet — wings + nose flaps, only between landing and full open. */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: panelH, width: w, height: panelH, opacity: sheetOpacity }}>
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: w / 2,
            height: panelH,
            transform: [{ perspective: s(700, scale) }, { translateX: -w / 4 }, { rotateY: wingL.interpolate({ inputRange: [0, 82], outputRange: ['0deg', '82deg'] }) }, { translateX: w / 4 }],
          }}
        >
          <View style={[styles.wingFace, { width: w / 2, height: panelH, backgroundColor: inboxColor.paperBack, borderTopLeftRadius: s(6, scale), borderBottomLeftRadius: s(6, scale) }]} />
          <NoseFlap side="left" scale={scale} rotate={flapL.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] })} />
        </Animated.View>
        <Animated.View
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: w / 2,
            height: panelH,
            transform: [{ perspective: s(700, scale) }, { translateX: w / 4 }, { rotateY: wingR.interpolate({ inputRange: [-82, 0], outputRange: ['-82deg', '0deg'] }) }, { translateX: -w / 4 }],
          }}
        >
          <View style={[styles.wingFace, { width: w / 2, height: panelH, backgroundColor: inboxColor.paperBack, borderTopRightRadius: s(6, scale), borderBottomRightRadius: s(6, scale) }]} />
          <NoseFlap side="right" scale={scale} rotate={flapR.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] })} />
        </Animated.View>
      </Animated.View>

      {/* The media viewer — a full-bleed photo/video cover clipped to the card's own shape, the
          same treatment ContactStoryStack gives a posted status, rather than a small floating
          polaroid print. Cross-faded in via opacity alone so it occludes the written body
          underneath instead of needing to separately fade three duplicated copies of that body
          (one per tri-fold panel face — see their own comments above). Only reachable once the
          letter is genuinely open and actually has attachments. No Throw Back/Reply button lives
          on top of it — per explicit request that only belongs on the text side — its own flip
          icon (top-right) is the sole way back to text. */}
      {stage === 'open' && L.photoUrls.length > 0 && (
        <Animated.View
          ref={mediaWrapRef}
          pointerEvents={mediaMode ? 'box-none' : 'none'}
          style={[styles.mediaOverlay, { width: w, height: h, borderRadius: s(24, scale), opacity: mediaOpacity }]}
          {...mediaPanResponder.panHandlers}
        >
          {isVideoUrl(L.photoUrls[mediaIndex]) ? (
            <AutoplayVideoFill
              uri={L.photoUrls[mediaIndex]}
              trimStartMs={L.photoTrims[mediaIndex]?.startMs}
              trimEndMs={L.photoTrims[mediaIndex]?.endMs}
              onTimeUpdate={(cur, dur) => {
                setMediaElapsedMs(cur);
                setMediaDurationMs(dur);
              }}
              muted={mediaMuted}
              onAutoplayBlocked={() => setMediaMuted(true)}
            />
          ) : (
            <Image source={{ uri: L.photoUrls[mediaIndex] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}
          {isVideoUrl(L.photoUrls[mediaIndex]) && mediaDurationMs > 0 && (
            <Text style={[styles.videoClock, { fontSize: s(12, scale), top: s(14, vScale), paddingHorizontal: s(9, scale), paddingVertical: s(3, scale), borderRadius: s(14, scale) }]}>
              {formatClockMs(mediaElapsedMs)} / {formatClockMs(mediaDurationMs)}
            </Text>
          )}
          {isVideoUrl(L.photoUrls[mediaIndex]) && (
            <GlassIconButton
              onPress={() => setMediaMuted((m) => !m)}
              path={mediaMuted ? VOLUME_MUTED_ICON : VOLUME_ICON}
              scale={scale}
              accessibilityLabel={mediaMuted ? 'Unmute' : 'Mute'}
              style={{ position: 'absolute', top: s(14, vScale), left: s(14, scale) }}
            />
          )}

          <GlassIconButton
            onPress={toggleMediaMode}
            path={FLIP_ICON}
            scale={scale}
            accessibilityLabel="Flip back to letter text"
            style={{ position: 'absolute', top: s(14, vScale), right: s(14, scale) }}
          />
          {L.photoUrls.length > 1 && (
            <>
              <GlassIconButton
                onPress={() => setMediaIndex((i) => (i - 1 + L.photoUrls.length) % L.photoUrls.length)}
                path={CHEVRON_LEFT_ICON}
                scale={scale}
                accessibilityLabel="Previous photo or video"
                style={{ position: 'absolute', bottom: s(14, vScale), left: s(14, scale) }}
              />
              <GlassIconButton
                onPress={() => setMediaIndex((i) => (i + 1) % L.photoUrls.length)}
                path={CHEVRON_RIGHT_ICON}
                scale={scale}
                accessibilityLabel="Next photo or video"
                style={{ position: 'absolute', bottom: s(14, vScale), right: s(14, scale) }}
              />
            </>
          )}
        </Animated.View>
      )}

      {stage === 'open' && onThrowBack && !mediaMode && (
        // `bottom` needs vScale, not scale — same reasoning as SignatureRow's own bottom offset —
        // so this stays a small gap above the card's own (independently scaled) bottom edge. Only
        // the text side shows this row at all — media mode's own flip/prev/next glass buttons
        // (above) replace it entirely rather than layering on top of it.
        <View pointerEvents="box-none" style={[styles.throwBackOuter, { bottom: s(14, vScale), gap: s(10, scale) }]}>
          <View style={[styles.throwBackWrap, { gap: s(12, scale) }]}>
            <GlassIconButton onPress={onThrowBack} label="Reply" scale={scale} accessibilityLabel="Reply" tintColor="rgba(47,107,255,.55)" />
            {/* The sender's own attached reminder request (see LetterCardData's own alertSchedule)
                — only shows once there's actually one to confirm, and disappears once confirmed
                (same "this letter needs your action" convention as Reply, not a locked/dimmed
                state like the gallery button below, since a confirmed request has nothing left to
                do here). */}
            {L.alertSchedule && !L.alertConfirmed && onConfirmAlert && (
              <GlassIconButton onPress={onConfirmAlert} label="Confirm" scale={scale} accessibilityLabel={`Confirm reminder, ${formatAlertSchedule(L.alertSchedule)}`} tintColor="rgba(47,169,107,.6)" />
            )}
            {/* Locked (no onPress, dimmed) rather than hidden when the letter has no attachments —
                per explicit request — so its presence itself says "this letter has no media"
                instead of the row just quietly having one fewer button. */}
            <GlassIconButton
              onPress={L.photoUrls.length > 0 ? toggleMediaMode : undefined}
              path={IMAGE_ICON}
              scale={scale}
              accessibilityLabel="View attached photos or videos"
              disabled={L.photoUrls.length === 0}
              tintColor="rgba(47,107,255,.55)"
            />
          </View>
        </View>
      )}
    </Animated.View>
  );
}

/** A small round frosted-glass button — every icon control the media viewer and its "View media"/
 * "Reply" entry points use, so they read as one consistent chrome family instead of each
 * reinventing a background/border treatment. Medium-sized (not the smaller size these used to be)
 * per explicit request. `tintColor` lets the text-side entry points (sitting on plain paper, not a
 * photo) use Throw's own accent blue instead of the neutral dark glass the on-photo controls use,
 * which would otherwise all but disappear against the paper background. Takes `path` (drawn via
 * the shared stroke-based Icon component) for a circular icon button, or `label` for a wider
 * rounded-pill text button (e.g. "Reply") using the same glass chrome. */
function GlassIconButton({
  onPress,
  path,
  label,
  scale,
  accessibilityLabel,
  disabled,
  style,
  tintColor = 'rgba(0,0,0,.32)',
}: {
  onPress?: () => void;
  path?: string;
  label?: string;
  scale: number;
  accessibilityLabel: string;
  disabled?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: any;
  tintColor?: string;
}) {
  const size = s(48, scale);
  if (label) {
    return (
      <Pressable onPress={disabled ? undefined : onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={style}>
        <GlassSurface
          tint="dark"
          tintColor={tintColor}
          style={[styles.glassBtn, { height: size, borderRadius: size / 2, paddingHorizontal: s(22, scale), opacity: disabled ? 0.4 : 1 }]}
        >
          <Text style={{ color: '#FFFFFF', fontSize: s(15, scale), fontWeight: '600' }}>{label}</Text>
        </GlassSurface>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={disabled ? undefined : onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={style}>
      <GlassSurface tint="dark" tintColor={tintColor} style={[styles.glassBtn, { width: size, height: size, borderRadius: size / 2, opacity: disabled ? 0.4 : 1 }]}>
        <Icon path={path!} size={s(21, scale)} color="#FFFFFF" strokeWidth={2.2} />
      </GlassSurface>
    </Pressable>
  );
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

// `scale` still governs the horizontal margins (matching HeaderRow/BodyText's own horizontal
// padding), but `vScale` drives everything vertical — the top/bottom insets and the line spacing
// — so the ruled area actually fills the card's own (independently scaled) height instead of
// leaving blank space below the last line whenever vScale runs taller than scale.
function RuledLines({ scale, vScale }: { scale: number; vScale: number }) {
  const lineGap = s(34, vScale);
  const count = Math.ceil(s(inboxLayout.letter.panelH * 2.5, vScale) / lineGap);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: s(24, scale), right: s(24, scale), top: s(108, vScale), bottom: s(62, vScale), overflow: 'hidden' }}>
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
  return (
    <Text style={[styles.body, { paddingHorizontal: s(24, scale), paddingTop: s(14, scale), fontSize: s(25, scale), lineHeight: s(34, scale) }]}>{body}</Text>
  );
}

function SignatureRow({ letter, scale, vScale }: { letter: LetterCardData; scale: number; vScale: number }) {
  // `bottom` needs vScale, not scale, to stay a small offset from the card's own (independently
  // scaled) bottom edge rather than drifting away from it whenever vScale runs taller than scale.
  return (
    <View style={{ position: 'absolute', left: s(24, scale), right: s(24, scale), bottom: s(20, vScale), flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={[styles.sig, { fontSize: s(22, scale) }]}>{letter.sig}</Text>
      <Text style={[styles.mono, { fontSize: s(10.5, scale) }]}>{letter.count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  midPanel: { position: 'absolute', left: 0, right: 0, backgroundColor: inboxColor.paper, overflow: 'hidden' },
  panelFace: { position: 'absolute', left: 0, backgroundColor: inboxColor.paper, overflow: 'hidden', backfaceVisibility: 'hidden' },
  panelBack: { position: 'absolute', left: 0, top: 0, backfaceVisibility: 'hidden', borderRadius: 6 },
  topBack: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wingFace: { position: 'absolute', left: 0, top: 0, backfaceVisibility: 'hidden' },
  flapWrap: { position: 'absolute' },
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
  toName: { fontFamily: 'Figtree_800ExtraBold', color: inboxColor.ink },
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
  throwBackOuter: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  throwBackWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  mediaOverlay: { position: 'absolute', left: 0, top: 0, backgroundColor: '#000000', overflow: 'hidden' },
  glassBtn: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,.4)' },
  videoClock: {
    position: 'absolute',
    alignSelf: 'center',
    color: '#FFFFFF',
    fontFamily: 'Figtree_700Bold',
    backgroundColor: 'rgba(0,0,0,.4)',
  },
});
