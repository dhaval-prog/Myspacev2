import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography, EASE, duration } from '../theme';

interface CategoryRowProps {
  count: string;
  label: string;
  active: boolean;
  onPress: () => void;
  reduceMotion?: boolean;
}

/**
 * One editorial navigation row: circular count badge, large label, arrow.
 * Press feedback nudges the arrow right and lifts the badge slightly —
 * quiet, not bouncy.
 */
export function CategoryRow({ count, label, active, onPress, reduceMotion }: CategoryRowProps) {
  const arrowX = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;

  const animateTo = (arrow: number, scale: number, dur: number) => {
    Animated.parallel([
      Animated.timing(arrowX, { toValue: arrow, duration: reduceMotion ? 0 : dur, easing: EASE, useNativeDriver: true }),
      Animated.timing(badgeScale, { toValue: scale, duration: reduceMotion ? 0 : dur, easing: EASE, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(5, 1.08, duration.micro)}
      onPressOut={() => animateTo(0, 1, duration.state)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={count === '+' ? `${label}, add new` : `${label}, ${count} items`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Animated.View
        style={[
          styles.badge,
          {
            backgroundColor: active ? colors.ink : colors.badgeInactiveBg,
            transform: [{ scale: badgeScale }],
          },
        ]}
      >
        <Text style={[typography.monoBadge, { color: active ? colors.lime : colors.badgeInactiveFg }]}>
          {count}
        </Text>
      </Animated.View>

      <Text
        style={[active ? typography.categoryLabelActive : typography.categoryLabelInactive, styles.label]}
        numberOfLines={1}
      >
        {label}
      </Text>

      <Animated.Text
        style={[
          styles.arrow,
          { color: active ? colors.textPrimary : colors.textDisabled, transform: [{ translateX: arrowX }] },
        ]}
      >
        ›
      </Animated.Text>
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
