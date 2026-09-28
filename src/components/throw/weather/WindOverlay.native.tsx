import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { generateWindParticles } from './windParticles';
import type { WeatherIntensity, WeatherQuality } from '../../../types/weather';

const PRESENCE_DURATION_MS = 1600;
// How long a particle takes to cross the whole screen width at windSpeedKph = BASE_SPEED_KPH — a
// stronger wind shortens this (see the duration calc below), a weaker one lengthens it.
const BASE_CROSSING_MS = 5200;
const BASE_SPEED_KPH = 20;
const SWAY_CYCLES = 1.6;
const SINE_LUT_INPUT = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
const SINE_LUT_OUTPUT = SINE_LUT_INPUT.map((t) => Math.sin(t * Math.PI * 2));
const WIND_PARTICLE_COLOR = 'rgba(226,222,204,0.85)';

interface WindOverlayProps {
  active: boolean;
  intensity: WeatherIntensity;
  quality?: WeatherQuality;
  /** km/h — how fast particles cross the screen (see BASE_SPEED_KPH/BASE_CROSSING_MS). */
  windSpeedKph: number;
  /** Degrees, meteorological "wind is blowing FROM" convention (matches NormalizedWeather's own
   * windDirectionDeg) — converted here to "blowing toward" to decide left-to-right vs right-to-left. */
  windDirectionDeg: number;
}

/**
 * Small leaf/dust-like flecks drifting across the screen in the wind's own direction — sparse by
 * design (this is meant to read as "there's a breeze," not a dense atmospheric layer), driven by
 * one shared `Animated.loop` clock (native driver) the same way RainOverlay's own layers are, with
 * each particle's own phase/sway/rotation offsetting that single clock instead of needing its own
 * timer (see windParticles.ts).
 */
export function WindOverlay({ active, intensity, quality = 'medium', windSpeedKph, windDirectionDeg }: WindOverlayProps) {
  const [size, setSize] = useState<{ width: number; height: number }>(() => Dimensions.get('window'));
  const particles = useMemo(() => generateWindParticles(quality, intensity), [quality, intensity]);

  const presence = useRef(new Animated.Value(0)).current;
  const clock = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Animated.timing(presence, {
      toValue: active ? 1 : 0,
      duration: PRESENCE_DURATION_MS,
      easing: active ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, presence]);

  // A calmer breeze still moves (never fully stalls) — clamped to a sane floor/ceiling so a wildly
  // large/small reading can't make the crossing instant or glacial.
  const speedKph = Math.max(4, windSpeedKph || BASE_SPEED_KPH);
  useEffect(() => {
    clock.setValue(0);
    const duration = Math.max(1400, BASE_CROSSING_MS * (BASE_SPEED_KPH / speedKph));
    const loop = Animated.loop(Animated.timing(clock, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
    loopRef.current = loop;
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedKph]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loopRef.current?.start();
      else loopRef.current?.stop();
    });
    return () => sub.remove();
  }, []);

  // Meteorological "from" → "toward" (+180°), then just the horizontal component decides which
  // side particles enter/exit from — a mostly-horizontal sweep reads far more clearly as "wind"
  // than trying to visualize the exact compass bearing.
  const towardRad = ((windDirectionDeg + 180) * Math.PI) / 180;
  const goingRight = Math.sin(towardRad) >= 0;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {particles.map((p, i) => {
        const travel = size.width + 80;
        const progress = Animated.modulo(Animated.add(Animated.multiply(clock, p.speedFactor), p.phase), 1);
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: goingRight ? [-40, travel - 40] : [travel - 40, -40],
        });
        const swayCycle = Animated.modulo(Animated.add(Animated.multiply(progress, SWAY_CYCLES), p.swayPhase), 1);
        const sway = Animated.multiply(
          swayCycle.interpolate({ inputRange: SINE_LUT_INPUT, outputRange: SINE_LUT_OUTPUT, extrapolate: 'clamp' }),
          p.swayAmplitude,
        );
        const translateY = Animated.add(p.y * size.height, sway);
        const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotationDeg}deg`] });
        // Fades in/out right at each edge of the crossing, on top of the overall presence ramp, so
        // particles never visibly pop into or out of existence mid-screen.
        const edgeOpacity = progress.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
        const revealFrom = Math.min(p.revealAt, 0.85);
        const revealOpacity = presence.interpolate({ inputRange: [revealFrom, revealFrom + 0.15, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: p.size * 1.8,
              height: p.size * 0.7,
              borderRadius: p.size * 0.35,
              backgroundColor: WIND_PARTICLE_COLOR,
              opacity: Animated.multiply(Animated.multiply(revealOpacity, edgeOpacity), p.opacity),
              transform: [{ translateX }, { translateY }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}
