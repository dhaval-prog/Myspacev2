import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThrowMap } from '../../components/throw/ThrowMap';
import { RecipientCarousel, CAROUSEL_HEIGHT } from '../../components/throw/RecipientCarousel';
import { FoldingLetter, CONTACT_DRAG_SPACING } from '../../components/throw/FoldingLetter';
import type { FoldingLetterHandle } from '../../components/throw/FoldingLetter';
import { ThrowGlassBackdrop } from '../../components/throw/ThrowGlassBackdrop';
import { GlassSurface } from '../../components/friends/GlassSurface';
import { StoryCaptureScreen } from '../../components/throw/StoryCaptureScreen';
import { ContactStoryStack } from '../../components/throw/ContactStoryStack';
import { StoryPreviewScreen } from '../../components/throw/StoryPreviewScreen';
import { StoryTrimScreen } from '../../components/throw/StoryTrimScreen';
import { WeatherOverlay } from '../../components/throw/weather/WeatherOverlay';
import { BottomNav } from '../../components/BottomNav';
import { Icon } from '../../components/Icon';
import { LetterFoldCard } from '../../components/throw/inbox/LetterFoldCard';
import { LetterPlaneGlyph } from '../../components/throw/inbox/LetterPlaneGlyph';
import { PlaneSlider } from '../../components/throw/inbox/PlaneSlider';
import { inboxLayout } from '../../theme/throwInboxTokens';
import { useInboxArrival } from '../../hooks/useInboxArrival';
import type { Point } from '../../utils/lettersArrivalMath';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { spreadCoincidentPins } from '../../utils/mapProjection';
import { throwColor, throwFont, throwGlass, throwRadius } from '../../theme/throwTokens';
import { useThrow } from '../../context/ThrowContext';
import { useThrowAlerts } from '../../context/ThrowAlertsContext';
import { useThrowColorMode } from '../../context/ThrowColorModeContext';
import { useThrowStories } from '../../context/ThrowStoriesContext';
import { useAuth } from '../../context/AuthContext';
import { useGameStats } from '../../context/GameStatsContext';
import { formatAlertSchedule } from '../../utils/throwAlerts';
import type { AlertSchedule, StrokePath, ThrowLetter } from '../../types/throw';
import type { StoryMediaType } from '../../types/story';
import type { ThrowMapPin } from '../../components/throw/throwMapTypes';

const BACK_ICON = 'M15 18l-6-6 6-6';

// The in-place received-letters panel's own flick-to-switch-contact gesture — same capture
// thresholds as FoldingLetter's own CONTACT_FLICK_CAPTURE_DX/RATIO (not imported, since those are
// private to that module, but kept numerically identical so the gesture feel matches exactly).
const INBOX_FLICK_CAPTURE_DX = 20;
const INBOX_FLICK_CAPTURE_RATIO = 1.7;

/** What's currently covering the screen for the story flow — capture (camera/gallery), the preview
 * step (a captured/picked photo or short video, awaiting the explicit post confirmation), or the
 * trim step (only for a picked video over 15s). Watching a contact's already-posted stories isn't
 * a separate screen any more (see storyView below) — it happens inline, in the same card. Never
 * more than one at a time, so a single piece of state (not three booleans) makes that mutual
 * exclusion structural rather than something every setter has to remember to preserve. */
type StoryFlow =
  | { name: 'capture' }
  | { name: 'preview'; localUri: string; mediaType: StoryMediaType }
  | { name: 'trim'; localUri: string; durationMs: number };

// Feather Icons' "settings" gear glyph (24x24 viewBox) — a known-good path rather than a
// freehand approximation.
const GEAR_ICON =
  'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z';

// How long the arrival card stays up before the map returns to normal compose mode.
const DELIVERED_HOLD_MS = 1800;
// Roughly how tall the floating BottomNav dock is (FAB + pill + its own top padding), so the
// compose card and arrival card can keep clear of it now that it overlaps the map instead of
// pushing content up above it.
const BOTTOM_NAV_CLEARANCE = 92;

