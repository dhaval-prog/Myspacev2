import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, LayoutChangeEvent, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LetterCanvas } from './LetterCanvas';
import { PaperPlane } from './PaperPlane';
import { PaperPlaneStage } from './PaperPlaneStage';
import { PhotoAttachSheet } from './PhotoAttachSheet';
import { GlassSurface } from '../friends/GlassSurface';
import { Icon } from '../Icon';
import { throwColor, throwFont, throwGlass, throwRadius } from '../../theme/throwTokens';
import { useVoiceToText } from '../../hooks/useVoiceToText';
import type { LetterCanvasHandle } from './LetterCanvas';
import type { PaperPlaneStageHandle } from './paperPlaneTypes';
import type { StrokePath } from '../../types/throw';

const PHOTO_ICON = 'M4 8h4l1.6-2.5h4.8L16 8h4v11H4z M12 11.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';
const MIC_ICON = 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z M6 11a6 6 0 0 0 12 0 M12 19v3 M9.5 22h5';
const STOP_ICON = 'M6 6h12v12H6z';
const INBOX_ICON = 'M3 11h5l1.8 2.8h4.4L16 11h5 M3 11V5h18v6 M3 11v7a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-7';
const X_ICON = 'M6 6l12 12M18 6L6 18';
// Same glyphs as HomeScreen/ChatsListScreen's own Chats/QR icons — reused here so this row
// reads as the same actions, not a Throw-specific reinterpretation.
const CHAT_ICON = 'M20 11.5a7.5 7.5 0 0 1-10.7 6.8L4 19.5l1.3-4.9A7.5 7.5 0 1 1 20 11.5z';
const QR_ICON = 'M3.5 3.5h6.5v6.5h-6.5z M14 3.5h6.5v6.5h-6.5z M3.5 14h6.5v6.5h-6.5z M14 14h3v3h-3zM20.5 17.5v3h-3';

const FOLD_DRAG_DISTANCE = 150;
const LAUNCH_THRESHOLD = 64;
const LAUNCH_VELOCITY = 0.5;
// A downward drag on the paper only starts a fold once it's clearly vertical and past this many
// px — short/lateral movement is left alone for LetterCanvas's own stroke gesture underneath.
const FOLD_CAPTURE_DY = 14;
const FOLD_CAPTURE_RATIO = 1.7;
// Once folded, an upward swipe only throws when it starts in this middle fraction of the paper's
// width — the outer edges on either side are reserved for unfolding instead (see the 'ready'-phase
// branches in the PanResponder below).
const THROW_CENTER_ZONE = 0.5;
// How many px of horizontal drag maps to the plane's full bank (±1 passed to setReadyBank) —
// past this the bank is already maxed out, it just doesn't tilt any further.
const MAX_BANK_DX = 90;
// How many px of horizontal drag maps to one recipient step — reported live via
// onContactDragOffset as a fractional step count, so the caller can move (and clamp) the
// selection continuously as the drag progresses rather than waiting for release.
const CONTACT_DRAG_SPACING = 70;
// On launch, the plane's own local flourish is a straight vertical translate-and-fade off the
// top of the screen — the whole window height comfortably clears the compose card's position
// and the header pill above it on any device, and since it's fading to 0 opacity at the same
// time, overshooting past the header has no visible downside.
const LIFTOFF_DURATION_MS = 1500;
const liftoffDistance = () => Dimensions.get('window').height;

type Phase = 'writing' | 'folding' | 'ready' | 'throwing';

interface FoldingLetterContent {
  messageText: string | null;
  strokes: StrokePath[] | null;
  penColor: string;
  /** Every locally-picked photo (camera or library), not yet uploaded — the parent uploads each
   * one and resolves their public URLs as part of actually sending the throw. */
  photoUris: string[];
}

