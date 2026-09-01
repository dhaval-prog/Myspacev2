import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontFamily } from '../../theme';
import { avatarSkinFor, initialsOf, type AvatarSkin } from '../../utils/friendAvatar';

interface FriendAvatarProps {
  userId: string;
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Shows a green presence dot, bottom-right. */
  online?: boolean;
  /** Profile photo URL — shown in place of the initials circle when present. */
  avatarUrl?: string | null;
  /**
   * An outgoing/pending connection always renders as a flat ink-10 circle
   * with ink-55 initials — never the lime/mist/coral rotation, and never
   * that rotation just dimmed with opacity (which used to leave a pending
   * row showing a random faded color depending on the user's id).
   */
  pending?: boolean;
  /** Pixel-exact override for the initials size, when the default size-scaled formula isn't precise enough (e.g. two same-size overlapping avatars with intentionally different initial sizes). */
  initialsFontSize?: number;
  /**
   * Forces a specific fill/text color regardless of the userId hash-rotation
   * or `pending` — e.g. a chat thread header that's always lime, or a
   * locked-thread header that's always a flat on-ink chip with white text.
   */
  colorOverride?: { bg: string; fg: string };
  /**
   * Pixel-exact override for the presence dot, when the default size-scaled
   * formula (`online` alone) isn't precise enough — e.g. a fixed-size story
   * rail avatar wanting an exact dot size/ring regardless of avatar size.
   */
  onlineDotOverride?: { size: number; ringWidth: number; ringColor: string };
  /** Overrides the default perfect-circle radius (size/2) — e.g. a squircle avatar. */
  radius?: number;
  /** Overrides the default 700-weight initials font — e.g. an 800-weight hero avatar. */
  initialsFontFamily?: string;
}

/** Photo (once set), else a lime/ice/coral initials circle — shared by every Friends & chat screen. */
export function FriendAvatar({
  userId,
  name,
  size = 44,
  style,
  online,
  avatarUrl,
  pending,
  initialsFontSize,
  colorOverride,
  onlineDotOverride,
  radius,
  initialsFontFamily,
}: FriendAvatarProps) {
  const skin: AvatarSkin = colorOverride ?? (pending ? { bg: colors.ink10, fg: colors.ink55 } : avatarSkinFor(userId));
  const dim = { width: size, height: size, borderRadius: radius ?? size / 2 };
  const dotSize = onlineDotOverride?.size ?? Math.max(10, Math.round(size * 0.3));
  const dotRingWidth = onlineDotOverride?.ringWidth ?? Math.max(2, Math.round(dotSize * 0.18));
  const dotRingColor = onlineDotOverride?.ringColor ?? '#fff';
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
        <Text
          style={[
            styles.initials,
            {
              color: skin.fg,
              fontSize: initialsFontSize ?? Math.round(size * 0.34),
              fontFamily: initialsFontFamily ?? fontFamily.sans700,
            },
          ]}
        >
          {initialsOf(name)}
        </Text>
      )}
      {online ? (
        <View
          style={[
            styles.onlineDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              borderWidth: dotRingWidth,
              borderColor: dotRingColor,
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
