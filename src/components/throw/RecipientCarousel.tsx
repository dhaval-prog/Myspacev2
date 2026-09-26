import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { FriendAvatar } from '../friends/FriendAvatar';
import { throwColor, throwFont } from '../../theme/throwTokens';
import type { ThrowFriend } from '../../types/throw';

const ITEM_SPACING = 92;
// The selected contact's avatar — bumped up from the previous 52px per explicit request that it
// read too small.
const AVATAR_SIZE = 64;
const PULSE_RING_SIZE = AVATAR_SIZE + 16;
const PULSE_DURATION_MS = 1400;

/** A soft, looping blue ring that expands and fades behind the selected contact's avatar — an
 * "active" indicator, distinct from the rest of Throw's warm-paper/clay palette on purpose (the
 * one place a cool blue accent belongs), per explicit request with a reference screenshot. */
function SelectedPulseRing() {
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
      style={[styles.pulseRing, { transform: [{ scale }], opacity }]}
    />
  );
}

interface RecipientCarouselProps {
  friends: ThrowFriend[];
  selectedIndex: number;
  onChangeIndex: (index: number) => void;
  disabled?: boolean;
}

/**
 * A floating avatar carousel over the map — swipe or tap to change who a letter is addressed
 * to. Not a dropdown: the centered avatar is the selection, side avatars shrink and fade with
 * distance. Clamped at the ends rather than a true infinite loop (simpler, and every real
 * friends list here is short enough that the clamp is never felt as a limitation).
 */
export function RecipientCarousel({ friends, selectedIndex, onChangeIndex, disabled }: RecipientCarouselProps) {
  const n = friends.length;
  const maxIndex = Math.max(0, n - 1);
  const offset = useRef(new Animated.Value(Math.min(selectedIndex, maxIndex))).current;
  const offsetValueRef = useRef(Math.min(selectedIndex, maxIndex));
  const grantOffsetRef = useRef(0);
  const draggingRef = useRef(false);

  React.useEffect(() => {
    const id = offset.addListener(({ value }) => {
      offsetValueRef.current = value;
    });
    return () => offset.removeListener(id);
  }, [offset]);

  React.useEffect(() => {
    if (draggingRef.current) return;
    if (Math.round(offsetValueRef.current) === selectedIndex) return;
    Animated.spring(offset, { toValue: selectedIndex, useNativeDriver: false, friction: 8, tension: 60 }).start();
  }, [selectedIndex, offset]);

  const snapTo = (index: number) => {
    const clamped = Math.max(0, Math.min(maxIndex, index));
    Animated.spring(offset, { toValue: clamped, useNativeDriver: false, friction: 8, tension: 60 }).start();
    if (clamped !== selectedIndex) onChangeIndex(clamped);
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
          offset.setValue(Math.max(0, Math.min(maxIndex, raw)));
        },
        onPanResponderRelease: (_, g) => {
          draggingRef.current = false;
          const raw = grantOffsetRef.current - g.dx / ITEM_SPACING;
          const nearest = Math.max(0, Math.min(maxIndex, Math.round(raw)));
          Animated.spring(offset, { toValue: nearest, useNativeDriver: false, friction: 8, tension: 60 }).start();
          if (nearest !== selectedIndex) onChangeIndex(nearest);
        },
      }),
    [disabled, n, maxIndex, selectedIndex, onChangeIndex, offset],
  );

  if (n === 0) return null;

  return (
    <View style={styles.wrap} {...panResponder.panHandlers}>
      <View style={styles.strip}>
        {friends.map((f, i) => {
          const span = Math.max(1, maxIndex);
          const translateX = offset.interpolate({ inputRange: [0, span], outputRange: [i * ITEM_SPACING, (i - span) * ITEM_SPACING] });
          const scale = offset.interpolate({
            inputRange: [i - 2, i - 1, i, i + 1, i + 2],
            outputRange: [0.68, 0.82, 1, 0.82, 0.68],
            extrapolate: 'clamp',
          });
          const opacity = offset.interpolate({
            inputRange: [i - 2, i - 1, i, i + 1, i + 2],
            outputRange: [0.4, 0.68, 1, 0.68, 0.4],
            extrapolate: 'clamp',
          });
          const isSelected = i === selectedIndex;
          return (
            <Animated.View key={f.userId} style={[styles.item, { transform: [{ translateX }, { scale }], opacity }]}>
              <Pressable onPress={() => snapTo(i)} hitSlop={8} style={styles.pressableContent}>
                <View style={styles.avatarWrap}>
                  {isSelected && <SelectedPulseRing />}
                  <FriendAvatar userId={f.userId} name={f.name} avatarUrl={f.avatarUrl} size={AVATAR_SIZE} style={isSelected && styles.avatarSelected} />
                </View>
                <Text style={[styles.name, isSelected && styles.nameSelected]} numberOfLines={1}>
                  {f.name.split(' ')[0]}
                </Text>
                {f.location && (
                  <Text style={styles.city} numberOfLines={1}>
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
  // Taller than before (108 → 130) to fit the bigger avatar/pulse ring plus both text lines
  // without clipping against `overflow: hidden`.
  wrap: { height: 130, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  strip: { width: ITEM_SPACING, height: 130, alignItems: 'center', justifyContent: 'center' },
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
  avatarSelected: { borderWidth: 2, borderColor: throwColor.activeBlue },
  name: { marginTop: 6, fontFamily: throwFont.ui600, fontSize: 12.5, color: throwColor.inkMute, textAlign: 'center' },
  nameSelected: { color: throwColor.ink, fontFamily: throwFont.ui700 },
  city: { fontFamily: throwFont.ui400, fontSize: 10.5, color: throwColor.inkFaint, marginTop: 1, textAlign: 'center' },
});
