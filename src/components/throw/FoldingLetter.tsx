import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, LayoutChangeEvent, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LetterCanvas } from './LetterCanvas';
import { PaperPlane } from './PaperPlane';
import { PaperPlaneStage } from './PaperPlaneStage';
import { PhotoAttachSheet } from './PhotoAttachSheet';
import type { PickedMedia } from './PhotoAttachSheet';
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
// A plain filled play-triangle, used as the placeholder for an attached video thumbnail — there's
// no on-device video-frame decoding here, so this (not a broken <Image>) is what a video chip
// shows instead of an actual preview frame.
const PLAY_ICON = 'M8 5v14l11-7z';
// Same glyphs as HomeScreen/ChatsListScreen's own Chats/QR icons — reused here so this row
// reads as the same actions, not a Throw-specific reinterpretation.
const CHAT_ICON = 'M20 11.5a7.5 7.5 0 0 1-10.7 6.8L4 19.5l1.3-4.9A7.5 7.5 0 1 1 20 11.5z';
const QR_ICON = 'M3.5 3.5h6.5v6.5h-6.5z M14 3.5h6.5v6.5h-6.5z M3.5 14h6.5v6.5h-6.5z M14 14h3v3h-3zM20.5 17.5v3h-3';
// Feather Icons' "award" glyph — the leaderboard-points badge, moved here from ThrowHomeScreen's
// header now that the badge itself lives in the paper's top-right corner instead.
const POINTS_ICON = 'M12 15a7 7 0 100-14 7 7 0 000 14z M8.21 13.89L7 23l5-3 5 3-1.21-9.12';

