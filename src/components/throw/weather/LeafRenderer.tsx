import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { WindController, WindSample } from './windController';
import { LEAF_COLORS, LEAF_SHAPES } from './leafShapes';
import type { WeatherIntensity, WeatherQuality } from '../../../types/weather';

// km/h → px/s — tuned so a calm breeze reads as a lazy drift, not a dart across the screen (a
// 15km/h wind crosses roughly a phone-width screen in ~8-9s at the midground layer).
const WIND_TO_PX_PER_SEC = 3.2;
const VELOCITY_DAMPING_PER_SEC = 1.4; // how quickly a leaf's velocity catches up to the wind target
const TURBULENCE_RETARGET_MS = [500, 1200] as const;
const FADE_IN_MS = [350, 650] as const;
const FADE_OUT_MS = [450, 900] as const;
const LIFETIME_MS = [4500, 9000] as const;
const SPAWN_INTERVAL_MS = [800, 3000] as const;

// Depth layers, back to front — per explicit request: smaller/fainter/slower in back, larger/
// sharper/faster in front, which is what actually reads as depth rather than a flat particle plane.
const LAYER_CONFIG = [
  { sizeRange: [9, 14] as const, speedMult: 0.55, opacityMult: 0.55 },
  { sizeRange: [13, 19] as const, speedMult: 0.85, opacityMult: 0.78 },
  { sizeRange: [17, 25] as const, speedMult: 1.2, opacityMult: 1 },
];

const QUALITY_MAX_LEAVES: Record<WeatherQuality, number> = { high: 10, medium: 7, low: 4 };
const INTENSITY_MAX_FACTOR: Record<WeatherIntensity, number> = { light: 0.5, medium: 0.75, heavy: 1 };

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
function randomInRange([min, max]: readonly [number, number]): number {
  return randomBetween(min, max);
}

type LeafLifecycle = 'fadeIn' | 'flying' | 'fadeOut';

interface LeafState {
  shapeIndex: number;
  color: string;
  size: number;
  layer: 0 | 1 | 2;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  flutterPhase: number;
  flutterFreq: number;
  flutterAmp: number;
  turbulenceVx: number;
  turbulenceVy: number;
  turbulenceTargetVx: number;
  turbulenceTargetVy: number;
  msUntilTurbulenceRetarget: number;
  liftVelocity: number;
  ageMs: number;
  lifetimeMs: number;
  fadeInMs: number;
  fadeOutMs: number;
  lifecycle: LeafLifecycle;
  opacity: number;
}

interface LeafSlot {
  active: boolean;
  leaf: LeafState | null;
  translateX: Animated.Value;
  translateY: Animated.Value;
  rotate: Animated.Value;
  opacity: Animated.Value;
  shapeIndex: number;
  color: string;
  size: number;
}

function spawnLeaf(width: number, height: number, wind: WindSample): LeafState {
  const layer = (Math.random() < 0.34 ? 0 : Math.random() < 0.6 ? 1 : 2) as 0 | 1 | 2;
  const cfg = LAYER_CONFIG[layer];
  const towardRad = (wind.directionDeg * Math.PI) / 180;
  // Spawns just off whichever edge the wind is blowing FROM, so it visibly flies IN from outside
  // the frame rather than popping into view mid-screen.
  const fromLeft = Math.cos(towardRad) >= 0;
  const x = fromLeft ? -30 : width + 30;
  const y = randomBetween(height * 0.05, height * 0.75);
  const size = randomBetween(cfg.sizeRange[0], cfg.sizeRange[1]);
  return {
    shapeIndex: Math.floor(Math.random() * LEAF_SHAPES.length),
    color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
    size,
    layer,
    x,
    y,
    vx: 0,
    vy: 0,
    rotation: randomBetween(0, 360),
    rotationSpeed: randomBetween(-70, 70) * randomBetween(0.4, 1.6),
    flutterPhase: randomBetween(0, Math.PI * 2),
    flutterFreq: randomBetween(0.4, 1.1),
    flutterAmp: randomBetween(8, 22),
    turbulenceVx: 0,
    turbulenceVy: 0,
    turbulenceTargetVx: 0,
    turbulenceTargetVy: 0,
    msUntilTurbulenceRetarget: randomInRange(TURBULENCE_RETARGET_MS),
    liftVelocity: 0,
    ageMs: 0,
    lifetimeMs: randomInRange(LIFETIME_MS),
    fadeInMs: randomInRange(FADE_IN_MS),
    fadeOutMs: randomInRange(FADE_OUT_MS),
    lifecycle: 'fadeIn',
    opacity: 0,
  };
}

