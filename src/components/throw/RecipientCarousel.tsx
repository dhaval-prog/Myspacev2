import React, { useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { FriendAvatar } from '../friends/FriendAvatar';
import { throwColor, throwFont } from '../../theme/throwTokens';
import type { ThrowFriend } from '../../types/throw';

const ITEM_SPACING = 92;

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
              <Pressable onPress={() => snapTo(i)} hitSlop={8}>
                <FriendAvatar userId={f.userId} name={f.name} avatarUrl={f.avatarUrl} size={52} style={isSelected && styles.avatarSelected} />
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
  wrap: { height: 108, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  strip: { width: ITEM_SPACING, height: 108, alignItems: 'center', justifyContent: 'center' },
  item: { position: 'absolute', width: ITEM_SPACING, alignItems: 'center' },
  avatarSelected: { borderWidth: 2, borderColor: throwColor.clay },
  name: { marginTop: 6, fontFamily: throwFont.ui600, fontSize: 12.5, color: throwColor.inkMute },
  nameSelected: { color: throwColor.ink, fontFamily: throwFont.ui700 },
  city: { fontFamily: throwFont.ui400, fontSize: 10.5, color: throwColor.inkFaint, marginTop: 1 },
});