interface FlightState {
  letter: ThrowLetter;
  /** A self-reminder alert being "thrown" to yourself rather than a real letter to a friend —
   * same delivered-state copy swap, different wording. */
  isAlert?: boolean;
  /** Snapshot of formatAlertSchedule at the moment the alert was created — alertSchedule itself
   * gets reset for the next reminder well before this card clears. */
  alertScheduleSummary?: string;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_ALERT_SCHEDULE: AlertSchedule = { recurrence: 'once', hour: 9, minute: 0, daysOfWeek: [], dayOfMonth: 1 };

interface ThrowHomeScreenProps {
  onOpenExpenses: () => void;
  onOpenChats: () => void;
  onOpenAddFriend: () => void;
  onOpenSettings: () => void;
  /** Set when arriving here via "Throw Back" — recipient is fixed, carousel is hidden. Only ever
   * set from ThrowInboxScreen/ThrowLetterDetailScreen's own separate Throw Back buttons — the
   * in-place received-letters panel's own Throw Back (see isInboxMode below) just closes the
   * panel and lands on the already-selected contact's normal, unlocked compose letter instead. */
  lockedRecipient?: { friendUserId: string; repliedToThrowId: string } | null;
}

/**
 * The paper plane's flight — from the moment it launches to arriving at the recipient — plays out
 * right here on the same map the user was just composing over, with the camera left exactly where
 * it already was (no zoom-out overview, no re-centering to follow the plane) so it never reads as
 * a different screen. The plane animates along the real route on top of that unchanged view,
 * shrinking and fading out as it nears the destination (see `planeSizeForProgress` /
 * `planeOpacityForProgress`) rather than landing with a separate effect, then a small arrival card
 * appears briefly before handing the map back to normal compose mode.
 */
export function ThrowHomeScreen({
  onOpenExpenses,
  onOpenChats,
  onOpenAddFriend,
  onOpenSettings,
  lockedRecipient,
}: ThrowHomeScreenProps) {
  const insets = useSafeAreaInsets();
  // Where the selected contact's own ring sits on screen, vertically — the recipient carousel's
  // own top (see recipientOverlay's style) plus half its own height, i.e. the ring's center. A
  // flicked-away story card flies toward this exact point (see ContactStoryStack's own
  // flightTargetY) rather than some destination invented just for the story stack.
  const storyFlightTargetY = insets.top + 16 + CAROUSEL_HEIGHT / 2;
  // Horizontally, the selected/open contact's avatar always sits at the recipient overlay's own
  // center — RecipientCarousel's own itemTransform is built so the centered item always renders
  // at its strip's center, and that strip is itself centered within recipientOverlay, which spans
  // the full screen width (see its own style) — so this is just the screen's own center, no
  // measurement/ref needed.
  const { width: windowWidth } = useWindowDimensions();
  const storyFlightTargetX = windowWidth / 2;
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const { myLocation, myName, myAvatarUrl, friends, unreadCount, streakFor, sendThrow, uploadPhoto, inbox, deleteThrow } = useThrow();
  const { createAlert } = useThrowAlerts();
  const { statsFor } = useGameStats();
  const { storiesByUser, storyCountFor, postStory, markViewed, deleteStory } = useThrowStories();
  const [storyFlow, setStoryFlow] = useState<StoryFlow | null>(null);
  // Showing a contact's already-posted stories inline, in the same card the compose letter would
  // otherwise occupy — reached either by tapping the already-selected contact (any contact,
  // including yourself; see RecipientCarousel's own onOpenStory) or by tilting/flicking the letter
  // left past "Own Contact" into the virtual "Status" slot (see handleContactDragOffset).
  // `viaAddSlot` only distinguishes which entry point was used, so the carousel's own chrome (see
  // isAddStorySelected below) only moves onto the add-story slot for the latter — tapping a normal
  // contact to watch their stories doesn't relocate anything, since you're still exactly where you
  // were, just looking at what's in their card instead of their letter.
  const [storyView, setStoryView] = useState<{ userId: string; viaAddSlot: boolean } | null>(null);
  // Increments every time the open contact's own avatar is tapped again (see handleOpenStory) —
  // ContactStoryStack watches this to drop whatever's still sitting in the avatar into the letter,
  // staggered. Also covers the very first open, since it fires on that same tap.
  const [dropSignal, setDropSignal] = useState(0);
  // How many of the open contact's photos are still in their avatar right now, and a one-shot
  // signal to pulse that avatar — both mirrored up from ContactStoryStack (see its own
  // onAvatarCountChange/onPulseAvatar) into RecipientCarousel's matching props. Reset once
  // storyView actually changes so a *different* contact never inherits a stale count/ring.
  const [openAvatarCount, setOpenAvatarCount] = useState(0);
  const [openAvatarPulseSignal, setOpenAvatarPulseSignal] = useState(0);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [alertSchedule, setAlertSchedule] = useState<AlertSchedule>(DEFAULT_ALERT_SCHEDULE);
  // Once the user has touched the alert schedule, switching to a different contact is locked
  // (see selfLocked below) — otherwise a stray sideways swipe could yank them away from a
  // reminder they're mid-thought on. Writing the reminder's own text does *not* lock this any
  // more (per explicit request — composing shouldn't block flicking through contacts). Reset
  // once the reminder is actually created (see handleThrow's self branch).
  const [selfComposeLocked, setSelfComposeLocked] = useState(false);
  const initializedRef = useRef(false);

  const [flight, setFlight] = useState<FlightState | null>(null);
  // Fades (and slightly slides down) BottomNav *and* the top header bar in lockstep with
  // FoldingLetter's own fold amount — 0 (flat writing paper) keeps both fully visible, 1 (folded,
  // ready to throw) hides both, driven by the exact same value whether the fold was triggered by
  // dragging the paper or the scroll-wheel gesture, so neither ever disagrees with what the paper
  // is actually doing. FoldingLetter's own bottom-controls row (photo/chat/voice/add-friend/inbox)
  // fades independently, on the same `progress` value, entirely inside that component instead —
  // no need to route it through here since it's already local there.
  const chromeOpacity = useRef(new Animated.Value(1)).current;
  // Crossfades the letter card's own content whenever it swaps between the compose letter and
  // the Status photo viewer (see isStatusMode) — FoldingLetter unmounts and StatusPhotoViewer
  // mounts (or vice versa) the instant the drag crosses that boundary, same timing as any other
  // live contact switch; this just fades the newly-mounted side in over a couple hundred ms so
  // that swap reads as a smooth/cinematic transition rather than an instant snap.
  const cardModeFade = useRef(new Animated.Value(1)).current;
  // Separate from chromeOpacity (an Animated.Value can't be read synchronously to gate
  // pointerEvents) — flips once the fold crosses the halfway point, same threshold the fold
  // itself settles toward, so both stop accepting touches right around when they're no longer
  // meaningfully visible rather than only once fully transparent.
  const [chromeHidden, setChromeHidden] = useState(false);
  const handleFoldProgress = (value: number) => {
    chromeOpacity.setValue(1 - value);
    const hidden = value > 0.5;
    setChromeHidden((prev) => (prev === hidden ? prev : hidden));
  };

  // The in-place received-letters panel (see isInboxMode below) — tapping FoldingLetter's own
  // inbox icon no longer navigates to a separate screen; it swaps the letter card's own content
  // for the arrival panel right here, the same crossfade every other card-mode swap above already
  // gets (see cardMode/cardModeFade). BottomNav hides in lockstep — same fade+slide-down chrome
  // mechanism `handleFoldProgress` already drives, just fired from a discrete toggle (Animated.timing)
  // instead of a live drag — while the plane-chip row fades/slides in from that exact same spot at
  // the same time, using its own Animated.Value so the two can cross-fade independently rather than
  // being strict opposites of one one shared value (relevant once BottomNav's own fold-driven hide
  // and inbox mode could ever be true "at once" mid-transition).
  const [inboxMode, setInboxMode] = useState(false);
  const inboxChromeOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(chromeOpacity, { toValue: inboxMode ? 0 : 1, duration: 280, useNativeDriver: false }).start();
    Animated.timing(inboxChromeOpacity, { toValue: inboxMode ? 1 : 0, duration: 280, useNativeDriver: false }).start();
    setChromeHidden(inboxMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboxMode]);
  // The letter area's own measured box — the arrival panel (plane flight + LetterFoldCard) is laid
  // out purely in these local coordinates, so the plane's flight path and the card it "becomes"
  // once landed always agree on where things are, with no cross-tree window measurement needed.
  const [inboxAreaSize, setInboxAreaSize] = useState({ width: 0, height: 0 });
  const inboxScale = inboxAreaSize.width > 0 ? inboxAreaSize.width / inboxLayout.letter.w : 1;
  // The card's own height scales independently of its width (see LetterFoldCard's own
  // heightScale prop) — filling the whole available height the same way FoldingLetter's own
  // plain flex:1 paper does, instead of being capped at whatever inboxScale's width-derived ratio
  // happens to produce (which used to leave this card noticeably shorter than the compose letter).
  const inboxHeightScale = inboxAreaSize.height > 0 ? inboxAreaSize.height / inboxLayout.letter.h : inboxScale;
  const inboxCardHeight = inboxAreaSize.height > 0 ? inboxAreaSize.height : inboxLayout.letter.h * inboxScale;
  // A separate, larger scale for the bottom plane-chip row, kept independent of inboxScale (the
  // letter card's own width-derived scale) so the chips read at roughly the same size as
  // FoldingLetter's own bottom-controls row instead of shrinking down to match the card.
  const inboxChipScale = inboxScale * 1.35;
  // The plane-chip row's own measured height — reserved as extra clearance below the letter card
  // (see letterCard's own `bottom` style) so the card's height, while still filling the rest of
  // the available space, stops short of the row instead of extending underneath it. PlaneSlider
  // floats in its own full-width sibling overlay (not nested inside the letter card, unlike
  // FoldingLetter's own bottom-controls row, which is a child of the same paper) precisely because
  // it needs more room than that slim icon row — measuring it directly here, rather than
  // hardcoding an estimate, keeps this correct however tall the row's header/chips/replay actually
  // render at any given scale.
  const [inboxChipRowHeight, setInboxChipRowHeight] = useState(0);
  const inboxLandingPoint: Point = { x: inboxAreaSize.width / 2, y: inboxCardHeight / 2 };
  const inboxBelowOrigin: Point = { x: inboxLandingPoint.x, y: inboxCardHeight + 120 * inboxScale };
  const inboxLetterAreaRef = useRef<View>(null);
  const toLocalInboxPoint = (windowPoint: { x: number; y: number }): Promise<Point> =>
    new Promise((resolve) => {
      const node = inboxLetterAreaRef.current;
      if (!node) return resolve(windowPoint);
      node.measureInWindow((cx, cy) => resolve({ x: windowPoint.x - cx, y: windowPoint.y - cy }));
    });

