import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
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

/** Rounded-square badge — the account entry point on Home, Expenses, and Split. Shows the profile photo once one is set, else initials. */
export function AccountBadge({ onPress, style, bg, tint }: AccountBadgeProps) {
  const { user } = useAuth();
  const initials = initialsFor(user?.user_metadata?.full_name as string | undefined, user?.email);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) {
      setAvatarUrl(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) setAvatarUrl((data as { avatar_url: string | null } | null)?.avatar_url ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Account"
      hitSlop={4}
      style={({ pressed }) => [styles.badge, bg ? { backgroundColor: bg } : null, pressed && styles.pressed, style]}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.photo} />
      ) : (
        <Text style={[styles.initials, tint ? { color: tint } : null]}>{initials}</Text>
      )}
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
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  initials: {
    fontFamily: fontFamily.sans700,
    fontSize: 14,
    letterSpacing: 0.2,
    color: colors.splitInk,
  },
});
