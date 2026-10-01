import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { FriendAvatar } from '../friends/FriendAvatar';
import { StoryRing } from './StoryRing';
import { AddStoryButton } from './AddStoryButton';
import { NotificationCircleButton } from './NotificationCircleButton';
import { throwColor, throwFont, throwNightColor } from '../../theme/throwTokens';
import { noSelect } from '../../theme/webStyles';
import type { ThrowFriend } from '../../types/throw';

const ITEM_SPACING = 92;
// The selected contact's avatar — bumped up from the previous 52px per explicit request that it
// read too small. Exported so ContactStoryStack can size its own avatar-circle morph to match
// exactly, without a second magic number that could drift out of sync with this one.
export const AVATAR_SIZE = 64;
const PULSE_RING_SIZE = AVATAR_SIZE + 16;
const PULSE_DURATION_MS = 1400;
// Exported so ThrowHomeScreen can work out where the selected contact's own ring actually sits on
// screen (see ContactStoryStack's flightTargetY) without duplicating this strip's height as its
// own separate magic number that could quietly drift out of sync with this one.
export const CAROUSEL_HEIGHT = 130;
// The status-letter-stack avatar pulse (see storyModePulseSignal) — same 1.12/180ms the
// interaction spec calls for, distinct from SelectedPulseRing's own slow looping "active" ring.
const AVATAR_PULSE_SCALE = 1.12;
const AVATAR_PULSE_MS = 180;
// A small solid ring override for whichever contact's status-letter stack is currently open (see
// storyModeAvatarCount) — blue while photos remain in the avatar, a plain grey once it's empty,
// distinct from StoryRing's own animated "has an active story" ripple (which stays untouched and
// keeps rendering underneath it).
const AVATAR_COUNT_RING_SIZE = AVATAR_SIZE + 6;
const AVATAR_COUNT_RING_GREY = '#CFCFCF';

/** A soft, looping ring that expands and fades behind the selected contact's avatar — an
 * "active" indicator, distinct from the rest of Throw's warm-paper/clay palette on purpose (the
 * one place a cool blue accent belongs), per explicit request with a reference screenshot. At
 * night it switches to a white "beeping" ring instead of the day skin's blue, matching the
 * night reference screenshot (same destination day/night signal as FoldingLetter's isNight). */
function SelectedPulseRing({ isNight }: { isNight?: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: PULSE_DURATION_MS, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.3] });
  const opacity = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.55, 0.22, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pulseRing, isNight && styles.pulseRingNight, { transform: [{ scale }], opacity }]}
    />
  );
}