  // The self-reminder sheet's collapsed peek strip (see FoldingLetter's onReminderPeekChange) is
  // rendered here, not inside FoldingLetter itself — it needs to reach the real screen bottom,
  // past the letter card's own (narrower, and dynamically-repositioned) bounds. openReminder is
  // reached imperatively through this ref, since the sheet's own open/peek/closed state lives
  // inside FoldingLetter, which already tracks the phase/content that drives it.
  const foldingLetterRef = useRef<FoldingLetterHandle>(null);
  const [reminderPeeking, setReminderPeeking] = useState(false);
  // Opening the peek strip back up is either a tap (negligible movement) or an upward drag past
  // this distance/velocity — same threshold shape as BottomSheet's own handle-drag-to-dismiss,
  // just inverted, plus the tap case since this is a plain View (see below), not a Pressable.
  const REMINDER_TAP_SLOP = 10;
  const REMINDER_OPEN_DISTANCE = 24;
  const REMINDER_OPEN_VELOCITY = 0.5;
  const openReminderFromGesture = (dx: number, dy: number, velocityY: number) => {
    const isTap = Math.abs(dx) < REMINDER_TAP_SLOP && Math.abs(dy) < REMINDER_TAP_SLOP;
    if (isTap || dy < -REMINDER_OPEN_DISTANCE || velocityY < -REMINDER_OPEN_VELOCITY) {
      foldingLetterRef.current?.openReminder();
    }
  };
  // A plain View (not Pressable) carrying its own PanResponder, rather than a Pressable +
  // PanResponder stacked on the same node — Pressable's own Pressability responder would
  // otherwise compete with this one for the same touch, exactly the kind of gesture conflict
  // FoldingLetter's own fold-vs-stroke negotiation exists to avoid elsewhere in Throw. Tapping is
  // just a released drag with negligible movement (see openReminderFromGesture), so one responder
  // covers both without needing Pressable at all.
  const reminderPeekPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, gesture) => openReminderFromGesture(gesture.dx, gesture.dy, gesture.vy),
    }),
  ).current;
  // react-native-web's PanResponder polyfill doesn't reliably track a drag here either — the same
  // dedupe bug FoldingLetter's own fold-drag and BottomSheet's own handle-drag already work around
  // (see either's own comment for the full diagnosis). Skipped on native, where PanResponder's own
  // tracking is reliable as-is.
  const reminderPeekRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !reminderPeeking) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = reminderPeekRef.current as any as HTMLElement | null;
    if (!node) return;
    const getPoint = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if ('touches' in e) {
        const t = e.touches[0] ?? e.changedTouches[0];
        return t ? { x: t.clientX, y: t.clientY } : null;
      }
      return { x: e.clientX, y: e.clientY };
    };
    let start: { x: number; y: number } | null = null;
    let last = { x: 0, y: 0 };
    let lastT = 0;
    let velocity = 0;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const p = getPoint(e);
      if (!p) return;
      start = p;
      last = p;
      lastT = Date.now();
      velocity = 0;
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!start) return;
      const p = getPoint(e);
      if (!p) return;
      const now = Date.now();
      const dt = now - lastT;
      if (dt > 0) velocity = (p.y - last.y) / dt;
      last = p;
      lastT = now;
    };
    const onUp = () => {
      if (!start) return;
      openReminderFromGesture(last.x - start.x, last.y - start.y, velocity);
      start = null;
    };
    node.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    node.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      node.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      node.removeEventListener('touchstart', onDown);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [reminderPeeking]);
  // Holds the letter between a successful `sendThrow`/`createAlert` and FoldingLetter's own local
  // fold-and-liftoff animation finishing (`onLaunched`) — the map flight only starts once that
  // local flourish is done, so the two animations play back to back rather than fighting for
  // attention.
  const pendingLaunchRef = useRef<{ letter: ThrowLetter; isAlert: boolean; alertScheduleSummary?: string } | null>(null);
  const flightRunIdRef = useRef(0);
  // Snapshot of selectedIndex taken when a contact-drag starts (see handleContactDragStart) —
  // every live offset during that same drag is computed relative to this fixed base, not to
  // whatever selectedFriendId has drifted to mid-drag, so the mapping from drag distance to
  // recipient stays linear all the way through instead of compounding.
  const dragBaseIndexRef = useRef(0);

  // "Myself" is always the first contact — opening Throw defaults straight to your own location
  // and the alert-schedule paper, rather than requiring at least one friend to have anything to
  // throw to.
  const selfEntry = useMemo(
    () => (myId && myLocation ? { userId: myId, name: myName, avatarUrl: myAvatarUrl, location: myLocation } : null),
    [myId, myName, myAvatarUrl, myLocation],
  );
  const friendsWithLocation = useMemo(() => {
    const withLoc = friends.filter((f) => f.location);
    return selfEntry ? [selfEntry, ...withLoc] : withLoc;
  }, [friends, selfEntry]);

  useEffect(() => {
    if (initializedRef.current || friendsWithLocation.length === 0) return;
    initializedRef.current = true;
    const wanted = lockedRecipient?.friendUserId;
    const found = wanted ? friendsWithLocation.find((f) => f.userId === wanted) : null;
    setSelectedFriendId((found ?? friendsWithLocation[0]).userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendsWithLocation]);

  const selectedIndex = Math.max(0, friendsWithLocation.findIndex((f) => f.userId === selectedFriendId));
  const selectedFriend = friendsWithLocation.find((f) => f.userId === selectedFriendId) ?? null;
  const inboxContactLetters = useMemo(
    () => (selectedFriend ? inbox.filter((l) => l.counterpartId === selectedFriend.userId) : []),
    [inbox, selectedFriend],
  );
  const inboxArrival = useInboxArrival({
    enabled: inboxMode,
    letters: inboxContactLetters,
    contactName: selectedFriend?.name ?? '',
    reduceMotion,
    scale: inboxScale,
    landingPoint: inboxLandingPoint,
    belowOrigin: inboxBelowOrigin,
    deleteThrow,
  });
  const handleOpenInbox = () => setInboxMode(true);
  const handleCloseInbox = () => setInboxMode(false);
  const handleInboxSelectChip = async (index: number, originScreen: { x: number; y: number }) => {
    const local = await toLocalInboxPoint(originScreen);
    inboxArrival.handleSelectChip(index, local);
  };
  const isSelfSelected = !!selectedFriend && selectedFriend.userId === myId;
  // Only meaningful while self is actually selected — switching to a friend first (before ever
  // touching the schedule/text) is always allowed; this only blocks switching *away* once a
  // reminder is actually in progress.
  const selfLocked = isSelfSelected && selfComposeLocked;
  const selectedStreak = selectedFriend && !isSelfSelected ? streakFor(selectedFriend.userId) : 0;
  const selectedPoints = selectedFriend && !isSelfSelected ? statsFor(selectedFriend.userId).totalPoints : 0;
  // Guards against a stale storyView surviving a selection change that didn't go through one of
  // this screen's own clearing paths (onChangeIndex, the real-contact branch of
  // handleContactDragOffset) — belt-and-braces in the same spirit as isSelfSelected's own reset
  // effect just above, not the only thing keeping this in sync.
  const isStoryMode = storyView !== null && storyView.userId === selectedFriendId;
  // Capturing a new story (see StoryFlow's own comment) takes over the same letter-card slot
  // ContactStoryStack/FoldingLetter otherwise occupy — reached either by tilting/flicking left
  // into the virtual "Status" slot (which now always means "post something new", not "view what's
  // already there" — see handleContactDragOffset) or by tapping the add-story "+" directly.
  const isCaptureMode = storyFlow?.name === 'capture';
  // The confirm-before-posting step right after capture/pick — also inline, in the same slot, so
  // the whole "post a story" pipeline reads as one continuous place rather than capture alone
  // being inline and confirm popping up separately.
  const isPreviewMode = storyFlow?.name === 'preview';
  // Which of the five things the letter card is currently showing — a single source of truth so
  // every transition between any two of them (not just entering/leaving story mode) gets the same
  // smooth crossfade below, instead of only some pairs of states doing so.
  const cardMode: 'capture' | 'preview' | 'story' | 'inbox' | 'letter' = isCaptureMode
    ? 'capture'
    : isPreviewMode
      ? 'preview'
      : isStoryMode
        ? 'story'
        : inboxMode
          ? 'inbox'
          : 'letter';

  // FoldingLetter's onReminderPeekChange prop itself goes undefined the instant the user flicks
  // away from "Myself" (see its own conditional below) — a no-op prop can't tell this screen's own
  // reminderPeeking to turn back off, so without this it stayed stuck true and the peek strip kept
  // showing over a friend's letter. The render below is also gated on isSelfSelected directly, so
  // this is belt-and-braces state hygiene rather than the only fix.
  useEffect(() => {
    if (!isSelfSelected) setReminderPeeking(false);
  }, [isSelfSelected]);

  // A freshly-opened (or closed) contact's status stack starts its own count from scratch — never
  // carries over whatever the previous contact's avatar happened to be showing.
  useEffect(() => {
    setOpenAvatarCount(0);
  }, [storyView?.userId]);

  useEffect(() => {
    cardModeFade.setValue(0);
    Animated.timing(cardModeFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [cardMode, cardModeFade]);

  const handleAlertScheduleChange = (next: AlertSchedule) => {
    setAlertSchedule(next);
    setSelfComposeLocked(true);
  };
  // The "X" beside the peek strip's "Remind me" button — abandons the reminder draft entirely
  // (schedule, written text, attached photos) rather than editing it, so the user can switch to
  // a different contact without a half-finished reminder left locking the carousel. Mirrors the
  // reset handleThrow's self branch already does on an actual successful send.
  const handleClearReminder = () => {
    foldingLetterRef.current?.clearReminderDraft();
    setAlertSchedule(DEFAULT_ALERT_SCHEDULE);
    setSelfComposeLocked(false);
    setReminderPeeking(false);
  };

  // Tapping the already-selected contact's ring (see RecipientCarousel's own onOpenStory) opens
  // their stories inline, in the same card, instead of re-selecting them (a no-op otherwise) — the
  // same "tap once to select, tap the selected one again to open" convention avoids needing a whole
  // second control just for viewing. Works identically for any contact, including yourself.
  const handleOpenStory = (userId: string) => {
    if ((storiesByUser[userId]?.length ?? 0) === 0) return;
    setStoryView({ userId, viaAddSlot: false });
    // Also fires on every re-tap of the already-open contact's own avatar (see
    // RecipientCarousel's own onPress) — that's the "tap avatar to drop photos" gesture itself,
    // not just the initial open.
    setDropSignal((n) => n + 1);
  };

  // Captured/picked media isn't posted right away any more — it lands on the preview step first
  // (see StoryFlow's own comment), which is what actually calls postStory once the user taps its
  // confirm arrow.
  const handleStoryCaptured = (localUri: string, mediaType: StoryMediaType) => {
    setStoryFlow({ name: 'preview', localUri, mediaType });
  };

  const handleStoryPreviewConfirmed = async (localUri: string, mediaType: StoryMediaType) => {
    setStoryFlow(null);
    await postStory(localUri, mediaType);
  };

  const handleStoryPickedLongVideo = (localUri: string, durationMs: number) => {
    setStoryFlow({ name: 'trim', localUri, durationMs });
  };

  const handleStoryTrimConfirmed = async (trim: { startMs: number; endMs: number }, localUri: string) => {
    setStoryFlow(null);
    await postStory(localUri, 'video', trim);
  };

  // Long-press-then-flick-down inside ContactStoryStack (own stories only — see its own
  // isOwnStories prop) — the stack itself has already made room for the next photo by the time
  // this fires, so this only needs to actually remove it from the backend.
  const handleDeleteStory = (storyId: string) => {
    void deleteStory(storyId);
  };

  // Real "zoom to contact": the selected friend's own location, falling back to the user's own
  // pin — handed to ThrowMap's `focus` prop, which drives the actual map camera.
  const focusTarget = selectedFriend?.location ?? myLocation ?? null;

  // The letter paper's own night skin (see FoldingLetter's isNight prop below) follows its own
  // Settings color-mode pin (`isDay`); the map and the recipient carousel overlaid on it follow
  // the map's own separate pin instead (`mapIsDay`) — two independent user preferences, per
  // explicit request.
  const { isDay, mapIsDay } = useThrowColorMode();

  // Dragging the folded, ready-to-throw plane sideways (see FoldingLetter's onContactDragStart /
  // onContactDragOffset) cycles through recipients live, the same direction as swiping the
  // carousel — dragging right moves toward higher-index entries, left toward lower-index ones —
  // and, like RecipientCarousel's own drag, clamps at the list's ends rather than wrapping.
  // Selecting a different friend here also re-centers the map, since focusTarget above already
  // follows selectedFriend.
  // Guards the "entering Status" branch below against firing more than once per drag — the
  // offset callback fires continuously while the finger's still down, and re-triggering it every
  // tick past the boundary would re-open the capture flow repeatedly for as long as the drag holds
  // there. Reset on every fresh grant.
  const statusBoundaryHandledRef = useRef(false);
  // The strip's own live-drag position (see RecipientCarousel's liveOffset prop) — set the moment
  // a recipient-switching drag starts and updated continuously while it moves, so the carousel
  // tracks the finger 1:1 instead of only reacting once selectedFriendId itself lands on a new
  // contact. Back to null the instant the drag ends (handleContactDragEnd), handing control back
  // to RecipientCarousel's own resting-index spring.
  const [contactDragLiveOffset, setContactDragLiveOffset] = useState<number | null>(null);
  const handleContactDragStart = () => {
    dragBaseIndexRef.current = selectedIndex;
    statusBoundaryHandledRef.current = false;
    setContactDragLiveOffset(selectedIndex);
  };
  const handleContactDragOffset = (steps: number) => {
    const n = friendsWithLocation.length;
    if (n === 0) return;
    const raw = dragBaseIndexRef.current + steps;
    setContactDragLiveOffset(Math.max(-1, Math.min(n - 1, raw)));
    // -1 is the virtual "Status" slot, one further left than any real contact (index 0) — tilting/
    // flicking into it always opens the capture flow now, regardless of whether you've already
    // posted a story today: Status is for adding one, not for viewing what's already there (see
    // isCaptureMode's own comment) — viewing your own existing stories works the same way viewing
    // anyone else's does, by tapping your own already-selected avatar (see handleOpenStory).
    const nextIdx = Math.max(-1, Math.min(n - 1, Math.round(raw)));
    if (nextIdx === -1) {
      if (statusBoundaryHandledRef.current) return;
      statusBoundaryHandledRef.current = true;
      if (myId) setSelectedFriendId(myId);
      setStoryFlow({ name: 'capture' });
      return;
    }
    setStoryView(null);
    // Also exits capture/preview mode — otherwise dragging back to a real contact from the Status
    // slot (see the StoryCaptureScreen flick gesture above) would leave the camera showing on top
    // of a now-different, non-Status selection.
    setStoryFlow(null);
    const nextFriend = friendsWithLocation[nextIdx];
    if (nextFriend && nextFriend.userId !== selectedFriendId) setSelectedFriendId(nextFriend.userId);
  };
  const handleContactDragEnd = () => {
    setContactDragLiveOffset(null);
  };

  // Flicking any received letter left/right switches to the next/previous contact and shows
  // *their* received letters — same left→next/right→previous convention, and the exact same
  // underlying handleContactDragStart/Offset/End machinery (see CONTACT_DRAG_SPACING), as flicking
  // the still-open compose letter already uses (see FoldingLetter's own contact-flick gesture) —
  // just captured here instead, since the in-place inbox panel has no FoldingLetter mounted to
  // drive it from. A ref (not the handlers themselves) is what the gesture callbacks below read,
  // since PanResponder.create only runs once — see FoldingLetter's own `latest` ref for the same
  // "closures go stale otherwise" reasoning.
  const inboxFlickLatest = useRef({ handleContactDragStart, handleContactDragOffset, handleContactDragEnd });
  inboxFlickLatest.current = { handleContactDragStart, handleContactDragOffset, handleContactDragEnd };
  const inboxFlickPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        Math.abs(g.dx) > INBOX_FLICK_CAPTURE_DX && Math.abs(g.dx) > Math.abs(g.dy) * INBOX_FLICK_CAPTURE_RATIO,
      onPanResponderGrant: () => inboxFlickLatest.current.handleContactDragStart(),
      // Negated — matches FoldingLetter's own open-paper flick convention (left flicks forward to
      // the next contact, right flicks back to the previous one).
      onPanResponderMove: (_, g) => inboxFlickLatest.current.handleContactDragOffset(-g.dx / CONTACT_DRAG_SPACING),
      onPanResponderRelease: () => inboxFlickLatest.current.handleContactDragEnd(),
      onPanResponderTerminate: () => inboxFlickLatest.current.handleContactDragEnd(),
    }),
  ).current;
  // Same RN-Web PanResponder move-tracking unreliability FoldingLetter's own contact flick (and
  // the reminder-peek gesture above) already work around once a gesture is claimed mid-touch via
  // move-capture — raw DOM listeners on web, the real PanResponder above on native.
  useEffect(() => {
    if (Platform.OS !== 'web' || !inboxMode) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = inboxLetterAreaRef.current as any as HTMLElement | null;
    if (!node) return;
    const getPoint = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if ('touches' in e) {
        const t = e.touches[0];
        return t ? { x: t.clientX, y: t.clientY } : null;
      }
      return { x: e.clientX, y: e.clientY };
    };
    let start: { x: number; y: number } | null = null;
    let captured = false;
    const onDown = (e: MouseEvent | TouchEvent) => {
      start = getPoint(e);
      captured = false;
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!start) return;
      const p = getPoint(e);
      if (!p) return;
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      if (!captured) {
        if (Math.abs(dx) > INBOX_FLICK_CAPTURE_DX && Math.abs(dx) > Math.abs(dy) * INBOX_FLICK_CAPTURE_RATIO) {
          captured = true;
          inboxFlickLatest.current.handleContactDragStart();
        } else {
          return;
        }
      }
      inboxFlickLatest.current.handleContactDragOffset(-dx / CONTACT_DRAG_SPACING);
    };
    const onUp = () => {
      start = null;
      if (captured) {
        captured = false;
        inboxFlickLatest.current.handleContactDragEnd();
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
  }, [inboxMode]);

  const pins: ThrowMapPin[] = useMemo(() => {
    const list: ThrowMapPin[] = [];
    for (const f of friendsWithLocation) {
      const isSelf = f.userId === myId;
      const selected = f.userId === selectedFriendId;
      list.push({
        id: f.userId,
        latitude: f.location!.latitude,
        longitude: f.location!.longitude,
        label: isSelf ? 'You' : f.name.split(' ')[0],
        isSelf,
        selected,
        dimmed: !selected && friendsWithLocation.length > 1,
        onPress: lockedRecipient || selfLocked ? undefined : () => setSelectedFriendId(f.userId),
      });
    }
    // Two people at the same real-world location would otherwise project to the exact same
    // screen position (web) or the exact same Marker coordinate (native), leaving one pin
    // entirely hidden behind the other — this fans coincident pins out into a small, still
    // visibly "same place" cluster so both are visible and tappable.
    return spreadCoincidentPins(list);
  }, [friendsWithLocation, selectedFriendId, lockedRecipient, selfLocked, myId]);

  // Goes straight to the "delivered" card rather than first playing out a multi-second animated
  // flight across the map — per explicit request that a throw stay on the same page/map and just
  // confirm delivery, instead of a lengthy flight simulation taking over first.
  const runFlight = async (letter: ThrowLetter, isAlert: boolean, alertScheduleSummary?: string) => {
    const runId = ++flightRunIdRef.current;
    const stillCurrent = () => flightRunIdRef.current === runId;

    setFlight({ letter, isAlert, alertScheduleSummary });
    await wait(DELIVERED_HOLD_MS);
    if (!stillCurrent()) return;

    setFlight(null);
    // The next FoldingLetter mounts fresh right after this (see !inFlight below) with its own
    // fold progress back at 0 — but an Animated.Value's listener only fires on a *future*
    // setValue, never for whatever value a brand-new instance already starts at, so nothing
    // would otherwise tell chromeOpacity/chromeHidden (left at "hidden" from the just-thrown
    // letter's own fold) to go back to visible for it. Resetting both here explicitly is what
    // brings BottomNav back once the plane is thrown, instead of it staying hidden on the fresh
    // blank letter.
    chromeOpacity.setValue(1);
    setChromeHidden(false);
  };

  const handleThrow = async (content: { messageText: string | null; strokes: StrokePath[] | null; penColor: string; photoUris: string[] }) => {
    if (!selectedFriend) return { error: 'Pick someone to throw to first.' };

    if (isSelfSelected) {
      if (!content.messageText?.trim()) return { error: 'Write your reminder first.' };
      const { error } = await createAlert(alertSchedule, {
        messageText: content.messageText,
        strokes: content.strokes,
        penColor: content.penColor,
      });
      if (error) return { error };
      // A same-location "flight" purely for the existing fold/launch/land visual lifecycle
      // (see runFlight/DELIVERED_HOLD_MS) — the delivered-state copy below reads this as an
      // alert instead of a letter to a friend.
      const scheduleSummary = formatAlertSchedule(alertSchedule);
      const now = new Date().toISOString();
      const alertLetter: ThrowLetter = {
        id: `alert-${Date.now()}`,
        senderId: myId ?? '',
        recipientId: myId ?? '',
        counterpartId: myId ?? '',
        counterpartName: myName,
        counterpartAvatarUrl: myAvatarUrl,
        direction: 'sent',
        messageText: content.messageText,
        strokes: content.strokes,
        penColor: content.penColor,
        photoUrls: [],
        senderCity: myLocation?.city ?? '',
        senderCountry: myLocation?.country ?? '',
        senderLatitude: myLocation?.latitude ?? 0,
        senderLongitude: myLocation?.longitude ?? 0,
        recipientCity: myLocation?.city ?? '',
        recipientCountry: myLocation?.country ?? '',
        recipientLatitude: myLocation?.latitude ?? 0,
        recipientLongitude: myLocation?.longitude ?? 0,
        distanceMiles: 0,
        status: 'thrown',
        createdAt: now,
        readAt: null,
        repliedToThrowId: null,
      };
      pendingLaunchRef.current = { letter: alertLetter, isAlert: true, alertScheduleSummary: scheduleSummary };
      setAlertSchedule(DEFAULT_ALERT_SCHEDULE);
      setSelfComposeLocked(false);
      return { error: null };
    }

    const photoUrls: string[] = [];
    for (const uri of content.photoUris) {
      const uploaded = await uploadPhoto(uri);
      if (uploaded.error) return { error: uploaded.error };
      if (uploaded.url) photoUrls.push(uploaded.url);
    }

    const { error, letter } = await sendThrow({
      recipientId: selectedFriend.userId,
      messageText: content.messageText,
      strokes: content.strokes,
      penColor: content.penColor,
      photoUrls,
      repliedToThrowId: lockedRecipient?.repliedToThrowId,
    });
    if (error || !letter) return { error: error ?? 'Could not send — try again.' };
    pendingLaunchRef.current = { letter, isAlert: false };
    return { error: null };
  };

  const handleLaunched = () => {
    const pending = pendingLaunchRef.current;
    pendingLaunchRef.current = null;
    if (pending) runFlight(pending.letter, pending.isAlert, pending.alertScheduleSummary);
  };

  const inFlight = flight !== null;

  return (
    <View style={styles.screen}>
      <ThrowGlassBackdrop heightMultiplier={0.6} />

      <View style={styles.mapArea}>
        <ThrowMap pins={pins} focus={focusTarget} />
        {/* Screen-space atmospheric layer, not part of the map itself (see WeatherOverlay's own
            doc comment) — always mounted regardless of `inFlight` so it keeps falling, unchanged,
            all the way through the letter/fold/plane-flight lifecycle instead of restarting. */}
        <WeatherOverlay />

        {!inFlight &&
          (lockedRecipient ? (
            selectedFriend && (
              <View style={[styles.recipientOverlay, { top: insets.top + 16 }]}>
                <Text style={styles.replyLine} numberOfLines={1}>
                  Throwing back to {selectedFriend.name}
                </Text>
              </View>
            )
          ) : (
            <View style={[styles.recipientOverlay, { top: insets.top + 16 }]}>
              <RecipientCarousel
                friends={friendsWithLocation}
                selectedIndex={selectedIndex}
                onChangeIndex={(i) => {
                  // Tapping/dragging to any real contact — including re-tapping whichever one was
                  // already selected before Status — is the way back out of story mode (see
                  // storyView's own comment); without this, tapping "Dhaval" again while viewing
                  // Status would be a no-op (already `selectedFriendId`) and leave the user stuck
                  // looking at their own photos with no way back.
                  setStoryView(null);
                  setStoryFlow(null);
                  setSelectedFriendId(friendsWithLocation[i]?.userId ?? null);
                }}
                disabled={selfLocked || isCaptureMode || isPreviewMode}
                isNight={!mapIsDay}
                storyCountFor={storyCountFor}
                onOpenStory={handleOpenStory}
                onAddStory={() => setStoryFlow({ name: 'capture' })}
                isAddStorySelected={storyView?.viaAddSlot === true || isCaptureMode || isPreviewMode}
                storyModeAvatarCount={isStoryMode ? openAvatarCount : undefined}
                storyModePulseSignal={openAvatarPulseSignal}
                liveOffset={contactDragLiveOffset ?? undefined}
              />
            </View>
          ))}

        {!inFlight && selectedFriend && (
          // `bottom` shrinks from its normal BOTTOM_NAV_CLEARANCE-reserved position down to just
          // the safe-area inset as the letter folds, on the same chromeOpacity value that already
          // fades BottomNav out — that reserved clearance exists so the card clears the *visible*
          // dock, and once folded the dock is invisible, so holding the card up above empty space
          // just to clear a control that isn't there read as the ready-to-throw plane floating
          // above the bottom instead of anchored to it. Animated.View (not View) is what lets
          // `bottom` interpolate at all here.
          <Animated.View
            style={[
              styles.letterCard,
              {
                // Adds the plane-chip row's own measured clearance (see inboxChipRowHeight) on top
                // of the usual BottomNav-driven offset, fading in on the same inboxChromeOpacity
                // value the row itself crossfades in on — so the card's own bottom edge stops short
                // of the row instead of growing underneath it once inbox mode is fully open.
                bottom: Animated.add(
                  Animated.add(insets.bottom + 16, Animated.multiply(chromeOpacity, BOTTOM_NAV_CLEARANCE)),
                  Animated.multiply(inboxChromeOpacity, inboxChipRowHeight),
                ),
              },
            ]}
          >
            <Animated.View style={[styles.letterCardContent, { opacity: cardModeFade }]}>
              {isCaptureMode ? (
                <StoryCaptureScreen
                  onClose={() => setStoryFlow(null)}
                  onCaptured={handleStoryCaptured}
                  onPickedLongVideo={handleStoryPickedLongVideo}
                  onContactDragStart={!lockedRecipient && !selfLocked ? handleContactDragStart : undefined}
                  onContactDragOffset={!lockedRecipient && !selfLocked ? handleContactDragOffset : undefined}
                  onContactDragEnd={!lockedRecipient && !selfLocked ? handleContactDragEnd : undefined}
                  flightTargetY={storyFlightTargetY}
                />
              ) : storyFlow?.name === 'preview' ? (
                <StoryPreviewScreen
                  localUri={storyFlow.localUri}
                  mediaType={storyFlow.mediaType}
                  flightTargetY={storyFlightTargetY}
                  // Discarding a just-captured/picked photo re-opens the camera, not the letter —
                  // preview only ever follows capture (see StoryFlow's own comment: it's always
                  // reached from Status), so "X" backing out of it should land you right back
                  // where you were, not jump forward to Own Contact's compose letter.
                  onCancel={() => setStoryFlow({ name: 'capture' })}
                  onConfirm={() => handleStoryPreviewConfirmed(storyFlow.localUri, storyFlow.mediaType)}
                />
              ) : isStoryMode && selectedFriend ? (
                <ContactStoryStack
                  key={selectedFriend.userId}
                  stories={storiesByUser[selectedFriend.userId] ?? []}
                  isNight={!isDay}
                  contactName={selectedFriend.name}
                  flightTargetX={storyFlightTargetX}
                  flightTargetY={storyFlightTargetY}
                  dropSignal={dropSignal}
                  onViewed={markViewed}
                  isOwnStories={selectedFriend.userId === myId}
                  onDeleteStory={handleDeleteStory}
                  onAvatarCountChange={setOpenAvatarCount}
                  onPulseAvatar={() => setOpenAvatarPulseSignal((n) => n + 1)}
                  // The letter emptying out completely — whether the last photo was deleted or
                  // just swiped back up into the avatar — goes straight back to the letter
                  // instead of leaving ContactStoryStack's own "Status deleted" / "Tap X's status
                  // to open" placeholder on screen.
                  onLetterEmptied={() => setStoryView(null)}
                />
              ) : inboxMode ? (
                <View
                  ref={inboxLetterAreaRef}
                  style={{ flex: 1 }}
                  onLayout={(e) => setInboxAreaSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
                  {...(Platform.OS !== 'web' ? inboxFlickPanResponder.panHandlers : null)}
                >
                  {/* Only shown once there's genuinely no other way out of the panel — once a
                      letter is showing, "Throw Back" (see LetterFoldCard's own onThrowBack below)
                      already does the exact same thing (just closes the panel), so this back
                      chevron would be pure redundant chrome per explicit request. The true empty
                      state (no letters from this contact at all) never renders a Throw Back
                      button, so it still needs its own way back. */}
                  {inboxArrival.isEmpty && (
                    <Pressable
                      testID="inbox-back-btn"
                      onPress={handleCloseInbox}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Back to letter"
                      style={styles.inboxBackBtn}
                    >
                      <Icon path={BACK_ICON} size={20} color={throwColor.ink} strokeWidth={2.4} />
                    </Pressable>
                  )}
                  {inboxArrival.plane && (
                    <>
                      <View
                        pointerEvents="none"
                        style={[
                          styles.inboxPlaneShadow,
                          {
                            left: inboxArrival.plane.shadowX - 23 * inboxScale,
                            top: inboxArrival.plane.shadowY - 6 * inboxScale,
                            width: 46 * inboxScale,
                            height: 12 * inboxScale,
                            borderRadius: 6 * inboxScale,
                          },
                        ]}
                      />
                      <View
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          left: inboxArrival.plane.x - 32 * inboxScale,
                          top: inboxArrival.plane.y - 32 * inboxScale,
                          transform: [{ rotate: `${inboxArrival.plane.rot}deg` }, { scale: inboxArrival.plane.scale }],
                        }}
                      >
                        <LetterPlaneGlyph size={64 * inboxScale} variant="default" />
                      </View>
                    </>
                  )}
                  <LetterFoldCard
                    stage={inboxArrival.stage}
                    letter={inboxArrival.cardData}
                    isEmpty={inboxArrival.isEmpty}
                    emptyName={selectedFriend.name}
                    scale={inboxScale}
                    heightScale={inboxHeightScale}
                    reduceMotion={reduceMotion}
                    // Just closes the panel, landing on the already-selected contact's own normal
                    // (unlocked) compose letter — same as the back button, not a locked "replying
                    // to" flow — per explicit request; the `onThrowBack` prop (which drives that
                    // locked flow elsewhere) is only for ThrowInboxScreen/ThrowLetterDetailScreen's
                    // own separate Throw Back buttons, not this in-place panel's.
                    onThrowBack={inboxArrival.activeLetter ? handleCloseInbox : undefined}
                  />
                </View>
              ) : (
                <FoldingLetter
                  ref={foldingLetterRef}
                  recipientName={selectedFriend.name}
                  streak={selectedStreak}
                  points={selectedPoints}
                  onThrow={handleThrow}
                  onLaunched={handleLaunched}
                  throwLabel={isSelfSelected ? 'Swipe up to set alert' : lockedRecipient ? 'Swipe up to throw back' : 'Swipe up to throw'}
                  onOpenAddFriend={onOpenAddFriend}
                  onOpenInbox={handleOpenInbox}
                  unreadCount={unreadCount}
                  onContactDragStart={!lockedRecipient && !selfLocked ? handleContactDragStart : undefined}
                  onContactDragOffset={!lockedRecipient && !selfLocked ? handleContactDragOffset : undefined}
                  onContactDragEnd={!lockedRecipient && !selfLocked ? handleContactDragEnd : undefined}
                  onFoldProgress={handleFoldProgress}
                  alertSchedule={isSelfSelected ? alertSchedule : undefined}
                  onAlertScheduleChange={handleAlertScheduleChange}
                  onReminderPeekChange={isSelfSelected ? setReminderPeeking : undefined}
                  hideBadges={isSelfSelected}
                  isNight={!isDay}
                />
              )}
            </Animated.View>
          </Animated.View>
        )}

        {/* The self-reminder sheet's collapsed stand-in — a plain "Remind me" button, not a bare
            drag handle (see onReminderPeekChange's own comment for why this lives here rather
            than inside FoldingLetter). Gated the same as the letter card itself (!inFlight &&
            selectedFriend) so a just-thrown letter's button can't linger after FoldingLetter
            unmounts (its own effect has no unmount cleanup to report "gone" with) — and explicitly
            on isSelfSelected too (not just reminderPeeking), since flicking to a friend while
            peeking a self-reminder otherwise left this showing over their letter instead (see the
            reset effect above for why reminderPeeking alone can't be trusted here). */}
        {!inFlight && selectedFriend && isSelfSelected && reminderPeeking && (
          <View style={[styles.reminderPeekWrap, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
            <View
              ref={reminderPeekRef}
              accessibilityRole="button"
              accessibilityLabel="Show reminder settings"
              style={styles.reminderPeekButton}
              {...(Platform.OS !== 'web' ? reminderPeekPanResponder.panHandlers : null)}
            >
              <Text style={styles.reminderPeekButtonText}>Remind me</Text>
            </View>
            {/* Clears the schedule + written text/photos and unfolds back to a blank letter —
                see handleClearReminder — so the recipient carousel (locked while a reminder is
                in progress, see selfLocked) can be unlocked again without finishing this one. */}
            <Pressable
              onPress={handleClearReminder}
              accessibilityRole="button"
              accessibilityLabel="Clear reminder"
              style={({ pressed }) => [styles.reminderClearButton, pressed && styles.reminderClearButtonPressed]}
            >
              <Text style={styles.reminderClearButtonText}>✕</Text>
            </Pressable>
          </View>
        )}

        {/* Only the self-reminder "Alert set" confirmation shows here — the regular throw-to-a-
            friend "Your letter has landed" card was removed per explicit request (swiping up to
            throw should not show a landed-confirmation screen at all). */}
        {flight?.isAlert && (
          <View style={[styles.flightStatusWrap, { bottom: insets.bottom + 16 + BOTTOM_NAV_CLEARANCE }]}>
            <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.flightStatus}>
              <Text style={styles.flightTitle}>Alert set</Text>
              <Text style={styles.flightBody}>{flight.alertScheduleSummary}</Text>
            </GlassSurface>
          </View>
        )}
      </View>

      <Animated.View
        testID="bottom-nav-wrap"
        style={[
          styles.bottomNavWrap,
          { opacity: chromeOpacity, transform: [{ translateY: chromeOpacity.interpolate({ inputRange: [0, 1], outputRange: [BOTTOM_NAV_CLEARANCE, 0] }) }] },
        ]}
        pointerEvents={chromeHidden ? 'none' : 'box-none'}
      >
        <BottomNav
          activeId="throw"
          onSelect={(id) => {
            if (id === 'chat') onOpenChats();
            if (id === 'expenses') onOpenExpenses();
            // 'throw' is a no-op here — this screen already is Throw.
          }}
          onAdd={onOpenSettings}
          fabIconPath={GEAR_ICON}
          fabAccessibilityLabel="Throw settings"
          bottomInset={insets.bottom}
          reduceMotion={reduceMotion}
        />
      </Animated.View>

      {/* The plane-chip row fades/slides in from the exact same spot BottomNav just faded/slid out
          of — same clearance value, same crossfade duration, opposite Animated.Value — so the two
          read as one continuous swap rather than a hide-then-a-different-show. */}
      <Animated.View
        style={[
          styles.bottomNavWrap,
          { opacity: inboxChromeOpacity, transform: [{ translateY: inboxChromeOpacity.interpolate({ inputRange: [0, 1], outputRange: [BOTTOM_NAV_CLEARANCE, 0] }) }] },
        ]}
        pointerEvents={inboxMode ? 'box-none' : 'none'}
        onLayout={(e) => setInboxChipRowHeight(e.nativeEvent.layout.height)}
      >
        {selectedFriend && (
          <PlaneSlider
            chips={inboxArrival.chips}
            activeIndex={inboxArrival.activeLetterIdx}
            contactName={selectedFriend.name}
            scale={inboxChipScale}
            busy={inboxArrival.busy}
            canReplay={inboxArrival.canReplay}
            onSelectChip={handleInboxSelectChip}
            onReplay={inboxArrival.handleReplay}
            onDelete={inboxArrival.handleDelete}
            compact
          />
        )}
      </Animated.View>

      {storyFlow?.name === 'trim' && (
        // Same reasoning as the preview step's own onCancel above — backing out of trimming a
        // picked long video should reopen the camera, not drop to Own Contact's letter.
        <Modal visible animationType="slide" onRequestClose={() => setStoryFlow({ name: 'capture' })} statusBarTranslucent>
          <StoryTrimScreen
            localUri={storyFlow.localUri}
            durationMs={storyFlow.durationMs}
            onCancel={() => setStoryFlow({ name: 'capture' })}
            onConfirm={(trim) => handleStoryTrimConfirmed(trim, storyFlow.localUri)}
          />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: throwColor.screenBg },
  // Fills the whole screen edge-to-edge on all four sides — the BottomNav dock floats on top of
  // it (see its own comment) rather than the map making room for it.
  mapArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // The BottomNav dock floats over the map's own bottom edge instead of pushing it up — a
  // sibling of mapArea, absolutely pinned to the screen's bottom so it overlaps in front.
  bottomNavWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  recipientOverlay: { position: 'absolute', top: 8, left: 0, right: 0 },
  replyLine: {
    textAlign: 'center',
    fontFamily: throwFont.ui700,
    fontSize: 15,
    color: throwColor.ink,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 40,
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(251,246,236,.88)',
    overflow: 'hidden',
  },
  letterCard: {
    position: 'absolute',
    left: 28,
    right: 28,
    top: '32%',
  },
  letterCardContent: { flex: 1 },
  inboxBackBtn: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.7)',
    zIndex: 1,
  },
  inboxPlaneShadow: { position: 'absolute', backgroundColor: 'rgba(0,0,0,.18)' },
  // The self-reminder sheet's collapsed stand-in (see onReminderPeekChange) — a small "Remind me"
  // button, not a bare drag handle, pinned near the actual screen bottom (unlike letterCard,
  // which sits well short of it) so it reads as belonging to the whole screen, not just this
  // narrower card. The wrap only centers its row (pointerEvents="box-none" so the empty space
  // either side still reaches the map/plane behind it); "Remind me" itself (see its own
  // PanResponder comment) is a plain View, not another BottomSheet, so it never blocks the
  // swipe-up-to-throw gesture either. The "X" beside it (see handleClearReminder) is a separate,
  // smaller Pressable in the same row.
  reminderPeekWrap: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  reminderPeekButton: {
    backgroundColor: throwColor.ink,
    borderRadius: throwRadius.pill,
    paddingVertical: 12,
    paddingHorizontal: 26,
    ...throwColor.shadowSoft,
  },
  reminderPeekButtonText: { fontFamily: throwFont.ui700, fontSize: 14, color: throwColor.paper },
  reminderClearButton: {
    width: 44,
    height: 44,
    borderRadius: throwRadius.pill,
    backgroundColor: throwColor.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...throwColor.shadowSoft,
  },
  reminderClearButtonPressed: { opacity: 0.7 },
  reminderClearButtonText: { fontFamily: throwFont.ui700, fontSize: 16, color: throwColor.paper },
  flightStatusWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  flightStatus: {
    borderRadius: throwRadius.card,
    borderWidth: 1,
    borderColor: throwGlass.border,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  flightTitle: { fontFamily: throwFont.hand700, fontSize: 20, color: throwColor.ink, textAlign: 'center' },
  flightBody: { fontFamily: throwFont.ui400, fontSize: 12.5, color: throwColor.inkSoft, textAlign: 'center', marginTop: 4 },
});