interface LeafRendererProps {
  active: boolean;
  intensity: WeatherIntensity;
  quality?: WeatherQuality;
  windController: WindController;
}

/**
 * Real per-leaf physics, not a shared clock with phase offsets (unlike RainOverlay/SnowOverlay's
 * particles, every leaf's own path is genuinely independent — driven by the shared WindController's
 * live sample plus its own turbulence/flutter/lift state — see this file's own tick()) — integrated
 * every frame via the controller's subscribe callback and pushed straight to a small, reused pool
 * of Animated.Values via `.setValue()` (see LeafSlot), never through React state, so a leaf's
 * continuous motion never causes a re-render. React state only changes on the much rarer spawn/
 * despawn cadence (seconds apart, not frames apart), when a slot's own `active` flips and its
 * (already-mounted, reused) Animated.View needs to actually appear/disappear.
 */
export function LeafRenderer({ active, intensity, quality = 'medium', windController }: LeafRendererProps) {
  const [size, setSize] = useState<{ width: number; height: number }>(() => Dimensions.get('window'));
  const [, forceRender] = useState(0);

  const maxLeaves = Math.max(1, Math.round(QUALITY_MAX_LEAVES[quality] * INTENSITY_MAX_FACTOR[intensity]));
  const slots = useMemo<LeafSlot[]>(
    () =>
      Array.from({ length: QUALITY_MAX_LEAVES.high }, () => ({
        active: false,
        leaf: null,
        translateX: new Animated.Value(-9999),
        translateY: new Animated.Value(-9999),
        rotate: new Animated.Value(0),
        opacity: new Animated.Value(0),
        shapeIndex: 0,
        color: LEAF_COLORS[0],
        size: 16,
      })),
    // Pool is sized to the highest quality tier once and reused for lower tiers (fewer of its
    // slots are ever activated) — recreating it on a live quality change isn't worth the churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const activeRef = useRef(active);
  activeRef.current = active;
  const maxLeavesRef = useRef(maxLeaves);
  maxLeavesRef.current = maxLeaves;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const msUntilSpawnRef = useRef(randomInRange(SPAWN_INTERVAL_MS));

  useEffect(() => {
    const unsubscribe = windController.subscribe((wind, dtMs) => {
      const dt = Math.min(0.25, dtMs / 1000);
      const { width, height } = sizeRef.current;

      // Spawn — randomized interval, only while active and under the current (intensity/quality-
      // scaled) density cap; never spawns while inactive, so leaves aren't still appearing after
      // the weather itself has faded out.
      if (activeRef.current) {
        msUntilSpawnRef.current -= dtMs;
        if (msUntilSpawnRef.current <= 0) {
          msUntilSpawnRef.current = randomInRange(SPAWN_INTERVAL_MS);
          const activeCount = slots.reduce((n, s) => n + (s.active ? 1 : 0), 0);
          const freeSlot = activeCount < maxLeavesRef.current ? slots.find((s) => !s.active) : undefined;
          if (freeSlot) {
            const leaf = spawnLeaf(width, height, wind);
            freeSlot.leaf = leaf;
            freeSlot.active = true;
            freeSlot.shapeIndex = leaf.shapeIndex;
            freeSlot.color = leaf.color;
            freeSlot.size = leaf.size;
            freeSlot.translateX.setValue(leaf.x);
            freeSlot.translateY.setValue(leaf.y);
            freeSlot.rotate.setValue(leaf.rotation);
            freeSlot.opacity.setValue(0);
            forceRender((n) => n + 1);
          }
        }
      }

      let anySlotChanged = false;
      for (const slot of slots) {
        if (!slot.active || !slot.leaf) continue;
        const leaf = slot.leaf;
        leaf.ageMs += dtMs;

        const cfg = LAYER_CONFIG[leaf.layer];
        const towardRad = (wind.directionDeg * Math.PI) / 180;
        const targetSpeedPxPerSec = wind.speedKph * WIND_TO_PX_PER_SEC * cfg.speedMult;
        const targetVx = Math.cos(towardRad) * targetSpeedPxPerSec;
        const targetVy = Math.sin(towardRad) * targetSpeedPxPerSec;

        // Turbulence — its own small independent wander, on top of the wind-driven velocity, so
        // leaves sharing the same wind still drift apart from each other over time.
        leaf.msUntilTurbulenceRetarget -= dtMs;
        if (leaf.msUntilTurbulenceRetarget <= 0) {
          leaf.msUntilTurbulenceRetarget = randomInRange(TURBULENCE_RETARGET_MS);
          const turbulenceMag = targetSpeedPxPerSec * 0.5 + 8;
          leaf.turbulenceTargetVx = randomBetween(-1, 1) * turbulenceMag;
          leaf.turbulenceTargetVy = randomBetween(-1, 1) * turbulenceMag * 0.6;
        }
        const turbLerp = 1 - Math.pow(0.02, dt);
        leaf.turbulenceVx += (leaf.turbulenceTargetVx - leaf.turbulenceVx) * turbLerp;
        leaf.turbulenceVy += (leaf.turbulenceTargetVy - leaf.turbulenceVy) * turbLerp;

        // Gust lift/drop — an upward impulse while a gust is active, real gravity-ish decay once
        // it ends (see this feature's own "occasionally a gust should push a leaf upward... after
        // the gust decreases, the leaf can slowly fall").
        if (wind.gustActive) {
          leaf.liftVelocity += (-targetSpeedPxPerSec * 0.35 - leaf.liftVelocity) * Math.min(1, dt * 3);
        } else {
          leaf.liftVelocity += (0 - leaf.liftVelocity) * Math.min(1, dt * 0.8);
          leaf.liftVelocity += 6 * dt; // gentle settle/fall once the lift fades
        }

        // Velocity damps toward (wind + turbulence + lift) rather than snapping — this is the
        // "slight acceleration/deceleration" the feature asks for.
        const damp = Math.min(1, VELOCITY_DAMPING_PER_SEC * dt);
        leaf.vx += (targetVx + leaf.turbulenceVx - leaf.vx) * damp;
        leaf.vy += (targetVy + leaf.turbulenceVy + leaf.liftVelocity - leaf.vy) * damp;

        leaf.x += leaf.vx * dt;
        leaf.y += leaf.vy * dt;
        leaf.rotation += leaf.rotationSpeed * dt;
        const flutter = Math.sin(leaf.ageMs * 0.001 * leaf.flutterFreq * Math.PI * 2 + leaf.flutterPhase) * leaf.flutterAmp;

        // Lifecycle — fade in, fly, fade out; also fades out early (instead of just vanishing) if
        // a leaf drifts well past the visible bounds, so a strong gust never pops one out of view.
        const offscreen = leaf.x < -120 || leaf.x > width + 120 || leaf.y < -120 || leaf.y > height + 120;
        if (leaf.lifecycle === 'fadeIn') {
          leaf.opacity = Math.min(1, leaf.ageMs / leaf.fadeInMs);
          if (leaf.opacity >= 1) leaf.lifecycle = 'flying';
        } else if (leaf.lifecycle === 'flying') {
          leaf.opacity = 1;
          if (leaf.ageMs > leaf.lifetimeMs - leaf.fadeOutMs || offscreen) leaf.lifecycle = 'fadeOut';
        } else {
          const fadeStart = Math.max(leaf.fadeInMs, leaf.lifetimeMs - leaf.fadeOutMs);
          leaf.opacity = Math.max(0, 1 - (leaf.ageMs - fadeStart) / leaf.fadeOutMs);
          if (leaf.opacity <= 0 || leaf.ageMs > leaf.lifetimeMs + leaf.fadeOutMs) {
            slot.active = false;
            slot.leaf = null;
            slot.opacity.setValue(0);
            anySlotChanged = true;
            continue;
          }
        }

        slot.translateX.setValue(leaf.x);
        slot.translateY.setValue(leaf.y + flutter * 0.15);
        slot.rotate.setValue(leaf.rotation + flutter);
        slot.opacity.setValue(leaf.opacity * cfg.opacityMult);
      }
      if (anySlotChanged) forceRender((n) => n + 1);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windController, slots]);

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {slots.map((slot, i) =>
        slot.active ? (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: slot.size,
              height: slot.size,
              opacity: slot.opacity,
              transform: [{ translateX: slot.translateX }, { translateY: slot.translateY }, { rotate: slot.rotate.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }],
            }}
          >
            <Svg width={slot.size} height={slot.size} viewBox="0 0 24 24">
              <Path d={LEAF_SHAPES[slot.shapeIndex]} fill={slot.color} />
            </Svg>
          </Animated.View>
        ) : null,
      )}
    </View>
  );
}
