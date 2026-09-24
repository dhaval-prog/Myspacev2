import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { colors, radius, spacing, typography, EASE, duration } from '../theme';
import { Icon } from './Icon';

interface CategoryRowProps {
  count: string;
  label: string;
  active: boolean;
  onPress: () => void;
  reduceMotion?: boolean;
  /** Gated until its prerequisite data exists (e.g. Add Items before any room). */
  locked?: boolean;
  /** Overrides the badge's count text with an icon. */
  icon?: string;
  /**
   * Renders as a standalone frosted-glass card (soft lime/gold blobs blurred
   * behind a translucent white surface) instead of a plain bordered list row —
   * used to make a row (Orbit, Games) stand out from the flat editorial list
   * around it.
   */
  glass?: boolean;
}

// react-native-svg's web typings omit `children` on Defs (a typing gap, not a runtime issue) — cast once.
const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;

/** Soft color blobs behind a glass row — the thing the blur actually diffuses. */
function CategoryGlassBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 200 100" preserveAspectRatio="none">
        <DefsAny>
          <RadialGradient id="orbitLime" cx="18%" cy="25%" r="75%">
            <Stop offset="0%" stopColor={colors.lime} stopOpacity={0.6} />
            <Stop offset="100%" stopColor={colors.lime} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="orbitGold" cx="88%" cy="80%" r="75%">
            <Stop offset="0%" stopColor="#FFD873" stopOpacity={0.5} />
            <Stop offset="100%" stopColor="#FFD873" stopOpacity={0} />
          </RadialGradient>
        </DefsAny>
        <Rect x={0} y={0} width={200} height={100} fill="url(#orbitLime)" />
        <Rect x={0} y={0} width={200} height={100} fill="url(#orbitGold)" />
      </Svg>
    </View>
  );
}

/**
 * One editorial navigation row: circular count badge, large label, arrow.
 * Press feedback nudges the arrow right and lifts the badge slightly —
 * quiet, not bouncy. A locked row renders inert and doesn't animate.
 */
export function CategoryRow({ count, label, active, onPress, reduceMotion, locked, icon, glass }: CategoryRowProps) {
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

  const badge = (
    <Animated.View
      style={[
        styles.badge,
        {
          backgroundColor: locked ? colors.badgeLockedBg : active ? colors.ink : colors.badgeInactiveBg,
          transform: [{ scale: badgeScale }],
        },
      ]}
    >
      {icon ? (
        <Icon
          path={icon}
          color={locked ? colors.badgeLockedFg : active ? colors.lime : colors.badgeInactiveFg}
          size={15}
          strokeWidth={1.9}
        />
      ) : (
        <Text
          style={[
            typography.monoBadge,
            { color: locked ? colors.badgeLockedFg : active ? colors.lime : colors.badgeInactiveFg },
          ]}
        >
          {count}
        </Text>
      )}
    </Animated.View>
  );

  const labelText = (
    <Text
      style={[
        active && !locked ? typography.categoryLabelActive : typography.categoryLabelInactive,
        styles.label,
        { color: glass ? '#212121' : fg },
      ]}
      numberOfLines={1}
    >
      {label}
    </Text>
  );

  const arrow = <Animated.Text style={[styles.arrow, { color: fg, transform: [{ translateX: arrowX }] }]}>›</Animated.Text>;

  if (glass) {
    return (
      <Pressable
        onPress={locked ? undefined : onPress}
        onPressIn={() => animateTo(5, 1.08, duration.micro)}
        onPressOut={() => animateTo(0, 1, duration.state)}
        accessibilityRole="button"
        accessibilityState={{ selected: active, disabled: locked }}
        accessibilityLabel={
          locked ? `${label}, locked` : icon ? label : count === '+' ? `${label}, add new` : `${label}, ${count} items`
        }
        style={({ pressed }) => [styles.glassCard, pressed && !locked && styles.glassCardPressed]}
      >
        <CategoryGlassBackdrop />
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={styles.glassTint} pointerEvents="none" />
        <View style={styles.row}>
          {badge}
          {labelText}
          {arrow}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={locked ? undefined : onPress}
      onPressIn={() => animateTo(5, 1.08, duration.micro)}
      onPressOut={() => animateTo(0, 1, duration.state)}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: locked }}
      accessibilityLabel={
        locked ? `${label}, locked` : icon ? label : count === '+' ? `${label}, add new` : `${label}, ${count} items`
      }
      style={({ pressed }) => [styles.row, styles.rowBordered, pressed && !locked && styles.rowPressed]}
    >
      {badge}
      {labelText}
      {arrow}
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
    minHeight: 44,
  },
  rowBordered: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowPressed: {
    backgroundColor: colors.pressWash,
  },
  glassCard: {
    marginHorizontal: spacing.huge,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: colors.lime,
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 6,
  },
  glassCardPressed: {
    opacity: 0.92,
  },
  glassTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.38)',
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
