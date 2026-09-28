import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { generateRainParticles, RAIN_LAYER_SPEED_MULTIPLIER } from './rainParticles';
import type { WindController } from './windController';
import type { RainConfig, WeatherIntensity, WeatherQuality } from '../../../types/weather';

// How long the fastest layer takes to fall the whole height of the screen at speed multiplier 1 —
// every layer's own actual loop duration is this divided by its own RAIN_LAYER_SPEED_MULTIPLIER
// (and RainConfig.speed, if overridden), so layers fall at visibly different paces from one shared
// base rather than needing three independent numbers to keep in sync.
const BASE_LOOP_MS = 2400;
// The rain's own default lean off vertical, and how much a caller's own RainConfig.opacity/speed
// multiply the per-particle base values by, when neither is given.
const DEFAULT_ANGLE_DEG = 8;
// How long the 0%→100% (and reverse) start/stop transition takes — see this component's own doc
// comment; comfortably inside the feature request's "approximately 1–2 seconds".
const PRESENCE_DURATION_MS = 1400;
// A cool, slightly desaturated blue-white — reads as "wet atmosphere" without tinting the map's own
// colors underneath it (see the atmosphere wash further down for that separate, much subtler tint).
const RAIN_DROP_COLOR = 'rgba(214,226,240,0.95)';
// Very subtle — enhances the map (per explicit request) rather than dramatically restyling it; a
// real Mapbox/react-native-maps style change is deliberately not attempted here (see this file's
// own module doc comment).
const ATMOSPHERE_COLOR = 'rgba(18,26,38,1)';
const ATMOSPHERE_MAX_OPACITY = 0.12;
// Extra lean (degrees) at a gust's absolute peak — additive on top of config.angle's own steady
// lean, and ONLY on top of the *rotate* transform (never touching the fall clocks/translateY, which
// is what actually drives fall speed) — the deliberate, scoped way this feature's own live wind
// connects to already-implemented rain without risking the "snap to top" glitch a live-varying
// clock duration would cause (see this file's own module doc + the WindController it subscribes to).
const GUST_LEAN_SCALE_DEG = 14;

interface RainOverlayProps {
  /** Whether rain should currently be showing — flipping this plays the start/stop density ramp
   * (see PRESENCE_DURATION_MS) rather than an instant on/off. */
  active: boolean;
  intensity: WeatherIntensity;
  /** Defaults to a mid-range tier — native's real GPU/UI-thread compositing (see this file's own
   * module doc comment on why no Skia/canvas is needed here) comfortably affords more, but this
   * stays conservative until there's an actual reason to raise it per device. */
  quality?: WeatherQuality;
  config?: Partial<RainConfig>;
  /** Optional — when given, a gust nudges rain's own lean angle a little more diagonal for the
   * gust's duration (see GUST_LEAN_SCALE_DEG). Omit to keep rain wind-independent. */
  windController?: WindController;
}

/**
 * Rain rendered as plain `Animated.View` streaks — no Skia/canvas needed: everything that actually
 * changes every frame (each particle's translateX/translateY/opacity) is a `useNativeDriver: true`
 * Animated interpolation of one of just three shared, looping "clock" values (one per depth layer,
 * see RAIN_LAYER_SPEED_MULTIPLIER), so the real per-frame work happens entirely on the native
 * UI thread — React never re-renders to animate a single drop, only ever to change *how many*
 * particles exist (intensity/quality) or start/stop the presence ramp. `Animated.modulo` is what
 * lets many particles share one clock at different phases without each needing its own timer (see
 * rainParticles.ts's own `phase` field).
 *
 * Screen-space only (see this feature's own architecture notes) — nothing here is a map marker or
 * attached to a lat/lng, so panning/zooming/rotating the map underneath never touches this at all;
 * it just keeps falling across whatever's currently on screen.
 */
export function RainOverlay({ active, intensity, quality = 'medium', config, windController }: RainOverlayProps) {
  const [size, setSize] = useState<{ width: number; height: number }>(() => Dimensions.get('window'));
  const particles = useMemo(() => generateRainParticles(quality, intensity), [quality, intensity]);

  const presence = useRef(new Animated.Value(0)).current;
  const clocks = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const loopsRef = useRef<Animated.CompositeAnimation[]>([]);
  const gustLean = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!windController) return;
    return windController.subscribe((wind) => {
      const towardRad = (wind.directionDeg * Math.PI) / 180;
      const horizontal = Math.sin(towardRad);
      gustLean.setValue(horizontal * (wind.gustFactor - 1) * GUST_LEAN_SCALE_DEG);
    });
  }, [windController, gustLean]);

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
      const duration = BASE_LOOP_MS / (RAIN_LAYER_SPEED_MULTIPLIER[i] * Math.max(0.05, speed));
      return Animated.loop(Animated.timing(clock, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
    });
    loopsRef.current = loops;
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  // Pauses the falling animation while the app is backgrounded (per explicit request) — the
  // presence/opacity ramp is left alone, so rain simply resumes exactly where it looked when the
  // app returns rather than replaying its own start transition.
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
  // Rotate-only — the fall path itself (translateX/translateY above) stays keyed to the steady
  // config.angle so a gust never touches position/speed math, only how visually diagonal each drop
  // looks for the gust's own duration.
  const rotateDeg = Animated.add(gustLean, angleDeg).interpolate({
    inputRange: [-90, 90],
    outputRange: ['-90deg', '90deg'],
    extrapolate: 'clamp',
  });

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: ATMOSPHERE_COLOR, opacity: Animated.multiply(presence, ATMOSPHERE_MAX_OPACITY) }]}
      />
      {particles.map((p, i) => {
        const clock = clocks[p.layer];
        const travel = size.height + p.length * 2;
        const progress = Animated.modulo(Animated.add(clock, p.phase), 1);
        const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-p.length, size.height + p.length] });
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, travel * angleTan] });
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
              width: p.thickness,
              height: p.length,
              borderRadius: p.thickness / 2,
              backgroundColor: RAIN_DROP_COLOR,
              opacity: Animated.multiply(revealOpacity, p.opacity * opacityMultiplier),
              transform: [{ translateX }, { translateY }, { rotate: rotateDeg }],
            }}
          />
        );
      })}
    </View>
  );
}
