import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { generateFallingParticles, type ParticleTuning } from './weatherParticles';
import type { RainConfig, WeatherIntensity, WeatherQuality } from '../../../types/weather';

const BASE_LOOP_MS = 5200;
const DEFAULT_ANGLE_DEG = 4;
const PRESENCE_DURATION_MS = 1600;
const SNOW_COLOR = 'rgba(255,255,255,0.95)';
// Snowflakes drift sideways as they fall (per explicit request, "avoid making the snow look like
// white dots simply moving downward") — a full left-right-left wobble happens this many times over
// one fall loop, amplitude scaled per-particle in weatherParticles.ts's own swayAmplitude.
const SWAY_CYCLES_PER_FALL = 2.2;
// A one-cycle sine lookup table, approximated with evenly-spaced points — RN Animated has no sin()
// of its own, so this is interpolated the same way any other curve here is.
const SINE_LUT_INPUT = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
const SINE_LUT_OUTPUT = SINE_LUT_INPUT.map((t) => Math.sin(t * Math.PI * 2));

const SNOW_TUNING: ParticleTuning = {
  layerSpeedMultiplier: [0.4, 0.6, 0.85],
  layerBaseOpacity: [0.45, 0.65, 0.9],
  // "length" doubles as a snowflake's own diameter (see the render below — snow draws circles, not
  // streaks), noticeably larger than a raindrop so it reads as soft flakes, not dots.
  layerBaseLength: [4, 6.5, 9.5],
  layerBaseThickness: [4, 6.5, 9.5],
  qualityLayerCounts: { high: [20, 16, 11], medium: [13, 10, 7], low: [6, 5, 3] },
  swayAmplitudeFactor: 3.2,
};

interface SnowOverlayProps {
  active: boolean;
  intensity: WeatherIntensity;
  quality?: WeatherQuality;
  config?: Partial<RainConfig>;
}

/**
 * Snow rendered as plain `Animated.View` circles — same shared-clock/Animated.modulo architecture
 * RainOverlay uses (see its own doc comment for the full reasoning), just with snow's own tuning
 * (slower, bigger, fewer, whiter) plus a sideways sway on top of the usual diagonal drift, and a
 * soft "accumulation" wash along the bottom edge that builds with the same presence ramp everything
 * else here uses, rather than simulating literal pixel accumulation.
 */
export function SnowOverlay({ active, intensity, quality = 'medium', config }: SnowOverlayProps) {
  const [size, setSize] = useState<{ width: number; height: number }>(() => Dimensions.get('window'));
  const particles = useMemo(() => generateFallingParticles(quality, intensity, SNOW_TUNING), [quality, intensity]);

  const presence = useRef(new Animated.Value(0)).current;
  const clocks = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const loopsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    Animated.timing(presence, {
      toValue: active ? 1 : 0,
      duration: PRESENCE_DURATION_MS,
      easing: active ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, presence]);

  const speed = config?.speed ?? 1;
  useEffect(() => {
    const loops = clocks.map((clock, i) => {
      clock.setValue(0);
      const duration = BASE_LOOP_MS / (SNOW_TUNING.layerSpeedMultiplier[i] * Math.max(0.05, speed));
      return Animated.loop(Animated.timing(clock, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
    });
    loopsRef.current = loops;
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loopsRef.current.forEach((l) => l.start());
      else loopsRef.current.forEach((l) => l.stop());
    });
    return () => sub.remove();
  }, []);

  const angleDeg = config?.angle ?? DEFAULT_ANGLE_DEG;
  const opacityMultiplier = config?.opacity ?? 1;
  const angleTan = Math.tan((angleDeg * Math.PI) / 180);

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {particles.map((p, i) => {
        const clock = clocks[p.layer];
        const travel = size.height + p.length * 2;
        const progress = Animated.modulo(Animated.add(clock, p.phase), 1);
        const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-p.length, size.height + p.length] });
        const driftX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, travel * angleTan] });
        const swayCycleProgress = Animated.modulo(Animated.add(Animated.multiply(progress, SWAY_CYCLES_PER_FALL), p.swayPhase), 1);
        const sway = Animated.multiply(
          swayCycleProgress.interpolate({ inputRange: SINE_LUT_INPUT, outputRange: SINE_LUT_OUTPUT, extrapolate: 'clamp' }),
          p.swayAmplitude,
        );
        const translateX = Animated.add(driftX, sway);
        const revealFrom = Math.min(p.revealAt, 0.85);
        const revealOpacity = presence.interpolate({ inputRange: [revealFrom, revealFrom + 0.15, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: p.x * size.width,
              top: 0,
              width: p.length,
              height: p.length,
              borderRadius: p.length / 2,
              backgroundColor: SNOW_COLOR,
              opacity: Animated.multiply(revealOpacity, p.opacity * opacityMultiplier),
              transform: [{ translateX }, { translateY }],
            }}
          />
        );
      })}

      <Animated.View pointerEvents="none" style={[styles.accumulationWrap, { opacity: presence }]}>
        <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)']} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  accumulationWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 },
});
