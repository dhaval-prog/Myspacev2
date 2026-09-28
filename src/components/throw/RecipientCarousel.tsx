import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { FriendAvatar } from '../friends/FriendAvatar';
import { StoryRing } from './StoryRing';
import { Icon } from '../Icon';
import { useCarouselSurface, tentDeviation, type CarouselPosCore } from '../../hooks/useCarouselPos';
import { throwColor, throwFont, throwNightColor } from '../../theme/throwTokens';
import type { ThrowFriend } from '../../types/throw';

const ITEM_SPACING = 82;
// The selected contact's avatar — bumped up from the previous 52px per explicit request that it
// read too small. Exported so ContactStoryStack (and MyStatusPanel) can size their own
// avatar-circle morphs to match exactly, without a second magic number that could drift out of
// sync with this one.
export const AVATAR_SIZE = 64;
const PULSE_RING_SIZE = AVATAR_SIZE + 16;
const PULSE_DURATION_MS = 1400;
// Exported so ThrowHomeScreen can work out where the selected contact's own ring actually sits on
// screen (see ContactStoryStack's flightTargetY) without duplicating this strip's height as its
// own separate magic number that could quietly drift out of sync with this one.
export const CAROUSEL_HEIGHT = 130;
// The status-letter-stack avatar pulse — same 1.12/180ms the interaction spec calls for, distinct
// from SelectedPulseRing's own slow looping "active" ring.
const AVATAR_PULSE_SCALE = 1.12;
const AVATAR_PULSE_MS = 180;
// A small solid ring override for whichever avatar's status-letter stack is currently open (see
// openIndex) — blue while photos remain in the avatar, a plain grey once it's empty, distinct
// from StoryRing's own animated "has an active story" ripple (which stays untouched and keeps
// rendering underneath it).
const AVATAR_COUNT_RING_SIZE = AVATAR_SIZE + 6;
const AVATAR_COUNT_RING_GREY = '#CFCFCF';
// The per-item falloff the interaction spec spells out exactly: `scale(1-0.2*min(1,|d|))`,
// `opacity 1-0.28*min(1,|d|)` — flat beyond one contact away, not a continued gradient.
const SCALE_FALLOFF = 0.2;
const OPACITY_FALLOFF = 0.28;
const PERSON_ICON = 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z';
const PLUS_ICON = 'M12 5v14M5 12h14';

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

/** The status-letter-stack's own small count badge — top-right of the avatar, matching the
 * interaction spec's reference (hidden rather than showing "0", since an empty avatar already
 * reads via the ring turning grey). */
function AvatarCountBadge({ count, isNight }: { count: number; isNight?: boolean }) {
  if (count <= 0) return null;
  return (
    <View style={[styles.countBadge, isNight && styles.countBadgeNight]}>
      <Text style={styles.countBadgeText}>{count}</Text>
    </View>
  );
}

/** The open-status-stack ring + badge + pulse overlay, shared between "You" and any real contact
 * whose stack is currently open (see openIndex) — factored out once so both draw it identically. */
function OpenStackOverlay({ count, pulseSignal, isNight }: { count: number; pulseSignal?: number; isNight?: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    Animated.sequence([
      Animated.timing(pulse, { toValue: AVATAR_PULSE_SCALE, duration: AVATAR_PULSE_MS, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: AVATAR_PULSE_MS, useNativeDriver: true }),
    ]).start();
  }, [pulseSignal, pulse]);

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <View pointerEvents="none" style={[styles.countRing, { borderColor: count > 0 ? throwColor.activeBlue : AVATAR_COUNT_RING_GREY }]} />
      <AvatarCountBadge count={count} isNight={isNight} />
    </Animated.View>
  );
}