// Speech recognizers pick one language per session — they don't detect/mix several at once — so
// dictation offers a small cycling chip next to the mic button instead of silently guessing.
// BCP-47 locales; the Indian-English variant (not en-US) since the other three are Indian
// languages and this app's audience is already Indian-English by default elsewhere (Bollywood
// trivia, etc.).
const VOICE_LANGUAGES = [
  { code: 'en-IN', label: 'EN' },
  { code: 'hi-IN', label: 'HI' },
  { code: 'mr-IN', label: 'MR' },
  { code: 'gu-IN', label: 'GU' },
] as const;

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
// Once a center-zone 'ready'-phase drag moves at least this far, more vertically than
// horizontally by this ratio, it's read as a committed swipe-up-to-throw rather than a
// hold-and-tilt-to-pick-a-recipient — see the vertical-lock comment on the move handler below.
const THROW_LOCK_MIN_DY = 20;
const THROW_LOCK_RATIO = 1.5;
// Mirrors FOLD_DRAG_DISTANCE, but for scroll-wheel/trackpad input instead of a touch drag — a
// vertical scroll over the compose card (anywhere except the message text itself, so a long
// message can still scroll normally) folds or unfolds the letter the same way dragging the paper
// does, at roughly this many cumulative px of wheel delta for the full 0→1 range. A wheel/trackpad
// "tick" is a much coarser, less consistent unit than a touch drag's pixels, so this is deliberately
// looser than FOLD_DRAG_DISTANCE rather than reused as the same constant.
const WHEEL_FOLD_DISTANCE = 500;
// How long to wait after the last wheel event before treating the scroll gesture as "over" and
// settling to the nearer end (0 or 1), same threshold rule as a released touch drag — there's no
// cross-browser "scroll ended" event to key off instead, so this is a debounce.
const WHEEL_SETTLE_DEBOUNCE_MS = 180;

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
  /** The current throw streak with this recipient — rendered as a small badge in the paper's
   * top-right corner (0 hides it), moved here from a separate header chip so it reads as part
   * of the letter rather than app chrome. */
  streak: number;
  /** Leaderboard points with this recipient — same top-right badge row as `streak`, always
   * shown regardless of sign (a negative points chip is meaningful, not an empty state). */
  points: number;
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
  /** Fires on every change to the fold amount (0 = flat writing paper, 1 = folded-and-ready
   * plane) regardless of what's driving it — the pointer-drag fold above or the scroll-wheel
   * fold below both funnel through the same `progress` value. The caller uses this to fade
   * (and slide) its own BottomNav out in lockstep with the paper folding away, and back in as
   * it unfolds. */
  onFoldProgress?: (value: number) => void;
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
  streak,
  points,
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
  onFoldProgress,
}: FoldingLetterProps) {
  const [phase, setPhase] = useState<Phase>('writing');
  const [content, setContent] = useState<Omit<FoldingLetterContent, 'photoUris'>>({ messageText: null, strokes: null, penColor: throwColor.ink });
  const [mediaItems, setMediaItems] = useState<PickedMedia[]>([]);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paperSize, setPaperSize] = useState({ width: 0, height: 0 });
  const [stageFailed, setStageFailed] = useState(false);
  const [voiceLangIndex, setVoiceLangIndex] = useState(0);
  const letterCanvasRef = useRef<LetterCanvasHandle>(null);
  const voice = useVoiceToText({ onFinalText: (text) => letterCanvasRef.current?.appendText(text) });

  // Mirrors the live not-yet-final transcript onto the paper itself, in real time, as it's being
  // spoken — not just into the small "Listening…" hint below. Clears itself for free whenever
  // voice.interimText resets (each phrase finalizing, an error, or recognition ending), since this
  // effect just always reflects its current value.
  useEffect(() => {
    letterCanvasRef.current?.setInterimText(voice.interimText);
  }, [voice.interimText]);

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
  // The whole compose card (paper + hint + bottom-controls row) — scroll-wheel fold/unfold (see
  // the effect below) listens here rather than on paperAreaRef, since it's meant to work whether
  // the cursor happens to be over the paper or elsewhere on the card.
  const wrapRef = useRef<View>(null);
  const wheelSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  // Set once a center-zone 'ready'-phase drag commits to being a vertical swipe-up-to-throw
  // (see THROW_LOCK_MIN_DY/RATIO) — from that point on, for the rest of that same gesture, the
  // plane's bank snaps back to straight and the recipient selection stops moving even if the
  // finger keeps drifting sideways, so an upward swipe can't accidentally re-tilt the plane or
  // change who it's about to be thrown to. Reset on every fresh grant.
  const throwLockedRef = useRef(false);

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
      latest.current.onFoldProgress?.(value);
    });
    return () => progress.removeListener(id);
  }, [progress]);

  const hasContent = content.strokes !== null || (content.messageText?.trim().length ?? 0) > 0 || mediaItems.length > 0;

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
      Animated.spring(liftY, { toValue: 0, useNativeDriver: true, friction: 7, tension: 50 }),
      Animated.spring(liftOpacity, { toValue: 1, useNativeDriver: true, friction: 7, tension: 50 }),
    ]).start();
  };

  const launch = async () => {
    setError(null);
    setPhase('throwing');
    // A brief local flourish — the already-rendered plane translates straight up off the top of
    // the screen and fades out — plays out in parallel with the actual send, both awaited below.
    // This is a flat 2D translate/opacity on the existing view, not the engine's own 3D fly()
    // sequence (which could render as a clipped, glitchy shape mid-flight on some devices, see
    // prior history here). useNativeDriver: true hands both properties to the platform's own
    // compositor for the whole 1.5s, so the motion stays smooth regardless of whatever the JS
    // thread is doing at the same time (the real network call above, WebGL teardown, etc.) — this
    // is why the wrapper below is split into two nested Animated.Views: stageOpacity (the fold-in
    // fade, driven by `progress`, which needs a JS listener for `seek()` and so can't itself be
    // native-driven) stays on the outer one, isolated from liftY/liftOpacity on the inner one, since
    // a single Animated.multiply node can't mix a native-driven and a JS-driven input. The map
    // itself still owns the "flies to the recipient" visual once this finishes (see
    // ThrowHomeScreen's runFlight) — awaiting both together means that handoff always comes right
    // after this liftoff completes, not before it, regardless of network speed.
    const liftOff = new Promise<void>((resolve) => {
      Animated.parallel([
        Animated.timing(liftY, { toValue: -liftoffDistance(), duration: LIFTOFF_DURATION_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(liftOpacity, { toValue: 0, duration: LIFTOFF_DURATION_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => resolve());
    });
    const photoUris = mediaItems.map((m) => m.uri);
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
    mediaItems,
    paperSize,
    launch,
    settleFold,
    springLiftBack,
    onContactDragStart,
    onContactDragOffset,
    onFoldProgress,
  });
  latest.current = {
    disabled,
    phase,
    hasContent,
    content,
    mediaItems,
    paperSize,
    launch,
    settleFold,
    springLiftBack,
    onContactDragStart,
    onContactDragOffset,
    onFoldProgress,
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
        // The folded plane's baked texture only carries the first attached *photo* — see
        // paperPlaneTypes.ts's PaperPlaneLetterContent, which still takes a single photoUri and
        // (being a Canvas2D/SVG rasterizer) can only ever draw an actual image, not a video frame.
        // Stamping every attachment onto the fragile 3D fold/texture pipeline isn't worth the
        // risk either way; the flat compose paper (below) is where all of them are visible.
        const firstPhoto = latest.current.mediaItems.find((m) => !m.isVideo)?.uri ?? null;
        stageRef.current?.setContent({ ...latest.current.content, photoUri: firstPhoto }, latest.current.paperSize);
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
      const { disabled, phase } = latest.current;
      // No `hasContent` gate here any more — an empty paper can still be folded into the ready
      // plane (see the throw-lock in onPanResponderRelease below, which is what actually stops an
      // empty letter from being sent).
      if (disabled || phase !== 'writing') return;
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

  // Scroll-wheel/trackpad fold, independent of (and in addition to) the drag-on-the-paper gesture
  // above — scrolling down anywhere on the compose card folds the letter into the ready-to-throw
  // plane; scrolling back up unfolds it to keep writing. Web-only: there's no wheel-equivalent
  // input on native. Deliberately skips events targeting the actual message TextInput so a long
  // letter can still be scrolled to read/edit normally — only scrolling elsewhere on the card
  // (the paper's margins, the hint text, the bottom-controls row) drives the fold.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = wrapRef.current as any as HTMLElement | null;
    if (!node) return;
    const clearSettleTimer = () => {
      if (wheelSettleTimerRef.current !== null) {
        clearTimeout(wheelSettleTimerRef.current);
        wheelSettleTimerRef.current = null;
      }
    };
    const onWheel = (e: WheelEvent) => {
      const { disabled, phase } = latest.current;
      if (disabled || phase === 'throwing') return;
      if ((e.target as HTMLElement | null)?.closest('textarea, input')) return;
      // Starting a fresh fold (from a flat, untouched 'writing' state) only needs a downward
      // scroll — an empty paper can still fold into the ready plane (see the throw-lock in
      // onPanResponderRelease, which is what actually stops an empty letter from being thrown);
      // once a fold is already underway (phase === 'folding') or fully settled ('ready'), further
      // wheel input — either direction — keeps controlling it regardless.
      if (phase === 'writing' && e.deltaY <= 0) return;
      e.preventDefault();
      const next = Math.max(0, Math.min(1, progressRef.current + e.deltaY / WHEEL_FOLD_DISTANCE));
      applyFoldProgress(next);
      clearSettleTimer();
      wheelSettleTimerRef.current = setTimeout(() => {
        wheelSettleTimerRef.current = null;
        if (latest.current.phase === 'folding') {
          latest.current.settleFold(progressRef.current >= 0.5 ? 1 : 0);
        }
      }, WHEEL_SETTLE_DEBOUNCE_MS);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      node.removeEventListener('wheel', onWheel);
      clearSettleTimer();
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
          const { disabled, phase } = latest.current;
          if (disabled || phase === 'throwing') return false;
          if (phase === 'ready' || phase === 'folding') return true;
          // No `hasContent` gate — an empty paper can still be dragged into a fold; the actual
          // throw itself is what gets locked (see onPanResponderRelease below).
          return g.dy > FOLD_CAPTURE_DY && g.dy > Math.abs(g.dx) * FOLD_CAPTURE_RATIO;
        },
        onPanResponderGrant: (e) => {
          if (latest.current.phase === 'ready') {
            liftY.setValue(0);
            readyGestureActiveRef.current = true;
            throwLockedRef.current = false;
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
              // selected recipient continuously, without waiting for release — but only for a
              // drag that's actually a hold-and-tilt gesture. Once this same drag has moved far
              // enough, more vertically than horizontally, to read as a committed swipe-up-to-
              // throw, it locks: the plane snaps back straight and the recipient stops moving for
              // the rest of this gesture, however much the finger drifts sideways from there —
              // an upward flick shouldn't also reselect who it's being thrown to.
              if (!throwLockedRef.current && Math.abs(g.dy) >= THROW_LOCK_MIN_DY && Math.abs(g.dy) > Math.abs(g.dx) * THROW_LOCK_RATIO) {
                throwLockedRef.current = true;
              }
              liftY.setValue(Math.min(0, g.dy));
              if (throwLockedRef.current) {
                stageRef.current?.setReadyBank(0);
              } else {
                stageRef.current?.setReadyBank(g.dx / MAX_BANK_DX);
                latest.current.onContactDragOffset?.(g.dx / CONTACT_DRAG_SPACING);
              }
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
            const swipedUp = g.dy <= -LAUNCH_THRESHOLD || g.vy <= -LAUNCH_VELOCITY;
            // An empty letter can still fold into the ready plane (see the removed `hasContent`
            // gates above), but swiping it up is a no-op instead of an actual throw — it just
            // springs back, same as any other release that doesn't clear the launch thresholds.
            if (swipedUp && latest.current.hasContent) {
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
    <View ref={wrapRef} style={styles.wrap}>
      {/* Only shown while actively writing/folding — once folded and ready to throw, the
          recipient's own avatar/name/city in the carousel above already says who this is for,
          so a redundant "Ready to throw · city" line here was removed. */}
      {(phase === 'writing' || phase === 'folding') && (
        <Text style={styles.toLine} numberOfLines={1}>
          Writing to {recipientName} · {recipientCity}
        </Text>
      )}

      <View ref={paperAreaRef} style={styles.paperArea} onLayout={onPaperLayout} {...panResponder.panHandlers}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: canvasOpacity }]} pointerEvents={phase === 'writing' ? 'auto' : 'none'}>
          <LetterCanvas ref={letterCanvasRef} onContentChange={setContent} hasPhoto={mediaItems.length > 0} />
        </Animated.View>

        {/* Streak/leaderboard badges — moved here from a separate header chip so they read as
            part of the letter itself; fades with the same canvasOpacity as the writing surface
            so it's never left floating over the folded plane underneath. */}
        <Animated.View style={[styles.paperBadges, { opacity: canvasOpacity }]} pointerEvents="none">
          {streak > 0 && (
            <View style={styles.streakChip} accessibilityLabel={`${streak} day throw streak with ${recipientName}`}>
              <Text style={styles.streakText}>🔥{streak}</Text>
            </View>
          )}
          <View style={styles.pointsChip} accessibilityLabel={`${points} leaderboard points with ${recipientName}`}>
            <Icon path={POINTS_ICON} size={11} color={throwColor.clayDeep} strokeWidth={2} />
            <Text style={styles.streakText}>{points}</Text>
          </View>
        </Animated.View>

        {paperSize.width > 0 && (
          // Split into two nested Animated.Views on purpose — see the useNativeDriver comment on
          // launch() above for why liftY/liftOpacity (native-driven) can't share a node with
          // stageOpacity (JS-driven, the fold-in fade). Position only ever moves vertically
          // (liftY, throw-prep and the launch liftoff) — horizontal drag banks the plane in place
          // via the 3D engine's own setReadyBank instead of translating this view, and the
          // engine's own 'ready'-phase pose now handles the straight-ahead, nose-down resting tilt
          // (see paperPlaneEngine.ts), so no CSS transform trickery is needed here any more.
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: stageOpacity }]} pointerEvents="none">
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: liftOpacity, transform: [{ translateY: liftY }] }]}>
              {stageFailed ? (
                <View style={styles.fallbackPlaneWrap}>
                  <PaperPlane size={64} color={throwColor.clayDeep} />
                </View>
              ) : (
                <PaperPlaneStage ref={stageRef} onPhase={handleStagePhase} onError={handleStageError} />
              )}
            </Animated.View>
          </Animated.View>
        )}

        {mediaItems.length > 0 && (
          // Fades out in lockstep with LetterCanvas (same canvasOpacity) once folding starts —
          // only the first photo is baked into the plane's own texture from that point on (see
          // applyFoldProgress above), so this flat strip would otherwise float on top of the
          // plane as extra, un-folded copies.
          <Animated.View style={[styles.photoStripWrap, { opacity: canvasOpacity }]} pointerEvents={phase === 'writing' ? 'box-none' : 'none'}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStripContent}>
              {mediaItems.map((item, i) => (
                <View key={`${item.uri}-${i}`} style={styles.photoThumbWrap}>
                  <View style={styles.photoThumbFrame}>
                    {item.isVideo ? (
                      // No on-device video-frame decoding here — a plain dark tile with a play
                      // glyph stands in for a preview frame, rather than a broken <Image>.
                      <View style={styles.videoThumbPlaceholder}>
                        <Svg width={22} height={22} viewBox="0 0 24 24">
                          <Path d={PLAY_ICON} fill={throwColor.paper} />
                        </Svg>
                      </View>
                    ) : (
                      <Image source={{ uri: item.uri }} style={styles.photoThumbImg} />
                    )}
                  </View>
                  <Pressable
                    onPress={() => setMediaItems((prev) => prev.filter((_, idx) => idx !== i))}
                    hitSlop={8}
                    style={styles.photoThumbRemove}
                    accessibilityRole="button"
                    accessibilityLabel={item.isVideo ? 'Remove video' : 'Remove photo'}
                  >
                    <Icon path={X_ICON} size={11} color={throwColor.paper} strokeWidth={2.6} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* The bottom-controls row now lives inside the paper itself, absolutely pinned to its
            bottom edge, instead of floating separately below it — LetterCanvas's own
            typedInputBottomReserve keeps written text clear of this area. Fades with the same
            canvasOpacity as the writing surface, so it disappears the moment folding starts and
            reappears once unfolded, matching the paper's own visible state exactly. */}
        <Animated.View
          style={[
            styles.bottomRow,
            { opacity: canvasOpacity, transform: [{ translateY: canvasOpacity.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
          ]}
          pointerEvents={phase === 'writing' ? 'box-none' : 'none'}
        >
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

        <View style={styles.micColumn}>
          <Pressable
            onPress={() => setVoiceLangIndex((i) => (i + 1) % VOICE_LANGUAGES.length)}
            disabled={disabled || phase === 'throwing' || voice.recording}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Voice language: ${VOICE_LANGUAGES[voiceLangIndex].label}. Tap to change.`}
            style={({ pressed }) => [styles.voiceLangChip, pressed && styles.roundBtnPressed]}
          >
            <Text style={styles.voiceLangChipLabel}>{VOICE_LANGUAGES[voiceLangIndex].label}</Text>
          </Pressable>
          <Pressable
            onPress={() => (voice.recording ? voice.stop() : voice.start(VOICE_LANGUAGES[voiceLangIndex].code))}
            disabled={disabled || phase === 'throwing'}
            accessibilityRole="button"
            accessibilityLabel={voice.recording ? 'Stop recording' : `Speak your letter in ${VOICE_LANGUAGES[voiceLangIndex].label}`}
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
        </View>

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
        </Animated.View>
      </View>

      {phase === 'ready' && <Text style={styles.readyHint}>{hasContent ? throwLabel : 'Write something first'}</Text>}
      {voice.recording && <Text style={styles.readyHint}>Listening…</Text>}
      {(error || voice.error) && <Text style={styles.error}>{error ?? voice.error}</Text>}

      <PhotoAttachSheet visible={photoSheetOpen} onClose={() => setPhotoSheetOpen(false)} onPicked={(items) => setMediaItems((prev) => [...prev, ...items])} />
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
  // The streak/leaderboard badges' new home, in the paper's own top-right corner instead of a
  // separate header chip.
  paperBadges: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  streakChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: throwColor.claySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pointsChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: throwColor.claySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  streakText: { fontFamily: throwFont.ui700, fontSize: 12.5, color: throwColor.clayDeep },
  readyHint: { fontFamily: throwFont.ui600, fontSize: 12, color: throwColor.ink, textAlign: 'center', marginTop: 10 },
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
  videoThumbPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: throwColor.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  // Pinned to the paper's own bottom edge (see the render) rather than floating as a separate
  // row below it — every icon visible at once, no scrolling. LetterCanvas's typedInput reserves
  // matching bottom padding so written text never runs underneath it.
  bottomRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    // Centered as one compact cluster with even gaps, not stretched edge-to-edge via
    // `space-between` — on a real device (confirmed on iPhone 13) that stretch put the outer
    // icons flush against the paper's own rounded edge instead of reading as a centered row.
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 18,
  },
  // Split in two: the outer *Shadow view carries the drop shadow (which needs `overflow: visible`
  // to render), while the inner GlassSurface/View needs `overflow: hidden` so its blur/tint
  // layers respect the rounded corners — the two requirements can't share one style.
  roundBtnShadow: { width: 60, height: 60, borderRadius: 30, ...throwColor.shadowSoft },
  roundBtn: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  roundBtnPressed: { opacity: 0.7 },
  micColumn: { alignItems: 'center', gap: 4 },
  voiceLangChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: throwColor.claySoft,
  },
  voiceLangChipLabel: { fontFamily: throwFont.ui700, fontSize: 9.5, letterSpacing: 0.5, color: throwColor.clayDeep },
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
