import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// A full breathe cycle (dim → bright → dim) — slow and barely perceptible on purpose (per explicit
// request: "do not make the clear state completely static," but also "minimal animation").
const BREATHE_MS = 9000;
const MIN_OPACITY = 0.03;
const MAX_OPACITY = 0.09;

interface ClearOverlayProps {
  active: boolean;
}

/**
 * The clear-sky "do nothing" state, almost — a single soft warm-light gradient wash in the top
 * corner that very slowly breathes in and out, present specifically so 'clear' doesn't read as a
 * frozen screenshot next to every other weather condition's own movement, while staying far too
 * subtle to compete with the map/markers/plane for attention. No particles, no darkening.
 */
export function ClearOverlay({ active }: ClearOverlayProps) {
  const presence = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Animated.timing(presence, { toValue: active ? 1 : 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
  }, [active, presence]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: BREATHE_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: BREATHE_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loopRef.current = loop;
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  const opacity = Animated.multiply(presence, breathe.interpolate({ inputRange: [0, 1], outputRange: [MIN_OPACITY, MAX_OPACITY] }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[styles.wrap, { opacity }]}>
        <LinearGradient colors={['rgba(255,244,214,0.9)', 'rgba(255,244,214,0)']} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: -60, left: -60, width: '70%', height: '45%' },
});
