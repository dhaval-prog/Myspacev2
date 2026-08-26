import React from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, fontFamily, radius } from '../theme';

function initialsFor(fullName?: string | null, email?: string | null): string {
  const name = fullName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  }
  const local = email?.split('@')[0]?.trim();
  if (local) return local.slice(0, 2).toUpperCase();
  return '••';
}

interface AccountBadgeProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Overrides the default lavender fill — each section tints this to match its own "+" accent. */
  bg?: string;
  /** Overrides the default ink initials color, paired with `bg`. */
  tint?: string;
}

/** Rounded-square initials badge — the account entry point on Home, Expenses, and Split. */
export function AccountBadge({ onPress, style, bg, tint }: AccountBadgeProps) {
  const { user } = useAuth();
  const initials = initialsFor(user?.user_metadata?.full_name as string | undefined, user?.email);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Account"
      hitSlop={4}
      style={({ pressed }) => [styles.badge, bg ? { backgroundColor: bg } : null, pressed && styles.pressed, style]}
    >
      <Text style={[styles.initials, tint ? { color: tint } : null]}>{initials}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.splitAccentSoftBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.85,
  },
  initials: {
    fontFamily: fontFamily.sans700,
    fontSize: 14,
    letterSpacing: 0.2,
    color: colors.splitInk,
  },
});
