import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThrowMap } from '../../components/throw/ThrowMap';
import { RecipientCarousel } from '../../components/throw/RecipientCarousel';
import { FoldingLetter } from '../../components/throw/FoldingLetter';
import { ThrowGlassBackdrop } from '../../components/throw/ThrowGlassBackdrop';
import { GlassSurface } from '../../components/friends/GlassSurface';
import { BottomNav } from '../../components/BottomNav';
import { Icon } from '../../components/Icon';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { formatMiles } from '../../utils/geo';
import { flightPath } from '../../utils/mapProjection';
import { throwColor, throwFont, throwGlass, throwRadius } from '../../theme/throwTokens';
import { useThrow } from '../../context/ThrowContext';
import { useGameStats } from '../../context/GameStatsContext';
import type { StrokePath, ThrowLetter } from '../../types/throw';
import type { ThrowMapPin } from '../../components/throw/throwMapTypes';
import type { LatLng } from '../../utils/geo';

// Feather Icons' "settings" gear glyph (24x24 viewBox) — a known-good path rather than a
// freehand approximation.
const GEAR_ICON =
  'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z';
const BACK_ICON = 'M15 18l-6-6 6-6';
// Feather Icons' "award" glyph (24x24 viewBox) — used for the leaderboard-points chip.
const POINTS_ICON = 'M12 15a7 7 0 100-14 7 7 0 000 14z M8.21 13.89L7 23l5-3 5 3-1.21-9.12';

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
}

