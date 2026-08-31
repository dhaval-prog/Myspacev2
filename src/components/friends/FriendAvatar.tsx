import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontFamily } from '../../theme';
import { avatarSkinFor, initialsOf } from '../../utils/friendAvatar';

interface FriendAvatarProps {
  userId: string;
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Shows a green presence dot, bottom-right. */
  online?: boolean;
  /** Profile photo URL — shown in place of the initials circle when present. */
  avatarUrl?: string | null;
}

/** Photo (once set), else a lime/ice/coral initials circle — shared by every Friends & chat screen. */
export function FriendAvatar({ userId, name, size = 44, style, online, avatarUrl }: FriendAvatarProps) {
  const skin = avatarSkinFor(userId);
  const dim = { width: size, height: size, borderRadius: size / 2 };
  const dotSize = Math.max(10, Math.round(size * 0.3));
  return (
    <View
      style={[
        styles.base,
        dim,
        avatarUrl ? styles.photoBase : { backgroundColor: skin.bg },
        skin.border ? { borderWidth: 1, borderColor: skin.border } : null,
        style,
      ]}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={dim} />
      ) : (
        <Text style={[styles.initials, { color: skin.fg, fontSize: Math.round(size * 0.34) }]}>{initialsOf(name)}</Text>
      )}
      {online ? (
        <View
          style={[
            styles.onlineDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              borderWidth: Math.max(2, Math.round(dotSize * 0.18)),
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBase: {
    overflow: 'hidden',
    backgroundColor: '#E9EAFB',
  },
  initials: {
    fontFamily: fontFamily.sans700,
    letterSpacing: 0.2,
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    backgroundColor: colors.onlineDot,
    borderColor: '#fff',
  },
});
