import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily } from '../../theme';

/** A rotating set of bright, high-contrast chip looks for member initials. */
const AVATAR_PALETTE: { bg: string; fg: string }[] = [
  { bg: '#FDE8EE', fg: '#FA2E6E' },
  { bg: '#E3EFD8', fg: '#2C6E68' },
  { bg: '#DCE7FF', fg: '#1B2A63' },
  { bg: '#FFE9C7', fg: '#B4661A' },
  { bg: '#EAE1FF', fg: '#5B3FBF' },
  { bg: '#D8F3EA', fg: '#12805F' },
];

function paletteFor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initialsOf(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || '??';
}

interface MemberAvatarProps {
  userId: string;
  name: string;
  size?: number;
  onPress?: () => void;
  selected?: boolean;
  style?: object;
}

/** Colored initials chip for a Split member — consistent across every Split screen. */
export function MemberAvatar({ userId, name, size = 40, onPress, selected, style }: MemberAvatarProps) {
  const skin = paletteFor(userId);
  const initials = initialsOf(name);
  const dim = { width: size, height: size, borderRadius: size / 2 };

  const content = (
    <View
      style={[
        styles.base,
        dim,
        { backgroundColor: skin.bg },
        selected !== undefined && { borderWidth: 2, borderColor: selected ? '#FA2E6E' : 'transparent' },
        style,
      ]}
    >
      <Text style={[styles.initials, { color: skin.fg, fontSize: Math.round(size * 0.36) }]}>{initials}</Text>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={name}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: fontFamily.sans700,
    letterSpacing: 0.2,
  },
});