interface RecipientCarouselProps {
  /** The shared spring driving this rail (and, on the letter side, MyStatusPanel) — see
   * useCarouselPos's own doc comment for why this is owned by the screen, not this component. */
  core: CarouselPosCore;
  /** "Myself" + real friends with a location, index 0..n-1 — unchanged from before "You" existed
   * as its own rail item at index -1. */
  friends: ThrowFriend[];
  disabled?: boolean;
  /** Switches the selected contact's pulse ring from Throw's day-skin blue to a white "beeping"
   * ring, matching the night reference screenshot — same day/night signal as FoldingLetter's own
   * isNight prop. */
  isNight?: boolean;
  /** How many active stories a contact has, for the blue status ring (see StoryRing) — also used
   * for "You" via `youUserId`, since posting your own status is the exact same underlying signal
   * wherever it's read from. */
  storyCountFor?: (userId: string) => number;
  /** Tapping an already-selected real contact (never "Myself" — see its own exclusion below) who
   * has an active story opens it instead of re-selecting them (a no-op otherwise). */
  onOpenStory?: (userId: string) => void;
  /** Never treated as "has a status to view" on re-tap, even though it shares youUserId's own
   * storyCountFor signal — "Myself" is the reminder-compose slot, not a status one; viewing/
   * posting your own status is exclusively "You"'s job now. */
  selfUserId?: string;
  /** Your own id — "You" doesn't exist as a rail item at all without one (signed out). */
  youUserId?: string;
  /** Fired on every tap of the already-selected "You" avatar (unlike onOpenStory, never gated on
   * already having a story — an empty avatar tap is just a no-op further down the line, inside
   * MyStatusPanel's own dropSignal effect). */
  onOpenYouStatus?: () => void;
  /** Which rail index currently has its status stack open (-1 for "You", 0..n-1 for a friend) —
   * shows the solid count ring/badge/pulse there instead of the normal ripple. Undefined when
   * nothing is open. */
  openIndex?: number;
  openAvatarCount?: number;
  openPulseSignal?: number;
}

/**
 * A floating avatar carousel over the map — swipe or tap to change who a letter is addressed
 * to, or (for "You", always the first/leftmost item) whose live status camera is showing. Not a
 * dropdown: the centered avatar is the selection, side avatars shrink and fade with distance.
 * Position math (translate/scale/opacity) is purely a function of the shared `core.pos` — see
 * useCarouselPos — so this never re-renders while swiping, only while actually re-selecting.
 */
