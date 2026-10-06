import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { fmColor } from '../../../theme/friendsMapTokens';

/** The viewer's own pulsing blue dot — no positioning of its own, same split as
 * `FriendsMapPinGlyph`. */
export function FriendsMapMeGlyph({ scale, reduceMotion }: { scale: number; reduceMotion: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.timing(progress, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion]);

  const haloSize = 36 * scale;
  const dotSize = 18 * scale;
  const scaleValue = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.9] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={{ width: dotSize, height: dotSize, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          { width: haloSize, height: haloSize, borderRadius: haloSize / 2 },
          reduceMotion ? { opacity: 0.35 } : { transform: [{ scale: scaleValue }], opacity },
        ]}
      />
      <View style={[styles.dot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2, borderWidth: Math.max(1, 3 * scale) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { position: 'absolute', backgroundColor: 'rgba(47,107,255,0.35)' },
  dot: { backgroundColor: fmColor.meBlue, borderColor: fmColor.white, shadowColor: fmColor.ink, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6 },
});