interface RecipientCarouselProps {
  friends: ThrowFriend[];
  selectedIndex: number;
  onChangeIndex: (index: number) => void;
  disabled?: boolean;
  /** Switches the selected contact's pulse ring from Throw's day-skin blue to a white "beeping"
   * ring, matching the night reference screenshot — same day/night signal as FoldingLetter's own
   * isNight prop. */
  isNight?: boolean;
  /** How many active stories a contact has, for the green status ring (see StoryRing) — absent
   * (or 0 for everyone) simply renders no rings, so this stays optional for callers/tests that
   * don't care about stories at all. */
  storyCountFor?: (userId: string) => number;
  /** Tapping a contact who is *already* selected and has an active story opens it instead of
   * re-selecting them (which would otherwise be a no-op) — lets one tap target serve both
   * "switch to this contact" and "view their story" without a second control. */
  onOpenStory?: (userId: string) => void;
  /** Opens the story capture flow — rendered as a slot in this same strip, one position to the
   * left of the first real contact (index 0), rather than as a separate fixed-position control,
   * per explicit request: it should fade/shrink with distance from center exactly like any other
   * off-center contact would, not sit at a constant full size/opacity beside the strip. Omitted
   * entirely (no slot rendered) when absent, e.g. in tests that don't care about stories. */
  onAddStory?: () => void;
  /** True while the user is actually viewing/posting their own Status (see ThrowHomeScreen's
   * isStatusMode) — moves the "active contact" chrome (pulse ring + inner border) from whichever
   * real contact is otherwise selected onto the add-story slot itself, and rests the strip's own
   * live offset there too, so Status visibly reads as the current selection instead of leaving a
   * real contact looking selected while its own letter isn't even on screen. */
  isAddStorySelected?: boolean;
  /** How many of the *selected* contact's status photos are still sitting in their avatar right
   * now — only meaningful while that contact's status-letter stack is actually open (see
   * ContactStoryStack's own onAvatarCountChange). Present (even at 0) swaps the selected item's
   * ring/badge from the normal "has an active story" look to a solid count ring; absent leaves
   * every avatar exactly as it always looked. */
  storyModeAvatarCount?: number;
  /** Increment to make the selected avatar do its own quick scale pulse (a photo just landed in
   * or flew back into the open contact's letter) — same trigger-by-changing-a-number convention
   * as ThrowHomeScreen's other one-shot signals. */
  storyModePulseSignal?: number;
  /** A live, externally-driven fractional index (see FoldingLetter/StoryCaptureScreen's own
   * onContactDragOffset), present only while a recipient-switching drag is actually in progress
   * elsewhere on screen (the letter's own writing-phase flick, or the status camera's) — the
   * strip tracks it 1:1, the same way its own internal drag already does, instead of only
   * reacting once `selectedIndex` itself lands on a new value. Undefined the rest of the time,
   * which leaves the existing resting-index spring below fully in charge. */
  liveOffset?: number;
  /** How many of a contact's letters to me are still unread — shown as a small top-right badge on
   * *any* contact's avatar (not just the selected one, unlike storyModeAvatarCount's own badge),
   * per explicit request; a letter being opened clears it the next time this refreshes (see
   * useInboxArrival's own markRead call). Omitted entirely for callers that don't track unread
   * letters at all (tests, or a carousel shown outside Throw's own letter flow). */
  unreadCountFor?: (userId: string) => number;
  /** Opens the full notification history — rendered as a slot in this same strip, one position
   * further left than the add-story slot (index -2), so it slides/scales with the rest of the
   * carousel exactly like any other off-center item instead of sitting fixed in place. Omitted
   * entirely (no slot rendered) when absent, same convention as onAddStory. */
  onOpenNotifications?: () => void;
  /** Badge count shown on the notifications slot — see NotificationCircleButton. */
  notificationsUnreadCount?: number;
  /** True while the Notifications slot itself is the current selection (its own glassmorphism
   * card is showing above the map instead of the letter) — moves the strip's own resting offset
   * onto it and gives it the same "active" chrome (pulse ring, inner border) a selected contact
   * or Add Status gets. Same convention as isAddStorySelected, one slot further left. */
  isNotificationsSelected?: boolean;
}

/** The status-letter-stack's own small count badge — top-right of the avatar, matching the
 * interaction spec's reference (hidden rather than showing "0", since an empty avatar already
 * reads via the ring turning grey). Always a plain white-bordered blue circle regardless of
 * day/night skin — see countBadge's own comment. */
function AvatarCountBadge({ count }: { count: number; isNight?: boolean }) {
  if (count <= 0) return null;
  return (
    <View style={styles.countBadge}>
      <Text style={styles.countBadgeText}>{count}</Text>
    </View>
  );
}

/**
 * A floating avatar carousel over the map — swipe or tap to change who a letter is addressed
 * to. Not a dropdown: the centered avatar is the selection, side avatars shrink and fade with
 * distance. Clamped at the ends rather than a true infinite loop (simpler, and every real
 * friends list here is short enough that the clamp is never felt as a limitation).
 */