export function RecipientCarousel({
  core,
  friends,
  disabled,
  isNight,
  storyCountFor,
  onOpenStory,
  selfUserId,
  youUserId,
  onOpenYouStatus,
  openIndex,
  openAvatarCount = 0,
  openPulseSignal,
}: RecipientCarouselProps) {
  const { ref, panHandlers } = useCarouselSurface(core, ITEM_SPACING, !disabled);
  const n = friends.length;

  if (n === 0 && !youUserId) return null;

  const renderItem = (i: number, content: React.ReactNode) => {
    const { d, a } = tentDeviation(core.pos, i);
    const translateX = Animated.multiply(d, ITEM_SPACING);
    const scale = a.interpolate({ inputRange: [0, 1], outputRange: [1, 1 - SCALE_FALLOFF] });
    const opacity = a.interpolate({ inputRange: [0, 1], outputRange: [1, 1 - OPACITY_FALLOFF] });
    return (
      <Animated.View key={i} style={[styles.item, { transform: [{ translateX }, { scale }], opacity }]}>
        {content}
      </Animated.View>
    );
  };

  return (
    <View ref={ref} style={styles.wrap} {...panHandlers}>
      <View style={styles.strip}>
        {youUserId &&
          renderItem(
            -1,
            <Pressable
              onPress={() => (core.index === -1 ? onOpenYouStatus?.() : core.springTo(-1))}
              disabled={disabled}
              hitSlop={8}
              style={styles.pressableContent}
              accessibilityRole="button"
              accessibilityLabel="Your status"
            >
              <View style={styles.avatarWrap}>
                {core.index === -1 && <SelectedPulseRing isNight={isNight} />}
                <StoryRing count={storyCountFor?.(youUserId) ?? 0} size={AVATAR_SIZE}>
                  <View style={[styles.meCircle, core.index === -1 && (isNight ? styles.avatarSelectedNight : styles.avatarSelected)]}>
                    <Icon path={PERSON_ICON} size={26} color="rgba(255,255,255,.75)" strokeWidth={1.8} />
                    <View style={styles.meBadge}>
                      <Icon path={PLUS_ICON} size={12} color={throwColor.ink} strokeWidth={2.4} />
                    </View>
                  </View>
                </StoryRing>
                {openIndex === -1 && <OpenStackOverlay count={openAvatarCount} pulseSignal={openPulseSignal} isNight={isNight} />}
              </View>
              <Text style={[styles.name, isNight && styles.nameNight, core.index === -1 && (isNight ? styles.nameSelectedNight : styles.nameSelected)]}>
                You
              </Text>
              <Text style={[styles.city, isNight && styles.cityNight]}>{(storyCountFor?.(youUserId) ?? 0) > 0 ? 'My status' : 'Add status'}</Text>
            </Pressable>,
          )}
        {friends.map((f, i) => {
          const isSelected = core.index === i;
          const canOpenStory = f.userId !== selfUserId && (storyCountFor?.(f.userId) ?? 0) > 0;
          return renderItem(
            i,
            <Pressable
              key={f.userId}
              onPress={() => {
                if (isSelected && canOpenStory) {
                  onOpenStory?.(f.userId);
                  return;
                }
                core.springTo(i);
              }}
              disabled={disabled}
              hitSlop={8}
              style={styles.pressableContent}
            >
              <View style={styles.avatarWrap}>
                {isSelected && <SelectedPulseRing isNight={isNight} />}
                <StoryRing count={storyCountFor?.(f.userId) ?? 0} size={AVATAR_SIZE}>
                  <FriendAvatar
                    userId={f.userId}
                    name={f.name}
                    avatarUrl={f.avatarUrl}
                    size={AVATAR_SIZE}
                    style={isSelected && (isNight ? styles.avatarSelectedNight : styles.avatarSelected)}
                  />
                </StoryRing>
                {openIndex === i && <OpenStackOverlay count={openAvatarCount} pulseSignal={openPulseSignal} isNight={isNight} />}
              </View>
              <Text
                style={[styles.name, isNight && styles.nameNight, isSelected && (isNight ? styles.nameSelectedNight : styles.nameSelected)]}
                numberOfLines={1}
              >
                {f.name.split(' ')[0]}
              </Text>
              {f.location && (
                <Text style={[styles.city, isNight && styles.cityNight]} numberOfLines={1}>
                  {f.location.city}
                </Text>
              )}
            </Pressable>,
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
    borderWidth: 2,
    borderColor: throwColor.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeNight: { borderColor: throwNightColor.ink },
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
  // "You"'s own avatar content — a dark circle, person glyph, small green "+" badge, per explicit
  // reference screenshot (was AddStoryButton's own look before "You" became a real rail item).
  meCircle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: throwColor.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...throwColor.shadowSoft,
  },
  meBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: throwColor.storyRing,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { marginTop: 6, fontFamily: throwFont.ui600, fontSize: 12.5, color: throwColor.inkMute, textAlign: 'center' },
  nameSelected: { color: throwColor.ink, fontFamily: throwFont.ui700 },
  // Night skin — white instead of Throw's warm-ink day text, both for the selected contact and
  // the rest of the strip, per explicit request (the ink colours read almost invisibly dark
  // against the night map/paper).
  nameNight: { color: 'rgba(255,255,255,.7)' },
  nameSelectedNight: { color: '#FFFFFF', fontFamily: throwFont.ui700 },
  city: { fontFamily: throwFont.ui400, fontSize: 10.5, color: throwColor.inkFaint, marginTop: 1, textAlign: 'center' },
  cityNight: { color: 'rgba(255,255,255,.55)' },
});
