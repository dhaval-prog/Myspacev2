import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThrowMap } from '../../components/throw/ThrowMap';
import { RecipientCarousel } from '../../components/throw/RecipientCarousel';
import { FoldingLetter } from '../../components/throw/FoldingLetter';
import type { FoldingLetterHandle } from '../../components/throw/FoldingLetter';
import { ThrowGlassBackdrop } from '../../components/throw/ThrowGlassBackdrop';
import { GlassSurface } from '../../components/friends/GlassSurface';
import { BottomNav } from '../../components/BottomNav';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { formatMiles } from '../../utils/geo';
import { flightPath, spreadCoincidentPins } from '../../utils/mapProjection';
import { throwColor, throwFont, throwGlass, throwRadius } from '../../theme/throwTokens';
import { useThrow } from '../../context/ThrowContext';
import { useThrowAlerts } from '../../context/ThrowAlertsContext';
import { useThrowColorMode } from '../../context/ThrowColorModeContext';
import { useAuth } from '../../context/AuthContext';
import { useGameStats } from '../../context/GameStatsContext';
import { formatAlertSchedule } from '../../utils/throwAlerts';
import type { AlertSchedule, StrokePath, ThrowLetter } from '../../types/throw';
import type { ThrowMapPin } from '../../components/throw/throwMapTypes';
import type { LatLng } from '../../utils/geo';

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

type FlightPhase = 'in_flight' | 'delivered';
interface FlightState {
  letter: ThrowLetter;
  phase: FlightPhase;
  /** A self-reminder alert being "thrown" to yourself rather than a real letter to a friend —
   * same fold/launch/flight visuals, different delivered-state copy. */
  isAlert?: boolean;
  /** Snapshot of formatAlertSchedule at the moment the alert was created — alertSchedule itself
   * gets reset for the next reminder well before this flight finishes playing out. */
  alertScheduleSummary?: string;
}