export function RecipientCarousel({
  friends,
  selectedIndex,
  onChangeIndex,
  disabled,
  isNight,
  storyCountFor,
  onOpenStory,
  onAddStory,
  isAddStorySelected,
  storyModeAvatarCount,
  storyModePulseSignal,
  liveOffset,
  unreadCountFor,
  onOpenNotifications,
  notificationsUnreadCount,
  isNotificationsSelected,
}: RecipientCarouselProps) {
  const avatarPulse = useRef(new Animated.Value(1)).current;
  const isFirstPulseRender = useRef(true);
  useEffect(() => {
    if (isFirstPulseRender.current) {
      isFirstPulseRender.current = false;
      return;
    }
    Animated.sequence([
      Animated.timing(avatarPulse, { toValue: AVATAR_PULSE_SCALE, duration: AVATAR_PULSE_MS, useNativeDriver: true }),
      Animated.timing(avatarPulse, { toValue: 1, duration: AVATAR_PULSE_MS, useNativeDriver: true }),
    ]).start();
  }, [storyModePulseSignal, avatarPulse]);

  const n = friends.length;
  const maxIndex = Math.max(0, n - 1);
  // How far left a drag may reach — all the way to the notifications slot (-2) when it's present,
  // else just the add-story slot (-1), else no further than the first real contact (0). Lets a
  // flick from a real contact (or from Add Story) carry on into Notifications instead of only
  // being reachable by tapping it directly. Also the floor for an externally-driven liveOffset
  // (see its own effect below), so a flick starting from inside the Notifications/Add Status cards
  // themselves (see ThrowHomeScreen's own contact-drag machinery) can drive the strip just as far.
  const minDragIndex = onOpenNotifications ? -2 : onAddStory ? -1 : 0;
  // Where the strip's own live offset should rest whenever nothing is actively being dragged —
  // the notifications slot (-2) while it's selected, the add-story slot (-1) while Status is,
  // otherwise whatever real contact is.
  const restingIndex = isNotificationsSelected ? -2 : isAddStorySelected ? -1 : Math.min(selectedIndex, maxIndex);
  const offset = useRef(new Animated.Value(restingIndex)).current;
  const offsetValueRef = useRef(restingIndex);
  const grantOffsetRef = useRef(0);
  const draggingRef = useRef(false);

  React.useEffect(() => {
    const id = offset.addListener(({ value }) => {
      offsetValueRef.current = value;
    });
    return () => offset.removeListener(id);
  }, [offset]);

  React.useEffect(() => {
    if (draggingRef.current || liveOffset != null) return;
    if (Math.round(offsetValueRef.current) === restingIndex) return;
    Animated.spring(offset, { toValue: restingIndex, useNativeDriver: false, friction: 8, tension: 60 }).start();
  }, [restingIndex, offset, liveOffset]);

  // Tracks an externally-driven drag 1:1 (no spring) — the same immediate `setValue` the strip's
  // own internal PanResponder already uses for its own move events below, just fed by someone
  // else's gesture instead. The moment `liveOffset` goes back to undefined (the drag ended), the
  // effect above takes back over and springs to wherever `selectedIndex` actually landed.
  React.useEffect(() => {
    if (liveOffset == null) return;
    offset.setValue(Math.max(minDragIndex, Math.min(maxIndex, liveOffset)));
  }, [liveOffset, maxIndex, minDragIndex, offset]);

  const snapTo = (index: number) => {
    const clamped = Math.max(0, Math.min(maxIndex, index));
    Animated.spring(offset, { toValue: clamped, useNativeDriver: false, friction: 8, tension: 60 }).start();
    // Also fires when the tapped contact is already `selectedIndex` but Status is what's actually
    // showing (isAddStorySelected) — otherwise tapping your own already-selected contact while
    // viewing Status would be a silent no-op (the index truly hasn't changed) and leave Status
    // stuck on screen with no way back short of picking a *different* contact first.
    if (clamped !== selectedIndex || isAddStorySelected) onChangeIndex(clamped);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled && n > 1,
        onMoveShouldSetPanResponder: (_, g) => !disabled && n > 1 && Math.abs(g.dx) > 6,
        onPanResponderGrant: () => {
          draggingRef.current = true;
          grantOffsetRef.current = offsetValueRef.current;
        },
        onPanResponderMove: (_, g) => {
          const raw = grantOffsetRef.current - g.dx / ITEM_SPACING;
          offset.setValue(Math.max(minDragIndex, Math.min(maxIndex, raw)));
        },
        onPanResponderRelease: (_, g) => {
          draggingRef.current = false;
          const raw = grantOffsetRef.current - g.dx / ITEM_SPACING;
          const nearest = Math.max(minDragIndex, Math.min(maxIndex, Math.round(raw)));
          // Dragging to the notifications slot selects it exactly like tapping it does — same
          // optimistic spring as Add Story's own case below, so it doesn't visually bounce back
          // before the parent's own isNotificationsSelected round-trip takes over.
          if (nearest === -2 && onOpenNotifications) {
            Animated.spring(offset, { toValue: -2, useNativeDriver: false, friction: 8, tension: 60 }).start();
            onOpenNotifications();
            return;
          }
          // Dragging to the add-story slot selects it exactly like tapping it does — the spring
          // here is just so it doesn't visually bounce back before the parent's own
          // isAddStorySelected round-trip takes over via the resting-index effect above.
          if (nearest === -1 && onAddStory) {
            Animated.spring(offset, { toValue: -1, useNativeDriver: false, friction: 8, tension: 60 }).start();
            onAddStory();
            return;
          }
          Animated.spring(offset, { toValue: nearest, useNativeDriver: false, friction: 8, tension: 60 }).start();
          // See snapTo's own comment — same "already selectedIndex, but Status is what's showing"
          // case can be reached by dragging the strip back to rest on the same real contact too.
          if (nearest !== selectedIndex || isAddStorySelected) onChangeIndex(nearest);
        },
      }),
    [disabled, n, maxIndex, selectedIndex, onChangeIndex, offset, isAddStorySelected, minDragIndex, onOpenNotifications, onAddStory],
  );

  if (n === 0) return null;

  // Every item's position/scale/opacity is purely a function of its own fixed slot index `i` and
  // how far the live `offset` currently sits from it — shared here so the add-story slot (i = -1,
  // rendered below) reads exactly like a real contact one position further left, the same falloff
  // as every other off-center item, without duplicating this math for it.
  const span = Math.max(1, maxIndex);
  const itemTransform = (i: number) => ({
    translateX: offset.interpolate({ inputRange: [0, span], outputRange: [i * ITEM_SPACING, (i - span) * ITEM_SPACING] }),
    scale: offset.interpolate({
      inputRange: [i - 2, i - 1, i, i + 1, i + 2],
      outputRange: [0.68, 0.82, 1, 0.82, 0.68],
      extrapolate: 'clamp',
    }),
    opacity: offset.interpolate({
      inputRange: [i - 2, i - 1, i, i + 1, i + 2],
      outputRange: [0.4, 0.68, 1, 0.68, 0.4],
      extrapolate: 'clamp',
    }),
  });

  const addStoryTransform = onAddStory ? itemTransform(-1) : null;
  // Its own independent falloff, exactly like any other slot — when it isn't the current
  // selection, it shrinks/fades by its own real distance from whatever is (one step further than
  // Add Story's own, since it sits one more position left), the same "inactive" look a real
  // contact one slot further away would get. Only becomes full size/opacity by actually being the
  // selection (isNotificationsSelected, via restingIndex above), same as Add Story or any contact.
  const notificationsTransform = onOpenNotifications ? itemTransform(-2) : null;

  return (
    <View style={[styles.wrap, noSelect]} {...panResponder.panHandlers}>
      <View style={styles.strip}>
        {onOpenNotifications && notificationsTransform && (
          <Animated.View
            style={[
              styles.item,
              {
                transform: [{ translateX: notificationsTransform.translateX }, { scale: notificationsTransform.scale }],
                opacity: notificationsTransform.opacity,
              },
            ]}
          >
            <View style={styles.pressableContent}>
              <View style={styles.avatarWrap}>
                {isNotificationsSelected && <SelectedPulseRing isNight={isNight} />}
                <NotificationCircleButton onPress={onOpenNotifications} unreadCount={notificationsUnreadCount ?? 0} selected={isNotificationsSelected} isNight={isNight} />
              </View>
              <Text
                style={[
                  styles.name,
                  styles.utilityLabel,
                  isNight && styles.nameNight,
                  isNotificationsSelected && (isNight ? styles.nameSelectedNight : styles.nameSelected),
                ]}
                numberOfLines={1}
              >
                Notifications
              </Text>
              {/* Invisible placeholder reserving the same second-line height a real contact's
                  city text occupies — without it, this slot's shorter content stack gets centered
                  differently than a real contact's (see the strip's own justifyContent), landing
                  its circle at a visibly different height. */}
              <Text style={[styles.city, styles.hiddenPlaceholder]} numberOfLines={1}>
                {' '}
              </Text>
            </View>
          </Animated.View>
        )}
        {onAddStory && addStoryTransform && (
          <Animated.View
            style={[
              styles.item,
              { transform: [{ translateX: addStoryTransform.translateX }, { scale: addStoryTransform.scale }], opacity: addStoryTransform.opacity },
            ]}
          >
            <View style={styles.pressableContent}>
              <View style={styles.avatarWrap}>
                {isAddStorySelected && <SelectedPulseRing isNight={isNight} />}
                <AddStoryButton onPress={onAddStory} selected={isAddStorySelected} isNight={isNight} />
              </View>
              <Text
                style={[styles.name, styles.utilityLabel, isNight && styles.nameNight, isAddStorySelected && (isNight ? styles.nameSelectedNight : styles.nameSelected)]}
                numberOfLines={1}
              >
                Add Status
              </Text>
              {/* See the notifications slot's own matching placeholder above for why. */}
              <Text style={[styles.city, styles.hiddenPlaceholder]} numberOfLines={1}>
                {' '}
              </Text>
            </View>
          </Animated.View>
        )}
        {friends.map((f, i) => {
          const { translateX, scale, opacity } = itemTransform(i);
          const isSelected = i === selectedIndex && !isAddStorySelected;
          return (
            <Animated.View key={f.userId} style={[styles.item, { transform: [{ translateX }, { scale }], opacity }]}>
              <Pressable
                onPress={() => {
                  if (isSelected && onOpenStory && (storyCountFor?.(f.userId) ?? 0) > 0) {
                    onOpenStory(f.userId);
                    return;
                  }
                  snapTo(i);
                }}
                disabled={disabled}
                hitSlop={8}
                style={styles.pressableContent}
              >
                <View style={styles.avatarWrap}>
                  {isSelected && <SelectedPulseRing isNight={isNight} />}
                  <Animated.View
                    style={isSelected && storyModeAvatarCount !== undefined ? { transform: [{ scale: avatarPulse }] } : undefined}
                  >
                    <StoryRing count={storyCountFor?.(f.userId) ?? 0} size={AVATAR_SIZE}>
                      <FriendAvatar
                        userId={f.userId}
                        name={f.name}
                        avatarUrl={f.avatarUrl}
                        size={AVATAR_SIZE}
                        style={isSelected && (isNight ? styles.avatarSelectedNight : styles.avatarSelected)}
                      />
                    </StoryRing>
                    {isSelected && storyModeAvatarCount !== undefined && (
                      <>
                        <View
                          pointerEvents="none"
                          style={[
                            styles.countRing,
                            { borderColor: storyModeAvatarCount > 0 ? throwColor.activeBlue : AVATAR_COUNT_RING_GREY },
                          ]}
                        />
                        <AvatarCountBadge count={storyModeAvatarCount} isNight={isNight} />
                      </>
                    )}
                    {/* Unread-letter badge — any contact, not just the selected one (unlike the
                        story-mode badge above, which it defers to whenever both would otherwise
                        land on the same avatar). */}
                    {!(isSelected && storyModeAvatarCount !== undefined) && (
                      <AvatarCountBadge count={unreadCountFor?.(f.userId) ?? 0} isNight={isNight} />
                    )}
                  </Animated.View>
                </View>
                <Text
                  style={[
                    styles.name,
                    isNight && styles.nameNight,
                    isSelected && (isNight ? styles.nameSelectedNight : styles.nameSelected),
                  ]}
                  numberOfLines={1}
                >
                  {f.name.split(' ')[0]}
                </Text>
                {f.location && (
                  <Text style={[styles.city, isNight && styles.cityNight]} numberOfLines={1}>
                    {f.location.city}
                  </Text>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Centered as a fraction of the wrapping View rather than the (variable-padding, see StoryRing)
  // element it's drawn on top of — StoryRing always centers the actual avatar within its own box
  // regardless of that padding, so 50%/50% + a fixed negative margin lands on the avatar's own
  // center either way.
  countRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: AVATAR_COUNT_RING_SIZE,
    height: AVATAR_COUNT_RING_SIZE,
    marginLeft: -AVATAR_COUNT_RING_SIZE / 2,
    marginTop: -AVATAR_COUNT_RING_SIZE / 2,
    borderRadius: AVATAR_COUNT_RING_SIZE / 2,
    borderWidth: 2.5,
  },
  countBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -AVATAR_SIZE / 2 - 8,
    marginLeft: AVATAR_SIZE / 2 - 12,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: throwColor.activeBlue,
    // Always a plain white ring (not the day/night paper tone) so it reads clearly as a border
    // sitting on top of — and overlapping — the ring/avatar underneath it, in both skins.
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  // Taller than before (108 → 130) to fit the bigger avatar/pulse ring plus both text lines
  // without clipping against `overflow: hidden`.
  wrap: { height: CAROUSEL_HEIGHT, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  strip: { width: ITEM_SPACING, height: CAROUSEL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  item: { position: 'absolute', width: ITEM_SPACING, alignItems: 'center' },
  // Centers the Pressable's own content — without this, RN's default `alignItems: 'stretch'`
  // makes each Text stretch to the width of its widest sibling (often the city name), which then
  // renders left-aligned inside that wider box instead of visually centered under the avatar.
  pressableContent: { alignItems: 'center' },
  avatarWrap: { width: PULSE_RING_SIZE, height: PULSE_RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute',
    width: PULSE_RING_SIZE,
    height: PULSE_RING_SIZE,
    borderRadius: PULSE_RING_SIZE / 2,
    borderWidth: 2,
    borderColor: throwColor.activeBlue,
    backgroundColor: throwColor.activeBlueSoft,
  },
  pulseRingNight: { borderColor: throwNightColor.ink, backgroundColor: 'rgba(255,255,255,.18)' },
  // The selected contact's own inner border, drawn directly on the avatar's edge — a subtle,
  // low-opacity dark line (not a solid black/blue) per explicit request, distinct from the blue
  // pulse ring/story wave that both sit further outside it (see pulseRing/StoryRing), which stay
  // blue and unchanged.
  avatarSelected: { borderWidth: 2, borderColor: throwColor.inkFaint },
  avatarSelectedNight: { borderWidth: 2, borderColor: throwNightColor.ink },
  name: { marginTop: 6, fontFamily: throwFont.ui600, fontSize: 12.5, color: throwColor.inkMute, textAlign: 'center' },
  nameSelected: { color: throwColor.ink, fontFamily: throwFont.ui700 },
  // Night skin — white instead of Throw's warm-ink day text, both for the selected contact and
  // the rest of the strip, per explicit request (the ink colours read almost invisibly dark
  // against the night map/paper).
  nameNight: { color: 'rgba(255,255,255,.7)' },
  nameSelectedNight: { color: '#FFFFFF', fontFamily: throwFont.ui700 },
  city: { fontFamily: throwFont.ui400, fontSize: 10.5, color: throwColor.inkFaint, marginTop: 1, textAlign: 'center' },
  cityNight: { color: 'rgba(255,255,255,.55)' },
  hiddenPlaceholder: { opacity: 0 },
  // "Notifications" is long enough to risk clipping at the regular name size within this strip's
  // narrow per-item width — sized down a touch so it reliably fits on one line, matching Add
  // Status's own label (kept at the same size for visual consistency between the two).
  utilityLabel: { fontSize: 11 },
});
