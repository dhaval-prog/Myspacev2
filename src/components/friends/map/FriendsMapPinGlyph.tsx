import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { fmColor, fmFont, fmLayout } from '../../../theme/friendsMapTokens';
import { FriendAvatar } from '../FriendAvatar';

/** A pulsing ring behind a live pin/the "me" dot — `Animated.loop`'d scale+fade, matching the
 * handoff's own `fmPing` keyframes (scale .8→1.9, opacity 1→0, looping). Reduced-motion shows a
 * single static ring instead of looping it forever. */
function PulseRing({ size, color, borderWidth, reduceMotion }: { size: number; color: string; borderWidth: number; reduceMotion: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion]);

  if (reduceMotion) {
    return <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, borderWidth, borderColor: color, opacity: 0.45 }]} />;
  }

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.9] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: size / 2, borderWidth, borderColor: color, transform: [{ scale }], opacity }]}
    />
  );
}

interface FriendsMapPinGlyphProps {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  live: boolean;
  selected: boolean;
  /** "LIVE" or an age like "2h" — only ever rendered when `showTag`. */
  agoLabel: string;
  showTag: boolean;
  scale: number;
  reduceMotion: boolean;
}

/** A single friend's pin content — no positioning of its own (see `FriendsMapPinAnchor`), same
 * glyph/position split as this codebase's existing `LocationPinGlyph`/`LocationPin`. Ported
 * visually from the handoff's own pin states (default/live/selected + name tag). */
export function FriendsMapPinGlyph({ userId, name, avatarUrl, live, selected, agoLabel, showTag, scale, reduceMotion }: FriendsMapPinGlyphProps) {
  const size = Math.round((selected ? fmLayout.pinSelectedSize : fmLayout.pinDefaultSize) * scale);
  const borderWidth = Math.max(1, Math.round((selected ? 4 : 3) * scale));
  const tailColor = selected ? fmColor.ink : fmColor.white;
  const tagBg = selected ? fmColor.ink : fmColor.white;
  const tagFg = selected ? fmColor.white : fmColor.ink;
  const dotSize = Math.round(fmLayout.pinLiveDotSize * scale);

  return (
    <View style={styles.col}>
      <View style={{ width: size, height: size }}>
        {live && <PulseRing size={size + 8 * scale} color={fmColor.lime} borderWidth={Math.max(1, Math.round(3 * scale))} reduceMotion={reduceMotion} />}
        <View
          style={[
            styles.avatarRing,
            { width: size, height: size, borderRadius: size / 2, borderWidth, borderColor: selected ? fmColor.ink : fmColor.white, opacity: live || selected ? 1 : 0.82 },
          ]}
        >
          <FriendAvatar userId={userId} name={name} avatarUrl={avatarUrl} size={size - borderWidth * 2} initialsFontSize={Math.round((selected ? 17 : 13) * scale)} />
        </View>
        {live && (
          <View
            style={[
              styles.liveDot,
              { width: dotSize, height: dotSize, borderRadius: dotSize / 2, borderWidth: Math.max(1, Math.round(2.5 * scale)) },
            ]}
          />
        )}
      </View>
      <View style={[styles.tail, { width: 10 * scale, height: 10 * scale, backgroundColor: tailColor, marginTop: -6 * scale }]} />
      {showTag && (
        <View style={[styles.tag, { backgroundColor: tagBg, height: 20 * scale, borderRadius: 10 * scale, paddingHorizontal: 8 * scale, marginTop: 3 * scale }]}>
          <Text style={[styles.tagName, { color: tagFg, fontSize: 11 * scale }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.tagAgo, { color: tagFg, fontSize: 9.5 * scale }]}>{agoLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  col: { alignItems: 'center' },
  avatarRing: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: fmColor.white,
    shadowColor: fmColor.ink,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
  },
  liveDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    backgroundColor: fmColor.lime,
    borderColor: fmColor.white,
  },
  tail: { transform: [{ rotate: '45deg' }], borderRadius: 2 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, shadowColor: fmColor.ink, shadowOpacity: 0.12, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8 },
  tagName: { fontFamily: fmFont.ui600 },
  tagAgo: { fontFamily: fmFont.mono500, opacity: 0.7 },
});
