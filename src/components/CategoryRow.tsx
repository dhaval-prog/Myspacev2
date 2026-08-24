import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography, EASE, duration } from '../theme';

interface CategoryRowProps {
  count: string;
  label: string;
  active: boolean;
  onPress: () => void;
  reduceMotion?: boolean;
  /** Gated until its prerequisite data exists (e.g. Add Items before any room). */
  locked?: boolean;
}

/**
 * One editorial navigation row: circular count badge, large label, arrow.
 * Press feedback nudges the arrow right and lifts the badge slightly —
 * quiet, not bouncy. A locked row renders inert and doesn't animate.
 */
export function CategoryRow({ count, label, active, onPress, reduceMotion, locked }: CategoryRowProps) {
  const arrowX = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;

  const animateTo = (arrow: number, scale: number, dur: number) => {
    if (locked) return;
    Animated.parallel([
      Animated.timing(arrowX, { toValue: arrow, duration: reduceMotion ? 0 : dur, easing: EASE, useNativeDriver: true }),
      Animated.timing(badgeScale, { toValue: scale, duration: reduceMotion ? 0 : dur, easing: EASE, useNativeDriver: true }),
    ]).start();
  };

  const fg = locked ? colors.textLocked : active ? colors.textPrimary : colors.textDisabled;

  return (
    <Pressable
      onPress={locked ? undefined : onPress}
      onPressIn={() => animateTo(5, 1.08, duration.micro)}
      onPressOut={() => animateTo(0, 1, duration.state)}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: locked }}
      accessibilityLabel={
        locked ? `${label}, locked` : count === '+' ? `${label}, add new` : `${label}, ${count} items`
      }
      style={({ pressed }) => [styles.row, pressed && !locked && styles.rowPressed]}
    >
      <Animated.View
        style={[
          styles.badge,
          {
            backgroundColor: locked ? colors.badgeLockedBg : active ? colors.ink : colors.badgeInactiveBg,
            transform: [{ scale: badgeScale }],
          },
        ]}
      >
        <Text
          style={[
            typography.monoBadge,
            { color: locked ? colors.badgeLockedFg : active ? colors.lime : colors.badgeInactiveFg },
          ]}
        >
          {count}
        </Text>
      </Animated.View>

      <Text
        style={[
          active && !locked ? typography.categoryLabelActive : typography.categoryLabelInactive,
          styles.label,
          { color: fg },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>

      <Animated.Text style={[styles.arrow, { color: fg, transform: [{ translateX: arrowX }] }]}>›</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.huge,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    minHeight: 44,
  },
  rowPressed: {
    backgroundColor: colors.pressWash,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    flex: 1,
  },
  arrow: {
    fontSize: 18,
    flexShrink: 0,
  },
});
