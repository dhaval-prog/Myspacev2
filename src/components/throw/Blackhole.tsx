import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { throwColor, throwNightColor } from '../../theme/throwTokens';

// react-native-svg's own .d.ts/.web.d.ts split (same class of issue as expo-video's, documented at
// length on StoryTrimScreen/VideoView elsewhere in Throw) declares the web variant of `Defs`
// without a children prop at all, even though it always accepts/renders children at runtime (an
// SVG <defs> element with no children would be pointless) — a package typing gap, not a real
// mismatch, hence the cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DefsAny = Defs as any;

const GLOW_SIZE = 72;
const CORE_SIZE = 40;
const PARTICLE_COUNT = 4;
const PARTICLE_RADIUS = 15;
const ORBIT_DURATION_MS = 3200;
const PULSE_DURATION_MS = 420;

interface BlackholeProps {
  isNight?: boolean;
  /** Bumped by the parent (see ContactStoryStack) each time a story card is fully consumed —
   * triggers one extra "absorb" flash layered on top of the vortex's own continuous idle motion,
   * so it visibly reacts at the moment a card disappears into it instead of just sitting there
   * looping the same way regardless of what's happening around it. */
  pulseSignal?: number;
}

/**
 * The small, quiet vortex a flicked-away story card flies into (see ContactStoryStack) — an SVG
 * radial-gradient glow + core (react-native-svg is already a dependency, via Icon.tsx elsewhere in
 * Throw) plus a few small particles drifting inward, all built as a continuous ambient loop rather
 * than something that only exists mid-gesture. Deliberately tiny per explicit request — this reads
 * as secondary to the actual story/contact card, never as its own centerpiece.
 */
export function Blackhole({ isNight, pulseSignal = 0 }: BlackholeProps) {
  const spin = useRef(new Animated.Value(0)).current;
  const particlePhase = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const accent = isNight ? throwNightColor.ink : throwColor.activeBlue;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: ORBIT_DURATION_MS, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(particlePhase, { toValue: 1, duration: ORBIT_DURATION_MS * 0.85, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [particlePhase]);

  // pulseSignal starts at 0 and this only reacts to a genuine change, so mounting never fires an
  // unearned flash before anything's actually been consumed.
  const mountedSignalRef = useRef(pulseSignal);
  useEffect(() => {
    if (pulseSignal === mountedSignalRef.current) return;
    mountedSignalRef.current = pulseSignal;
    pulse.setValue(0);
    Animated.timing(pulse, { toValue: 1, duration: PULSE_DURATION_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [pulseSignal, pulse]);

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 1.4, 1] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.55, 1, 0.55] });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.centered, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]}>
        <Svg width={GLOW_SIZE} height={GLOW_SIZE} viewBox={`0 0 ${GLOW_SIZE} ${GLOW_SIZE}`}>
          <DefsAny>
            <RadialGradient id="blackholeGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={accent} stopOpacity={0.45} />
              <Stop offset="55%" stopColor="#08080D" stopOpacity={0.32} />
              <Stop offset="100%" stopColor="#08080D" stopOpacity={0} />
            </RadialGradient>
          </DefsAny>
          <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill="url(#blackholeGlow)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.centered, { transform: [{ rotate: spinDeg }] }]}>
        <Svg width={CORE_SIZE} height={CORE_SIZE} viewBox={`0 0 ${CORE_SIZE} ${CORE_SIZE}`}>
          <DefsAny>
            <RadialGradient id="blackholeCore" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#000000" stopOpacity={1} />
              <Stop offset="70%" stopColor="#0D0D14" stopOpacity={0.96} />
              <Stop offset="100%" stopColor={accent} stopOpacity={0.4} />
            </RadialGradient>
          </DefsAny>
          <Circle cx={CORE_SIZE / 2} cy={CORE_SIZE / 2} r={CORE_SIZE / 2 - 1} fill="url(#blackholeCore)" stroke={accent} strokeOpacity={0.45} strokeWidth={1} />
        </Svg>
      </Animated.View>

      <View style={styles.centered}>
        {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
          const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
          const dx = Math.cos(angle) * PARTICLE_RADIUS;
          const dy = Math.sin(angle) * PARTICLE_RADIUS;
          return (
            <Animated.View
              key={i}
              style={[
                styles.particle,
                { backgroundColor: accent },
                {
                  opacity: particlePhase.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0.85, 0.4, 0] }),
                  transform: [
                    { translateX: particlePhase.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) },
                    { translateY: particlePhase.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) },
                    { scale: particlePhase.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }) },
                  ],
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: GLOW_SIZE, height: GLOW_SIZE, alignItems: 'center', justifyContent: 'center' },
  centered: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  particle: { position: 'absolute', width: 4, height: 4, borderRadius: 2 },
});
