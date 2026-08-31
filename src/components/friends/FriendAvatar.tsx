import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontFamily } from '../../theme';
import { avatarSkinFor, initialsOf } from '../../utils/friendAvatar';

interface FriendAvatarProps {
  userId: string;
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Shows a green presence dot, bottom-right. */
  online?: boolean;
}

/** Lime/ice/coral initials circle shared by every Friends & chat screen. */
export function FriendAvatar({ userId, name, size = 44, style, online }: FriendAvatarProps) {
  const skin = avatarSkinFor(userId);
  const dim = { width: size, height: size, borderRadius: size / 2 };
  const dotSize = Math.max(10, Math.round(size * 0.3));
  return (
    <View
      style={[
        styles.base,
        dim,
        { backgroundColor: skin.bg },
        skin.border ? { borderWidth: 1, borderColor: skin.border } : null,
        style,
      ]}
    >
      <Text style={[styles.initials, { color: skin.fg, fontSize: Math.round(size * 0.34) }]}>{initialsOf(name)}</Text>
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