function flightDurationMs(miles: number): number {
  const t = Math.min(1, miles / 10000);
  return Math.round(3000 + t * 3500);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_ALERT_SCHEDULE: AlertSchedule = { recurrence: 'once', hour: 9, minute: 0, daysOfWeek: [], dayOfMonth: 1 };

interface ThrowHomeScreenProps {
  onOpenExpenses: () => void;
  onOpenChats: () => void;
  onOpenAddFriend: () => void;
  onOpenInbox: () => void;
  onOpenSettings: () => void;
  /** Set when arriving here via "Throw Back" — recipient is fixed, carousel is hidden. */
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
  onOpenInbox,
  onOpenSettings,
  lockedRecipient,
}: ThrowHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const { myLocation, myName, myAvatarUrl, friends, unreadCount, streakFor, sendThrow, uploadPhoto } = useThrow();
  const { createAlert } = useThrowAlerts();
  const { statsFor } = useGameStats();
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
  const [flightProgress, setFlightProgress] = useState(0);
  const flightAnim = useRef(new Animated.Value(0)).current;
  // Fades (and slightly slides down) BottomNav *and* the top header bar in lockstep with
  // FoldingLetter's own fold amount — 0 (flat writing paper) keeps both fully visible, 1 (folded,
  // ready to throw) hides both, driven by the exact same value whether the fold was triggered by
  // dragging the paper or the scroll-wheel gesture, so neither ever disagrees with what the paper
  // is actually doing. FoldingLetter's own bottom-controls row (photo/chat/voice/add-friend/inbox)
  // fades independently, on the same `progress` value, entirely inside that component instead —
  // no need to route it through here since it's already local there.
  const chromeOpacity = useRef(new Animated.Value(1)).current;
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
  const isSelfSelected = !!selectedFriend && selectedFriend.userId === myId;
  // Only meaningful while self is actually selected — switching to a friend first (before ever
  // touching the schedule/text) is always allowed; this only blocks switching *away* once a
  // reminder is actually in progress.
  const selfLocked = isSelfSelected && selfComposeLocked;
  const selectedStreak = selectedFriend && !isSelfSelected ? streakFor(selectedFriend.userId) : 0;
  const selectedPoints = selectedFriend && !isSelfSelected ? statsFor(selectedFriend.userId).totalPoints : 0;

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

  // Real "zoom to contact": the selected friend's own location, falling back to the user's own
  // pin — handed to ThrowMap's `focus` prop, which drives the actual map camera.
  const focusTarget = selectedFriend?.location ?? myLocation ?? null;

  // The letter paper's own night skin (see FoldingLetter's isNight prop below) is the one place
  // in Throw that follows the user's own Settings color-mode pin, if they've set one — everywhere
  // else (the map, the recipient carousel just below) stays on the viewer's actual device clock
  // unconditionally (autoIsDay), per explicit request that the setting affect the letter alone.
  const { isDay, autoIsDay } = useThrowColorMode();

  // Dragging the folded, ready-to-throw plane sideways (see FoldingLetter's onContactDragStart /
  // onContactDragOffset) cycles through recipients live, the same direction as swiping the
  // carousel — dragging right moves toward higher-index entries, left toward lower-index ones —
  // and, like RecipientCarousel's own drag, clamps at the list's ends rather than wrapping.
  // Selecting a different friend here also re-centers the map, since focusTarget above already
  // follows selectedFriend.
  const handleContactDragStart = () => {
    dragBaseIndexRef.current = selectedIndex;
  };
  const handleContactDragOffset = (steps: number) => {
    const n = friendsWithLocation.length;
    if (n < 2) return;
    const nextIdx = Math.max(0, Math.min(n - 1, Math.round(dragBaseIndexRef.current + steps)));
    const nextFriend = friendsWithLocation[nextIdx];
    if (nextFriend && nextFriend.userId !== selectedFriendId) setSelectedFriendId(nextFriend.userId);
  };

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

  const runFlight = async (letter: ThrowLetter, isAlert: boolean, alertScheduleSummary?: string) => {
    const runId = ++flightRunIdRef.current;
    const stillCurrent = () => flightRunIdRef.current === runId;

    setFlight({ letter, phase: 'in_flight', isAlert, alertScheduleSummary });
    flightAnim.setValue(0);
    // Throttled rather than applied on every animation frame — the map camera no longer follows
    // the plane (see this screen's doc comment), but the plane marker itself still repaints on
    // every update, and neither Leaflet nor react-native-maps can reliably keep up with 60
    // calls/sec of marker churn. This is plenty smooth for the shrink/fade motion.
    let lastUpdateAt = 0;
    const listenerId = flightAnim.addListener(({ value }) => {
      const now = Date.now();
      if (value < 1 && now - lastUpdateAt < 100) return;
      lastUpdateAt = now;
      setFlightProgress(value);
    });
    await new Promise<void>((resolve) => {
      Animated.timing(flightAnim, {
        toValue: 1,
        duration: reduceMotion ? 1100 : flightDurationMs(letter.distanceMiles),
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start(() => resolve());
    });
    flightAnim.removeListener(listenerId);
    if (!stillCurrent()) return;

    setFlight({ letter, phase: 'delivered', isAlert, alertScheduleSummary });
    await wait(DELIVERED_HOLD_MS);
    if (!stillCurrent()) return;

    setFlight(null);
    setFlightProgress(0);
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

  const flightRoutePoints = useMemo(() => {
    if (!flight) return null;
    const from: LatLng = { latitude: flight.letter.senderLatitude, longitude: flight.letter.senderLongitude };
    const to: LatLng = { latitude: flight.letter.recipientLatitude, longitude: flight.letter.recipientLongitude };
    return flightPath(from, to);
  }, [flight]);

  return (
    <View style={styles.screen}>
      <ThrowGlassBackdrop heightMultiplier={0.6} />

      <View style={styles.mapArea}>
        <ThrowMap
          pins={pins}
          focus={focusTarget}
          route={
            flight?.phase === 'in_flight' && flightRoutePoints
              ? { points: flightRoutePoints, progress: flightProgress, showPlane: true }
              : undefined
          }
        />

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
                onChangeIndex={(i) => setSelectedFriendId(friendsWithLocation[i]?.userId ?? null)}
                disabled={selfLocked}
                isNight={!autoIsDay}
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
              { bottom: Animated.add(insets.bottom + 16, Animated.multiply(chromeOpacity, BOTTOM_NAV_CLEARANCE)) },
            ]}
          >
            <FoldingLetter
              ref={foldingLetterRef}
              recipientName={selectedFriend.name}
              streak={selectedStreak}
              points={selectedPoints}
              onThrow={handleThrow}
              onLaunched={handleLaunched}
              throwLabel={isSelfSelected ? 'Swipe up to set alert' : lockedRecipient ? 'Swipe up to throw back' : 'Swipe up to throw'}
              onOpenAddFriend={onOpenAddFriend}
              onOpenInbox={onOpenInbox}
              unreadCount={unreadCount}
              onContactDragStart={!lockedRecipient && !selfLocked && friendsWithLocation.length > 1 ? handleContactDragStart : undefined}
              onContactDragOffset={!lockedRecipient && !selfLocked && friendsWithLocation.length > 1 ? handleContactDragOffset : undefined}
              onFoldProgress={handleFoldProgress}
              alertSchedule={isSelfSelected ? alertSchedule : undefined}
              onAlertScheduleChange={handleAlertScheduleChange}
              onReminderPeekChange={isSelfSelected ? setReminderPeeking : undefined}
              hideBadges={isSelfSelected}
              isNight={!isDay}
            />
          </Animated.View>
        )}

        {/* The self-reminder sheet's collapsed stand-in — a plain "Remind me" button, not a bare
            drag handle (see onReminderPeekChange's own comment for why this lives here rather
            than inside FoldingLetter). Gated the same as the letter card itself (!inFlight &&
            selectedFriend) so a just-thrown letter's button can't linger after FoldingLetter
            unmounts (its own effect has no unmount cleanup to report "gone" with). */}
        {!inFlight && selectedFriend && reminderPeeking && (
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

        {inFlight && (
          <View style={[styles.flightStatusWrap, { bottom: insets.bottom + 16 + BOTTOM_NAV_CLEARANCE }]}>
            <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.flightStatus}>
              {flight!.phase === 'delivered' ? (
                flight!.isAlert ? (
                  <>
                    <Text style={styles.flightTitle}>Alert set</Text>
                    <Text style={styles.flightBody}>{flight!.alertScheduleSummary}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.flightTitle}>Your letter has landed</Text>
                    <Text style={styles.flightBody}>
                      With {flight!.letter.counterpartName} in {flight!.letter.recipientCity} · {formatMiles(flight!.letter.distanceMiles)} away
                    </Text>
                  </>
                )
              ) : (
                <Text style={styles.flightTitle}>{flight!.isAlert ? 'Sealing your reminder…' : `Flying to ${flight!.letter.counterpartName}…`}</Text>
              )}
            </GlassSurface>
          </View>
        )}
      </View>

      <Animated.View
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