interface FoldingLetterProps {
  recipientName: string;
  recipientCity: string;
  /** No recipient to write to yet — disables the fold/throw gesture. */
  disabled?: boolean;
  /** Called once the user flicks the folded plane upward. Resolve with an error to spring the plane back to 'ready' with a message; resolve with null on success. */
  onThrow: (content: FoldingLetterContent) => Promise<{ error: string | null }>;
  /** Fires once the local fold-and-liftoff animation finishes after a successful throw — the
   * parent uses this as its cue to start the map-level flight animation and swap this compose
   * card out for it (the two are sequenced, not simultaneous, so they don't compete for
   * attention). */
  onLaunched: () => void;
  throwLabel?: string;
  /** Opens Orbit's Chats list — its button lives between Photo and Voice in the bottom-controls
   * row, rather than in a separate header. */
  onOpenChats: () => void;
  /** Opens the QR "Add a friend" sheet — its button lives between Voice and Inbox. */
  onOpenAddFriend: () => void;
  /** Opens the inbox — its button lives in the bottom-controls row below the paper alongside
   * Photo and Voice, rather than in a separate header. */
  onOpenInbox: () => void;
  unreadCount: number;
  /** Fires once, right when a center-zone hold-and-drag starts on the folded, ready-to-throw
   * plane — the caller's cue to snapshot which recipient is currently selected before live
   * offsets (below) start moving it. Only wired once there's more than one recipient to cycle
   * through. */
  onContactDragStart?: () => void;
  /** Fires continuously while that same drag moves, with the horizontal offset expressed as a
   * fractional recipient-step count (see CONTACT_DRAG_SPACING) relative to the drag's start —
   * not capped at ±1, so a longer drag can move several recipients over. The caller rounds and
   * clamps against its own list length. */
  onContactDragOffset?: (steps: number) => void;
}

