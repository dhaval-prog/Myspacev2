import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { NotificationsPanel } from '../../components/throw/NotificationsPanel';
import { ProfileCard } from '../../components/throw/ProfileCard';
import { AddFriendCard } from '../../components/throw/AddFriendCard';
import { BottomNav } from '../../components/BottomNav';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { spreadCoincidentPins } from '../../utils/mapProjection';
import { noSelect } from '../../theme/webStyles';
import { throwColor, throwFont, throwGlass, throwRadius } from '../../theme/throwTokens';
import { useThrow } from '../../context/ThrowContext';
import { useThrowAlerts } from '../../context/ThrowAlertsContext';
import { useNotifications } from '../../context/NotificationsContext';
import { useThrowColorMode } from '../../context/ThrowColorModeContext';
import { useThrowStories } from '../../context/ThrowStoriesContext';
import { useAuth } from '../../context/AuthContext';
import { useGameStats } from '../../context/GameStatsContext';
import { formatAlertSchedule } from '../../utils/throwAlerts';
import type { NotificationTarget } from '../../utils/notify';
import type { AlertSchedule, MediaTrim, StrokePath, ThrowLetter } from '../../types/throw';
import type { StoryMediaType } from '../../types/story';
import type { ThrowMapPin } from '../../components/throw/throwMapTypes';

// Shared flick-to-switch-recipient gesture thresholds — used by the Add-Status-cards and
// Notifications-panel flick gestures (see useContactFlickGesture below), same capture thresholds
// as FoldingLetter's own CONTACT_FLICK_CAPTURE_DX/RATIO (not imported, since those are private to
// that module, but kept numerically identical so the gesture feel matches exactly).
const INBOX_FLICK_CAPTURE_DX = 20;
const INBOX_FLICK_CAPTURE_RATIO = 1.7;

/** Drives the same flick-to-switch-recipient gesture the folded letter card and the in-place
 * inbox panel already use (see CONTACT_DRAG_SPACING/INBOX_FLICK_CAPTURE_*), but for a surface
 * that only exists while a virtual carousel slot — Add Status or Notifications — is the current
 * selection, so flicking there reaches the next/previous slot exactly like flicking the letter
 * card already does, instead of being a dead end only the carousel itself (or a second trip back
 * to a real contact) can get you out of. `active` gates the gesture to whenever this particular
 * surface is actually mounted; each call site gets its own ref/PanResponder, independent of the
 * others, since at most one of them is ever mounted at a time. */
function useContactFlickGesture<T extends View | ScrollView = View>(
  active: boolean,
  handlers: { onContactDragStart: () => void; onContactDragOffset: (steps: number) => void; onContactDragEnd: () => void },
) {
  const ref = useRef<T>(null);
  const latest = useRef(handlers);
  latest.current = handlers;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        Math.abs(g.dx) > INBOX_FLICK_CAPTURE_DX && Math.abs(g.dx) > Math.abs(g.dy) * INBOX_FLICK_CAPTURE_RATIO,
      onPanResponderGrant: () => latest.current.onContactDragStart(),
      // Negated — matches FoldingLetter's own open-paper flick convention (left flicks forward to
      // the next slot, right flicks back to the previous one).
      onPanResponderMove: (_, g) => latest.current.onContactDragOffset(-g.dx / CONTACT_DRAG_SPACING),
      onPanResponderRelease: () => latest.current.onContactDragEnd(),
      onPanResponderTerminate: () => latest.current.onContactDragEnd(),
    }),
  ).current;

  // Same RN-Web PanResponder move-tracking unreliability the inbox panel's own flick gesture
  // already works around — raw DOM listeners on web, the real PanResponder above on native.
  useEffect(() => {
    if (Platform.OS !== 'web' || !active) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = ref.current as any as HTMLElement | null;
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
          latest.current.onContactDragStart();
        } else {
          return;
        }
      }
      latest.current.onContactDragOffset(-dx / CONTACT_DRAG_SPACING);
    };
    const onUp = () => {
      start = null;
      if (captured) {
        captured = false;
        latest.current.onContactDragEnd();
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
  }, [active]);

  return { ref, panHandlers: Platform.OS !== 'web' ? panResponder.panHandlers : undefined };
}

/** What's currently covering the screen for the story flow — capture (camera/gallery), the preview
 * step (a captured/picked photo or short video, awaiting the explicit post confirmation), or the
 * trim step (only for a picked video over 15s). Watching a contact's already-posted stories isn't
 * a separate screen any more (see storyView below) — it happens inline, in the same card. Never
 * more than one at a time, so a single piece of state (not three booleans) makes that mutual
 * exclusion structural rather than something every setter has to remember to preserve. */