function flightDurationMs(miles: number): number {
  const t = Math.min(1, miles / 10000);
  return Math.round(3000 + t * 3500);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ThrowHomeScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
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
  onHome,
  onOpenExpenses,
  onOpenSplit,
  onOpenChats,
  onOpenAddFriend,
  onOpenInbox,
  onOpenSettings,
  lockedRecipient,
}: ThrowHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { myLocation, friends, unreadCount, streakFor, sendThrow, uploadPhoto } = useThrow();
  const { statsFor } = useGameStats();
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const [flight, setFlight] = useState<FlightState | null>(null);
  const [flightProgress, setFlightProgress] = useState(0);
  const flightAnim = useRef(new Animated.Value(0)).current;
  // Holds the letter between a successful `sendThrow` and FoldingLetter's own local
  // fold-and-liftoff animation finishing (`onLaunched`) — the map flight only starts once that
  // local flourish is done, so the two animations play back to back rather than fighting for
  // attention.
  const pendingLetterRef = useRef<ThrowLetter | null>(null);
  const flightRunIdRef = useRef(0);

  const friendsWithLocation = useMemo(() => friends.filter((f) => f.location), [friends]);
  const hasFriendsAtAll = friends.length > 0;

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
  const selectedStreak = selectedFriend ? streakFor(selectedFriend.userId) : 0;
  const selectedPoints = selectedFriend ? statsFor(selectedFriend.userId).totalPoints : 0;

  // Real "zoom to contact": the selected friend's own location, falling back to the user's own
  // pin — handed to ThrowMap's `focus` prop, which drives the actual map camera.
  const focusTarget = selectedFriend?.location ?? myLocation ?? null;

  // Dragging the folded, ready-to-throw plane sideways (see FoldingLetter's onSwipeContact) cycles
  // through recipients the same way tapping/swiping the carousel does — 'next' moves toward
  // higher-index entries (rightward in the carousel), 'prev' toward lower-index ones (leftward).
  // Selecting a different friend here also re-centers the map, since focusTarget above already
  // follows selectedFriend.
  const handleSwipeContact = (direction: 'next' | 'prev') => {
    const n = friendsWithLocation.length;
    if (n < 2) return;
    const idx = Math.max(0, friendsWithLocation.findIndex((f) => f.userId === selectedFriendId));
    const nextIdx = direction === 'next' ? (idx + 1) % n : (idx - 1 + n) % n;
    setSelectedFriendId(friendsWithLocation[nextIdx].userId);
  };

  const pins: ThrowMapPin[] = useMemo(() => {
    const list: ThrowMapPin[] = [];
    if (myLocation) list.push({ id: 'self', latitude: myLocation.latitude, longitude: myLocation.longitude, label: 'You', isSelf: true });
    for (const f of friendsWithLocation) {
      const selected = f.userId === selectedFriendId;
      list.push({
        id: f.userId,
        latitude: f.location!.latitude,
        longitude: f.location!.longitude,
        label: f.name.split(' ')[0],
        selected,
        dimmed: !selected && friendsWithLocation.length > 1,
        onPress: lockedRecipient ? undefined : () => setSelectedFriendId(f.userId),
      });
    }
    return list;
  }, [myLocation, friendsWithLocation, selectedFriendId, lockedRecipient]);

  const runFlight = async (letter: ThrowLetter) => {
    const runId = ++flightRunIdRef.current;
    const stillCurrent = () => flightRunIdRef.current === runId;

    setFlight({ letter, phase: 'in_flight' });
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

    setFlight({ letter, phase: 'delivered' });
    await wait(DELIVERED_HOLD_MS);
    if (!stillCurrent()) return;

    setFlight(null);
    setFlightProgress(0);
  };

  const handleThrow = async (content: { messageText: string | null; strokes: StrokePath[] | null; penColor: string; photoUris: string[] }) => {
    if (!selectedFriend) return { error: 'Pick someone to throw to first.' };

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
    pendingLetterRef.current = letter;
    return { error: null };
  };

  const handleLaunched = () => {
    const letter = pendingLetterRef.current;
    pendingLetterRef.current = null;
    if (letter) runFlight(letter);
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
              <View style={[styles.recipientOverlay, { top: insets.top + 78 }]}>
                <Text style={styles.replyLine} numberOfLines={1}>
                  Throwing back to {selectedFriend.name}
                </Text>
              </View>
            )
          ) : (
            <View style={[styles.recipientOverlay, { top: insets.top + 78 }]}>
              <RecipientCarousel friends={friendsWithLocation} selectedIndex={selectedIndex} onChangeIndex={(i) => setSelectedFriendId(friendsWithLocation[i]?.userId ?? null)} />
            </View>
          ))}

        {!inFlight && !hasFriendsAtAll && (
          <View style={styles.emptyOverlay}>
            <Text style={styles.emptyTitle}>Nothing to throw yet.</Text>
            <Text style={styles.emptyBody}>Add people to your circle to start sending letters across the world.</Text>
          </View>
        )}

        {!inFlight && hasFriendsAtAll && selectedFriend && (
          <View style={[styles.letterCard, { bottom: insets.bottom + 16 + BOTTOM_NAV_CLEARANCE }]}>
            <FoldingLetter
              recipientName={selectedFriend.name}
              recipientCity={selectedFriend.location!.city}
              onThrow={handleThrow}
              onLaunched={handleLaunched}
              throwLabel={lockedRecipient ? 'Swipe up to throw back' : 'Swipe up to throw'}
              onOpenChats={onOpenChats}
              onOpenAddFriend={onOpenAddFriend}
              onOpenInbox={onOpenInbox}
              unreadCount={unreadCount}
              onSwipeContact={!lockedRecipient && friendsWithLocation.length > 1 ? handleSwipeContact : undefined}
            />
          </View>
        )}

        {inFlight && (
          <View style={[styles.flightStatusWrap, { bottom: insets.bottom + 16 + BOTTOM_NAV_CLEARANCE }]}>
            <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.flightStatus}>
              {flight!.phase === 'delivered' ? (
                <>
                  <Text style={styles.flightTitle}>Your letter has landed</Text>
                  <Text style={styles.flightBody}>
                    With {flight!.letter.counterpartName} in {flight!.letter.recipientCity} · {formatMiles(flight!.letter.distanceMiles)} away
                  </Text>
                </>
              ) : (
                <Text style={styles.flightTitle}>{`Flying to ${flight!.letter.counterpartName}…`}</Text>
              )}
            </GlassSurface>
          </View>
        )}
      </View>

      <GlassSurface tint="light" tintColor={throwGlass.tint} style={[styles.header, { top: insets.top + 10 }]}>
        <Pressable onPress={onHome} hitSlop={10} style={styles.headerBackBtn} accessibilityRole="button" accessibilityLabel="Back to Home">
          <Icon path={BACK_ICON} size={20} color={throwColor.inkSoft} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Throw</Text>
        <View style={styles.headerRight}>
          {selectedFriend && (
            <>
              {selectedStreak > 0 && (
                <View style={styles.streakChip} accessibilityLabel={`${selectedStreak} day throw streak with ${selectedFriend.name}`}>
                  <Text style={styles.streakText}>🔥{selectedStreak}</Text>
                </View>
              )}
              <View style={styles.pointsChip} accessibilityLabel={`${selectedPoints} leaderboard points for ${selectedFriend.name}`}>
                <Icon path={POINTS_ICON} size={11} color={throwColor.clayDeep} strokeWidth={2} />
                <Text style={styles.streakText}>{selectedPoints}</Text>
              </View>
            </>
          )}
          <Pressable onPress={onOpenSettings} hitSlop={10} accessibilityRole="button" accessibilityLabel="Throw settings">
            <Icon path={GEAR_ICON} size={19} color={throwColor.inkSoft} strokeWidth={1.8} />
          </Pressable>
        </View>
      </GlassSurface>

      <View style={styles.bottomNavWrap}>
        <BottomNav
          activeId="throw"
          onSelect={(id) => {
            if (id === 'home') onHome();
            if (id === 'expenses') onOpenExpenses();
            if (id === 'split') onOpenSplit();
          }}
          bottomInset={insets.bottom}
          reduceMotion={reduceMotion}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: throwColor.screenBg },
  // Absolutely positioned and rendered after mapArea in the tree, so — like bottomNavWrap below —
  // it floats over the map's own top edge instead of pushing the map down beneath it.
  header: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: throwRadius.pill,
    borderWidth: 1,
    borderColor: throwGlass.border,
  },
  headerTitle: { fontFamily: throwFont.hand700, fontSize: 26, color: throwColor.ink },
  headerBackBtn: { width: 48, alignItems: 'flex-start' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 48, justifyContent: 'flex-end' },
  streakChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: throwColor.claySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pointsChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: throwColor.claySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  streakText: { fontFamily: throwFont.ui700, fontSize: 12.5, color: throwColor.clayDeep },
  // Fills the whole screen edge-to-edge on all four sides — the header pill and BottomNav dock
  // both float on top of it (see their own comments) rather than the map making room for either.
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
  emptyOverlay: {
    position: 'absolute',
    top: '38%',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  emptyTitle: { fontFamily: throwFont.ui700, fontSize: 16, color: throwColor.ink, marginBottom: 6, textAlign: 'center' },
  emptyBody: { fontFamily: throwFont.ui400, fontSize: 13, color: throwColor.inkSoft, textAlign: 'center', lineHeight: 19 },
  letterCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '32%',
  },
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