/**
 * The paper letter — pulling down anywhere on the paper itself folds it into a plane (reversible;
 * let go before it settles to keep writing). Once folded, an upward swipe from the middle throws
 * it; the same upward swipe from either side edge unfolds it back to writing instead — so an
 * off-center flick can't accidentally launch the letter. The fold/flight visual is a real 3D scene
 * (PaperPlaneStage, ported from the design handoff's
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
export function FoldingLetter({
  recipientName,
  recipientCity,
  disabled,
  onThrow,
  onLaunched,
  throwLabel = 'Swipe up to throw',
  onOpenChats,
  onOpenAddFriend,
  onOpenInbox,
  unreadCount,
  onContactDragStart,
  onContactDragOffset,
}: FoldingLetterProps) {
  const [phase, setPhase] = useState<Phase>('writing');
  const [content, setContent] = useState<Omit<FoldingLetterContent, 'photoUris'>>({ messageText: null, strokes: null, penColor: throwColor.ink });
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paperSize, setPaperSize] = useState({ width: 0, height: 0 });
  const [stageFailed, setStageFailed] = useState(false);
  const letterCanvasRef = useRef<LetterCanvasHandle>(null);
  const voice = useVoiceToText({ onFinalText: (text) => letterCanvasRef.current?.appendText(text) });

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
  // Which horizontal zone a 'ready'-phase gesture started in — set on grant, read by that same
  // gesture's move/release handlers. 'center' throws on an upward swipe; 'side' unfolds instead.
  const readyZoneRef = useRef<'center' | 'side'>('center');
  // Whether the gesture currently in flight started from the 'ready' phase — set on grant,
  // cleared on release. The side-zone unfold calls applyFoldProgress, which (by design, for the
  // writing-phase fold-drag) flips `phase` to 'folding' the moment progress first moves off its
  // endpoint; re-checking `phase === 'ready'` on every subsequent move/release tick would then see
  // 'folding' instead and stop routing to this gesture's own handlers, permanently orphaning it
  // mid-swipe (release never fires settleFold, so both phase and progress get stuck). This flag
  // identifies the gesture by its own lifetime instead of by a `phase` value the gesture itself
  // changes out from under it.
  const readyGestureActiveRef = useRef(false);

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

  const hasContent = content.strokes !== null || (content.messageText?.trim().length ?? 0) > 0 || photoUris.length > 0;

  const settleFold = (target: 0 | 1) => {
    Animated.spring(progress, { toValue: target, useNativeDriver: false, friction: 9, tension: 55 }).start(() => {
      setPhase(target === 1 ? 'ready' : 'writing');
      if (target === 1) stageRef.current?.holdReady();
      if (target === 0) bakedRef.current = false;
      dragAnchorRef.current = null;
    });
  };

  const springLiftBack = () => {
    stageRef.current?.setReadyBank(0);
    Animated.parallel([
      Animated.spring(liftY, { toValue: 0, useNativeDriver: false, friction: 7, tension: 50 }),
      Animated.spring(liftOpacity, { toValue: 1, useNativeDriver: false, friction: 7, tension: 50 }),
    ]).start();
  };

  const launch = async () => {
    setError(null);
    setPhase('throwing');
    // A brief local flourish — the already-rendered plane translates straight up off the top of
    // the screen and fades out — plays out in parallel with the actual send, both awaited below.
    // This is a flat 2D translate/opacity on the existing view, not the engine's own 3D fly()
    // sequence (which could render as a clipped, glitchy shape mid-flight on some devices, see
    // prior history here). The map itself still owns the "flies to the recipient" visual once
    // this finishes (see ThrowHomeScreen's runFlight) — awaiting both together means that handoff
    // always comes right after this liftoff completes, not before it, regardless of network speed.
    const liftOff = new Promise<void>((resolve) => {
      Animated.parallel([
        Animated.timing(liftY, { toValue: -liftoffDistance(), duration: LIFTOFF_DURATION_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(liftOpacity, { toValue: 0, duration: LIFTOFF_DURATION_MS, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
      ]).start(() => resolve());
    });
    const [{ error: err }] = await Promise.all([onThrow({ ...content, photoUris }), liftOff]);

    if (err) {
      setError(err);
      setPhase('ready');
      stageRef.current?.seek(1);
      stageRef.current?.holdReady();
      springLiftBack();
    } else {
      onLaunched();
    }
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
  const latest = useRef({
    disabled,
    phase,
    hasContent,
    content,
    photoUris,
    paperSize,
    launch,
    settleFold,
    springLiftBack,
    onContactDragStart,
    onContactDragOffset,
  });
  latest.current = {
    disabled,
    phase,
    hasContent,
    content,
    photoUris,
    paperSize,
    launch,
    settleFold,
    springLiftBack,
    onContactDragStart,
    onContactDragOffset,
  };

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
        // The folded plane's baked texture only carries the first attached photo — see
        // paperPlaneTypes.ts's PaperPlaneLetterContent, which still takes a single photoUri.
        // Stamping every attached photo onto the fragile 3D fold/texture pipeline isn't worth
        // the risk; the flat compose paper (below) is where all of them are visible.
        stageRef.current?.setContent({ ...latest.current.content, photoUri: latest.current.photoUris[0] ?? null }, latest.current.paperSize);
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
        onPanResponderGrant: (e) => {
          if (latest.current.phase === 'ready') {
            liftY.setValue(0);
            readyGestureActiveRef.current = true;
            // Which zone this swipe started in decides throw-vs-unfold for its whole lifetime
            // (below) — a fresh claim each touch, not the fold-drag's move-capture negotiation,
            // so gestureState is reliable here even on web.
            const width = latest.current.paperSize.width;
            const x = e.nativeEvent.locationX;
            const margin = (1 - THROW_CENTER_ZONE) / 2;
            readyZoneRef.current = width > 0 && x / width >= margin && x / width <= 1 - margin ? 'center' : 'side';
            if (readyZoneRef.current === 'center') {
              latest.current.onContactDragStart?.();
            }
          }
        },
        onPanResponderMove: (_, g) => {
          if (readyGestureActiveRef.current) {
            if (readyZoneRef.current === 'side') {
              // Dragging up from a side edge unfolds — the mirror image of the fold-drag's own
              // dy/FOLD_DRAG_DISTANCE math, just starting from 1 and counting down as dy goes
              // negative. This calls applyFoldProgress, which flips `phase` to 'folding' the
              // moment progress first moves — routing on readyGestureActiveRef instead of
              // re-checking `phase` here is what keeps this gesture's own moves reaching this
              // branch for its whole lifetime despite that.
              const next = Math.max(0, Math.min(1, 1 + g.dy / FOLD_DRAG_DISTANCE));
              applyFoldProgress(next);
            } else {
              // Position stays put — only the vertical throw-prep (liftY) moves the plane on
              // screen. Horizontal drag banks it in place instead (see setReadyBank), so it reads
              // as "tilting to pick a direction" rather than "sliding sideways". The same drag
              // also reports a live, uncapped step offset so the caller can move (and clamp) the
              // selected recipient continuously, without waiting for release.
              liftY.setValue(Math.min(0, g.dy));
              stageRef.current?.setReadyBank(g.dx / MAX_BANK_DX);
              latest.current.onContactDragOffset?.(g.dx / CONTACT_DRAG_SPACING);
            }
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
          if (readyGestureActiveRef.current) {
            // Clear before settling — same reasoning as the raw DOM tracker's onUp: closes off any
            // stray move event that might otherwise land after release and re-drive progress.
            readyGestureActiveRef.current = false;
            stageRef.current?.setReadyBank(0);
            if (readyZoneRef.current === 'side') {
              latest.current.settleFold(progressRef.current >= 0.5 ? 1 : 0);
              return;
            }
            // Recipient selection already moved live during the drag (onContactDragOffset above)
            // — a horizontal-only release just springs the plane back without launching, since it
            // won't cross the vertical launch thresholds below.
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
        // Denies any other view's mid-gesture takeover request. This used to unconditionally
        // grant it (`() => true`), which let some other responder elsewhere in the tree hijack an
        // already-in-progress swipe-up-to-throw drag partway through — onPanResponderRelease (and
        // so launch()) then never fires at all, since the gesture ends via onPanResponderTerminate
        // instead. Confirmed directly: instrumenting this handler showed a termination request
        // landing mid-drag, at the exact point the reported "swipe up doesn't throw" symptom
        // started. Nothing here relies on giving up responder status once granted — the writing-
        // phase fold-drag's own handoff FROM LetterCanvas happens earlier, during move-capture
        // (onMoveShouldSetPanResponderCapture), before a responder is even granted, so it's
        // unaffected by this.
        onPanResponderTerminationRequest: () => false,
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
          <LetterCanvas ref={letterCanvasRef} onContentChange={setContent} hasPhoto={photoUris.length > 0} />
        </Animated.View>

        {paperSize.width > 0 && (
          <Animated.View
            // Position only ever moves vertically (liftY, throw-prep and the launch liftoff) —
            // horizontal drag banks the plane in place via the 3D engine's own setReadyBank
            // instead of translating this view, and the engine's own 'ready'-phase pose now
            // handles the straight-ahead, nose-down resting tilt (see paperPlaneEngine.ts), so no
            // CSS transform trickery is needed here any more. liftOpacity is folded into this
            // wrapper's own opacity (not just the fallback glyph's) so the launch fade-out covers
            // the real 3D canvas too.
            style={[StyleSheet.absoluteFill, { opacity: Animated.multiply(stageOpacity, liftOpacity), transform: [{ translateY: liftY }] }]}
            pointerEvents="none"
          >
            {stageFailed ? (
              <View style={styles.fallbackPlaneWrap}>
                <PaperPlane size={64} color={throwColor.clayDeep} />
              </View>
            ) : (
              <PaperPlaneStage ref={stageRef} onPhase={handleStagePhase} onError={handleStageError} />
            )}
          </Animated.View>
        )}

        {photoUris.length > 0 && (
          // Fades out in lockstep with LetterCanvas (same canvasOpacity) once folding starts —
          // only the first photo is baked into the plane's own texture from that point on (see
          // applyFoldProgress above), so this flat strip would otherwise float on top of the
          // plane as extra, un-folded copies.
          <Animated.View style={[styles.photoStripWrap, { opacity: canvasOpacity }]} pointerEvents={phase === 'writing' ? 'box-none' : 'none'}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStripContent}>
              {photoUris.map((uri, i) => (
                <View key={`${uri}-${i}`} style={styles.photoThumbWrap}>
                  <View style={styles.photoThumbFrame}>
                    <Image source={{ uri }} style={styles.photoThumbImg} />
                  </View>
                  <Pressable
                    onPress={() => setPhotoUris((prev) => prev.filter((_, idx) => idx !== i))}
                    hitSlop={8}
                    style={styles.photoThumbRemove}
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo"
                  >
                    <Icon path={X_ICON} size={11} color={throwColor.paper} strokeWidth={2.6} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        )}
      </View>

      {phase === 'ready' && <Text style={styles.readyHint}>{throwLabel}</Text>}
      {voice.recording && <Text style={styles.readyHint}>{voice.interimText || 'Listening…'}</Text>}
      {(error || voice.error) && <Text style={styles.error}>{error ?? voice.error}</Text>}

      <View style={styles.bottomRow}>
        <Pressable
          onPress={() => setPhotoSheetOpen(true)}
          disabled={disabled || phase === 'throwing'}
          accessibilityRole="button"
          accessibilityLabel="Add a photo"
        >
          {({ pressed }) => (
            <View style={[styles.roundBtnShadow, pressed && styles.roundBtnPressed]}>
              <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.roundBtn}>
                <Icon path={PHOTO_ICON} size={25} color={throwColor.ink} strokeWidth={1.8} />
              </GlassSurface>
            </View>
          )}
        </Pressable>

        <Pressable onPress={onOpenChats} accessibilityRole="button" accessibilityLabel="Chats">
          {({ pressed }) => (
            <View style={[styles.roundBtnShadow, pressed && styles.roundBtnPressed]}>
              <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.roundBtn}>
                <Icon path={CHAT_ICON} size={25} color={throwColor.ink} strokeWidth={1.8} />
              </GlassSurface>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => (voice.recording ? voice.stop() : voice.start())}
          disabled={disabled || phase === 'throwing'}
          accessibilityRole="button"
          accessibilityLabel={voice.recording ? 'Stop recording' : 'Speak your letter'}
        >
          {({ pressed }) =>
            voice.recording ? (
              <View style={[styles.micBtnShadow, pressed && styles.roundBtnPressed]}>
                <View style={[styles.micBtn, styles.micBtnActive]}>
                  <Icon path={STOP_ICON} size={22} color={throwColor.paper} strokeWidth={1.8} />
                </View>
              </View>
            ) : (
              <View style={[styles.micBtnShadow, pressed && styles.roundBtnPressed]}>
                <GlassSurface tint="light" tintColor={throwGlass.tintStrong} style={styles.micBtn}>
                  <Icon path={MIC_ICON} size={27} color={throwColor.ink} strokeWidth={1.8} />
                </GlassSurface>
              </View>
            )
          }
        </Pressable>

        <Pressable onPress={onOpenAddFriend} accessibilityRole="button" accessibilityLabel="Add a friend">
          {({ pressed }) => (
            <View style={[styles.roundBtnShadow, pressed && styles.roundBtnPressed]}>
              <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.roundBtn}>
                <Icon path={QR_ICON} size={25} color={throwColor.ink} strokeWidth={1.8} />
              </GlassSurface>
            </View>
          )}
        </Pressable>

        <Pressable onPress={onOpenInbox} accessibilityRole="button" accessibilityLabel="Inbox">
          {({ pressed }) => (
            <View style={[styles.roundBtnShadow, pressed && styles.roundBtnPressed]}>
              <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.roundBtn}>
                <Icon path={INBOX_ICON} size={25} color={throwColor.ink} strokeWidth={1.8} />
              </GlassSurface>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeLabel}>{unreadCount}</Text>
                </View>
              )}
            </View>
          )}
        </Pressable>
      </View>

      <PhotoAttachSheet visible={photoSheetOpen} onClose={() => setPhotoSheetOpen(false)} onPicked={(uris) => setPhotoUris((prev) => [...prev, ...uris])} />
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
  // Compact on purpose — the bottom-controls row below now takes a fixed slice of `wrap`'s
  // height, and this being `flex: 1` rather than a hardcoded height means it shrinks to make
  // room for that row automatically, no matter what height the parent hands `wrap`.
  paperArea: { flex: 1, minHeight: 150 },
  fallbackPlaneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  readyHint: { fontFamily: throwFont.ui600, fontSize: 12, color: throwColor.inkMute, textAlign: 'center', marginTop: 10 },
  error: { fontFamily: throwFont.ui400, fontSize: 12, color: '#B3413A', textAlign: 'center', marginTop: 8 },
  // A "photos pasted onto the letter" look — a horizontal row of small white-bordered thumbnails
  // near the top of the paper, scrollable once there are more than fit. Spans most of the paper's
  // width rather than sitting in one corner, since there can be several now — LetterCanvas
  // reserves extra top padding (hasPhoto) as a guard against the writing area starting underneath.
  photoStripWrap: {
    position: 'absolute',
    top: 16,
    left: 14,
    right: 14,
  },
  photoStripContent: { alignItems: 'center', gap: 10, paddingRight: 6 },
  photoThumbWrap: { width: 72, height: 72 },
  photoThumbFrame: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: throwColor.paper,
    padding: 5,
    ...throwColor.shadowSoft,
  },
  photoThumbImg: { width: '100%', height: '100%', borderRadius: 4 },
  photoThumbRemove: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: throwColor.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A plain row — every icon visible at once, no scrolling.
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  // Split in two: the outer *Shadow view carries the drop shadow (which needs `overflow: visible`
  // to render), while the inner GlassSurface/View needs `overflow: hidden` so its blur/tint
  // layers respect the rounded corners — the two requirements can't share one style.
  roundBtnShadow: { width: 60, height: 60, borderRadius: 30, ...throwColor.shadowSoft },
  roundBtn: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  roundBtnPressed: { opacity: 0.7 },
  micBtnShadow: { width: 76, height: 76, borderRadius: 38, ...throwColor.shadowSoft },
  micBtn: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  micBtnActive: { backgroundColor: throwColor.clayDeep },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: throwColor.unread,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeLabel: { fontFamily: throwFont.ui700, fontSize: 10.5, color: '#fff' },
});