type StoryFlow =
  /** The Profile + Add Friend cards popover (see ProfileCard/AddFriendCard) — the first thing
   * shown once the Add Status slot is selected, before the camera. Tapping "Add status" inside
   * ProfileCard moves on to 'capture'; closing the camera comes back here rather than exiting
   * Add Status mode entirely. */
  | { name: 'cards' }
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
  /** Opens a specific past letter — this screen has no notion of that subscreen itself (see
   * ThrowScreen's own ThrowNavigator), so a notification row deep-linking to one is handed
   * straight up to it. */
  onOpenThrowLetter: (throwId: string) => void;
  /** The Add Friend card's own "Share invite link" button — opens the full-screen code/QR Add
   * Friend flow (same destination the Friends tab's own Add button uses). */
  onOpenAddFriendScreen: () => void;
  /** Anything a notification row deep-links to that isn't Throw's own concern (Expenses, a chat,
   * Friends) — focusing a contact within Throw itself is handled locally instead (see
   * handleNotificationTarget below). */
  onNotificationTarget: (target: NotificationTarget) => void;
  onOpenSettings: () => void;
  /** FoldingLetter's own inbox icon (bottom-right of the compose letter's own button row) —
   * navigates to the standalone ThrowReceivedLettersScreen, optionally pre-seeded with whichever
   * contact's compose letter was showing. */
  onOpenReceivedLetters: (contactId?: string) => void;
  /** Set when arriving here via "Throw Back" — recipient is fixed, carousel is hidden. Only ever
   * set from ThrowLetterDetailScreen's own separate Throw Back button. */
  lockedRecipient?: { friendUserId: string; repliedToThrowId: string } | null;
  /** Selects this contact on mount — set when arriving here via a "posted a new status"
   * notification tap (see notify.ts's own 'story' target), which has no specific past story to
   * deep-link to, just the poster themself. */
  initialFocusContactId?: string | null;
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
  onOpenThrowLetter,
  onOpenAddFriendScreen,
  onNotificationTarget,
  onOpenSettings,
  onOpenReceivedLetters,
  lockedRecipient,
  initialFocusContactId,
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
  const { myLocation, myName, myAvatarUrl, friends, unreadCount, unreadCountFor, streakFor, sendThrow, uploadPhoto } = useThrow();
  const { createAlert } = useThrowAlerts();
  const { unreadCount: notificationsUnreadCount } = useNotifications();
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
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(initialFocusContactId ?? null);
  // Whether the carousel's own Notifications slot is the current selection — shows the
  // glassmorphism notification card above the map in its place (see cardMode/render below)
  // instead of pushing to a separate screen, same inline-slot convention as Add Status's own
  // isAddStorySelected. Toggled by tapping/dragging to the slot again (see handleToggleNotifications
  // below), and cleared whenever a real contact or Add Status is selected instead.
  const [isNotificationsSelected, setIsNotificationsSelected] = useState(false);
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

  // BottomNav also hides for the Add Status cards and the Notifications panel — same fade+slide
  // chrome mechanism, so the cards' own bottom edge is free to extend all the way down once the
  // dock is gone (see cardsOverlay/notificationsOverlay's own bottom interpolation below).
  const chromeShouldHide = storyFlow?.name === 'cards' || isNotificationsSelected;
  useEffect(() => {
    Animated.timing(chromeOpacity, { toValue: chromeShouldHide ? 0 : 1, duration: 280, useNativeDriver: false }).start();
    setChromeHidden(chromeShouldHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chromeShouldHide]);

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
    // `initialFocusContactId` (e.g. a notification tap, or Reply from Received Letters) is only
    // honored here as a fallback behind `lockedRecipient` — this effect used to ignore it entirely
    // once `friendsWithLocation` populated, silently resetting the selection to the first friend
    // right after the lazy `useState(initialFocusContactId ?? null)` above had set it correctly.
    const wanted = lockedRecipient?.friendUserId ?? initialFocusContactId ?? undefined;
    const found = wanted ? friendsWithLocation.find((f) => f.userId === wanted) : null;
    setSelectedFriendId((found ?? friendsWithLocation[0]).userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendsWithLocation]);

  const selectedIndex = Math.max(0, friendsWithLocation.findIndex((f) => f.userId === selectedFriendId));
  const selectedFriend = friendsWithLocation.find((f) => f.userId === selectedFriendId) ?? null;
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
  // The Profile + Add Friend cards popover — see StoryFlow's own comment on 'cards'.
  const isCardsMode = storyFlow?.name === 'cards';
  // Whether the virtual "Status" slot itself (not a real friend) is the current selection — the
  // status contact's own cards/camera (see its own render below) are scoped to this, same
  // condition RecipientCarousel's own isAddStorySelected prop already uses.
  const isAddStorySelected = storyView?.viaAddSlot === true || isCaptureMode || isPreviewMode || isCardsMode;

  // Tapping/dragging to the Notifications slot again (or while it's already open) closes it —
  // same "tap the active one again to back out" convention the rest of the carousel already uses.
  // Opening it also backs out of whatever story/Add Status state was showing, so only one of the
  // three ever occupies the letter-card slot at once.
  const handleToggleNotifications = () => {
    setIsNotificationsSelected((prev) => {
      const next = !prev;
      if (next) {
        setStoryView(null);
        setStoryFlow(null);
      }
      return next;
    });
  };

  // Tapping a row inside the Notifications card: focusing a contact within Throw itself is
  // handled right here (this screen owns that state), opening a specific past letter is handed up
  // to ThrowNavigator (it owns that subscreen), and anything else (Expenses, a chat, Friends)
  // bubbles all the way up to App.tsx's own navigator. Closes the card either way, since every one
  // of these means "go look at something else" rather than "stay here".
  const handleNotificationTarget = (target: NotificationTarget) => {
    setIsNotificationsSelected(false);
    if (target.screen === 'throw' && 'throwId' in target) {
      onOpenThrowLetter(target.throwId);
      return;
    }
    if (target.screen === 'throw' && 'focusContactId' in target) {
      setStoryView(null);
      setStoryFlow(null);
      setSelectedFriendId(target.focusContactId);
      return;
    }
    onNotificationTarget(target);
  };

  // Which of the four things the letter card is currently showing — a single source of truth so
  // every transition between any two of them (not just entering/leaving story mode) gets the same
  // smooth crossfade below, instead of only some pairs of states doing so.
  const cardMode: 'capture' | 'preview' | 'story' | 'letter' = isCaptureMode ? 'capture' : isPreviewMode ? 'preview' : isStoryMode ? 'story' : 'letter';

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
  // Guards the "entering Status"/"entering Notifications" branches below against firing more than
  // once per drag — the offset callback fires continuously while the finger's still down, and
  // re-triggering either one every tick past its boundary would re-open that flow repeatedly for
  // as long as the drag holds there. Tracks *which* virtual slot (if any) this drag has already
  // landed on, so crossing from one straight into the other (Status -> Notifications in one
  // continuous flick) still re-fires correctly. Reset on every fresh grant.
  const virtualSlotHandledRef = useRef<-1 | -2 | null>(null);
  // The strip's own live-drag position (see RecipientCarousel's liveOffset prop) — set the moment
  // a recipient-switching drag starts and updated continuously while it moves, so the carousel
  // tracks the finger 1:1 instead of only reacting once selectedFriendId itself lands on a new
  // contact. Back to null the instant the drag ends (handleContactDragEnd), handing control back
  // to RecipientCarousel's own resting-index spring.
  const [contactDragLiveOffset, setContactDragLiveOffset] = useState<number | null>(null);
  const handleContactDragStart = () => {
    // A drag can start from inside the Notifications/Add Status cards themselves (see
    // useContactFlickGesture below), not just from a real contact's own letter card — in which
    // case the virtual slot already showing is the base to drag relative to, not whatever real
    // contact was selected before it.
    const base = isNotificationsSelected ? -2 : isCardsMode ? -1 : selectedIndex;
    dragBaseIndexRef.current = base;
    virtualSlotHandledRef.current = isNotificationsSelected ? -2 : isCardsMode ? -1 : null;
    setContactDragLiveOffset(base);
  };
  const handleContactDragOffset = (steps: number) => {
    const n = friendsWithLocation.length;
    if (n === 0) return;
    // A single drag/flick only ever moves the selection by at most one slot in whichever
    // direction it's moving — capped here against the index the drag started from, rather than
    // left proportional to raw drag distance, which let one decisive flick (a fast, longer swipe)
    // jump several slots at once instead of reading as "one step, that way". Seeing more than one
    // slot over still just takes another flick, same as paging a carousel.
    const base = dragBaseIndexRef.current;
    const raw = Math.max(base - 1, Math.min(base + 1, base + steps));
    setContactDragLiveOffset(Math.max(-2, Math.min(n - 1, raw)));
    // -1 is the virtual "Status" slot and -2 the virtual "Notifications" slot, one and two further
    // left (respectively) than any real contact (index 0) — same order as the carousel's own strip.
    const nextIdx = Math.max(-2, Math.min(n - 1, Math.round(raw)));
    if (nextIdx === -2) {
      if (virtualSlotHandledRef.current === -2) return;
      virtualSlotHandledRef.current = -2;
      setStoryView(null);
      setStoryFlow(null);
      setIsNotificationsSelected(true);
      return;
    }
    if (nextIdx === -1) {
      if (virtualSlotHandledRef.current === -1) return;
      virtualSlotHandledRef.current = -1;
      // Tilting/flicking into Status always opens the cards popover now, regardless of whether
      // you've already posted a story today: Status is for adding one, not for viewing what's
      // already there (see isCaptureMode's own comment) — viewing your own existing stories works
      // the same way viewing anyone else's does, by tapping your own already-selected avatar (see
      // handleOpenStory).
      setIsNotificationsSelected(false);
      if (myId) setSelectedFriendId(myId);
      setStoryFlow({ name: 'cards' });
      return;
    }
    virtualSlotHandledRef.current = null;
    setStoryView(null);
    // Also exits capture/preview mode and Notifications — otherwise dragging back to a real
    // contact from either virtual slot would leave it showing on top of a now-different selection.
    setStoryFlow(null);
    setIsNotificationsSelected(false);
    const nextFriend = friendsWithLocation[nextIdx];
    if (nextFriend && nextFriend.userId !== selectedFriendId) setSelectedFriendId(nextFriend.userId);
  };
  const handleContactDragEnd = () => {
    setContactDragLiveOffset(null);
  };

  // Lets flicking work from inside the Add Status cards and the Notifications panel themselves,
  // not just the carousel or the letter card — same contact-drag machinery as everywhere else
  // (see useContactFlickGesture's own doc comment), just gated to whichever of these two surfaces
  // is actually showing.
  const cardsFlick = useContactFlickGesture<ScrollView>(isCardsMode, {
    onContactDragStart: handleContactDragStart,
    onContactDragOffset: handleContactDragOffset,
    onContactDragEnd: handleContactDragEnd,
  });
  const notificationsFlick = useContactFlickGesture<View>(isNotificationsSelected, {
    onContactDragStart: handleContactDragStart,
    onContactDragOffset: handleContactDragOffset,
    onContactDragEnd: handleContactDragEnd,
  });

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

  const handleThrow = async (content: {
    messageText: string | null;
    strokes: StrokePath[] | null;
    penColor: string;
    photoUris: string[];
    photoTrims: (MediaTrim | null)[];
    alertSchedule: AlertSchedule | null;
  }) => {
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
        photoTrims: [],
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
        alertSchedule: null,
        alertConfirmed: false,
      };
      pendingLaunchRef.current = { letter: alertLetter, isAlert: true, alertScheduleSummary: scheduleSummary };
      setAlertSchedule(DEFAULT_ALERT_SCHEDULE);
      setSelfComposeLocked(false);
      return { error: null };
    }

    const photoUrls: string[] = [];
    const photoTrims: (MediaTrim | null)[] = [];
    for (let i = 0; i < content.photoUris.length; i++) {
      const uploaded = await uploadPhoto(content.photoUris[i]);
      if (uploaded.error) return { error: uploaded.error };
      if (uploaded.url) {
        photoUrls.push(uploaded.url);
        photoTrims.push(content.photoTrims[i] ?? null);
      }
    }

    const { error, letter } = await sendThrow({
      recipientId: selectedFriend.userId,
      messageText: content.messageText,
      strokes: content.strokes,
      penColor: content.penColor,
      photoUrls,
      photoTrims,
      repliedToThrowId: lockedRecipient?.repliedToThrowId,
      alertSchedule: content.alertSchedule,
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
                  // looking at their own photos with no way back. Same reasoning extends to
                  // Notifications: selecting any real contact closes that card too.
                  setStoryView(null);
                  setStoryFlow(null);
                  setIsNotificationsSelected(false);
                  setSelectedFriendId(friendsWithLocation[i]?.userId ?? null);
                }}
                disabled={selfLocked || isCaptureMode || isPreviewMode}
                isNight={!mapIsDay}
                storyCountFor={storyCountFor}
                onOpenStory={handleOpenStory}
                onAddStory={() => {
                  setIsNotificationsSelected(false);
                  setStoryFlow({ name: 'cards' });
                }}
                isAddStorySelected={isAddStorySelected}
                storyModeAvatarCount={isStoryMode ? openAvatarCount : undefined}
                storyModePulseSignal={openAvatarPulseSignal}
                liveOffset={contactDragLiveOffset ?? undefined}
                unreadCountFor={unreadCountFor}
                onOpenNotifications={handleToggleNotifications}
                isNotificationsSelected={isNotificationsSelected}
                notificationsUnreadCount={notificationsUnreadCount}
              />
            </View>
          ))}

        {/* The Profile + Add Friend cards popover — the first thing shown once Add Status is
            selected, before the camera (see StoryFlow's own 'cards' comment). Both cards come and
            go together; tapping "Add status" inside ProfileCard moves on to the camera, which
            takes over this exact slot instead (see isCardsMode's own use in letterCard's render
            condition below) so the two steps never show at once. */}
        {!inFlight && isCardsMode && (
          <Animated.ScrollView
            ref={cardsFlick.ref}
            {...(Platform.OS !== 'web' ? cardsFlick.panHandlers : null)}
            style={[
              styles.cardsOverlay,
              noSelect,
              // `bottom` shrinks from its normal BOTTOM_NAV_CLEARANCE-reserved position down to
              // just the safe-area inset as BottomNav fades out (see chromeShouldHide above), the
              // same interpolation the letter card's own bottom edge uses — so these cards extend
              // all the way down once the dock is gone instead of holding space open for it.
              { top: insets.top + 16 + CAROUSEL_HEIGHT + 16, bottom: Animated.add(insets.bottom + 16, Animated.multiply(chromeOpacity, BOTTOM_NAV_CLEARANCE)) },
            ]}
            contentContainerStyle={styles.cardsOverlayContent}
            showsVerticalScrollIndicator={false}
          >
            <ProfileCard
              name="You"
              avatarUrl={myAvatarUrl}
              userId={myId ?? 'me'}
              city={myLocation?.city ?? null}
              friendCount={friends.length}
              hasStatusToday={myId ? storyCountFor(myId) > 0 : false}
              onAddStatus={() => setStoryFlow({ name: 'capture' })}
            />
            <AddFriendCard onOpenAddFriendScreen={onOpenAddFriendScreen} />
          </Animated.ScrollView>
        )}

        {/* The notification history — a floating glassmorphism card above the map instead of a
            separate screen, exactly as long as the carousel's own Notifications slot stays
            selected (see RecipientCarousel's own isNotificationsSelected). */}
        {!inFlight && isNotificationsSelected && (
          <Animated.View
            ref={notificationsFlick.ref}
            {...(Platform.OS !== 'web' ? notificationsFlick.panHandlers : null)}
            style={[
              styles.notificationsOverlay,
              noSelect,
              // See cardsOverlay's own comment on this same interpolation.
              { top: insets.top + 16 + CAROUSEL_HEIGHT + 16, bottom: Animated.add(insets.bottom + 16, Animated.multiply(chromeOpacity, BOTTOM_NAV_CLEARANCE)) },
            ]}
          >
            <NotificationsPanel onNavigate={handleNotificationTarget} />
          </Animated.View>
        )}

        {!inFlight && selectedFriend && !isNotificationsSelected && !isCardsMode && (
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
              { bottom: Animated.add(insets.bottom + 16, Animated.multiply(chromeOpacity, BOTTOM_NAV_CLEARANCE)) },
            ]}
          >
            <Animated.View style={[styles.letterCardContent, { opacity: cardModeFade }]}>
              {isCaptureMode ? (
                <StoryCaptureScreen
                  onClose={() => setStoryFlow({ name: 'cards' })}
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
              ) : (
                <FoldingLetter
                  ref={foldingLetterRef}
                  recipientName={selectedFriend.name}
                  streak={selectedStreak}
                  points={selectedPoints}
                  onThrow={handleThrow}
                  onLaunched={handleLaunched}
                  throwLabel={isSelfSelected ? 'Swipe up to set alert' : lockedRecipient ? 'Swipe up to throw back' : 'Swipe up to throw'}
                  onOpenInbox={() => onOpenReceivedLetters(selectedFriend?.userId)}
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
              <Text style={styles.reminderPeekButtonText}>Reminder</Text>
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
  notificationsOverlay: { position: 'absolute', left: 16, right: 16 },
  cardsOverlay: { position: 'absolute', left: 16, right: 16 },
  cardsOverlayContent: { gap: 12, paddingBottom: 12 },
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
