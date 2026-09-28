import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import type { WindController } from './windController';
import type { CloudParticle } from '../../../types/weather';

// react-native-svg's web typings omit `children` on Defs (a typing gap, not a runtime issue, see
// ThrowGlassBackdrop.tsx's own identical cast) — cast once.
const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;
// `overflow: 'visible'` so a lobe whose soft radial edge extends past the Svg's own tight
// width/height (deliberately sized to the cloud's visible footprint, not padded) doesn't get
// clipped into a hard straight edge — the one thing that would undo the whole point of the radial
// gradient. TS's StyleProp<ViewStyle> resolution for react-native-svg's own re-exported ViewProps
// rejects this plain object for unrelated reasons unrelated to its shape; cast rather than fight it.
const svgOverflowVisible: any = { overflow: 'visible' };

const PRESENCE_DURATION_MS = 1800;

// Cloud speed is explicitly NOT a copy of leaf/wind velocity — real cloud layers drift far slower
// than surface wind, so every layer's own speed is the live wind sample times a small atmospheric
// multiplier, further scaled down per depth layer (far layers slower still). Tuned so movement is
// almost imperceptible moment-to-moment but visibly different after several seconds, per the
// feature's own "extremely slow relative to leaves" requirement.
const ATMOSPHERIC_SPEED_MULTIPLIER = 0.045;
const MIN_DRIFT_PX_PER_SEC = 0.6;

// Slow, seeded morph — each cloud's own scale/opacity gently breathes over tens of seconds, never
// fast enough to read as "melting" (per explicit request).
const MORPH_PERIOD_MS = [26000, 42000] as const;

interface LayerConfig {
  /** Cloud count for this layer. */
  count: number;
  scaleRange: readonly [number, number];
  opacityRange: readonly [number, number];
  /** Multiplies the already-tiny atmospheric drift speed — far layers drift slowest. */
  speedMult: number;
  /** How many soft-edged lobes make up one cloud mass — more for closer/larger clouds. */
  lobes: readonly [number, number];
  blurish: number; // extra edge softness via lower-opacity outer lobes, larger for far layers
}

// Back to front: far (large/faint/slow/very soft), mid, near (larger footprint but not smaller —
// "near" clouds read closer via contrast/speed, not by shrinking, which is what keeps this reading
// as atmosphere rather than a flat billboard).
const LAYERS: readonly LayerConfig[] = [
  { count: 2, scaleRange: [1.35, 1.85], opacityRange: [0.14, 0.24], speedMult: 0.5, lobes: [3, 4], blurish: 0.35 },
  { count: 2, scaleRange: [1.0, 1.4], opacityRange: [0.22, 0.34], speedMult: 0.85, lobes: [4, 5], blurish: 0.22 },
  { count: 1, scaleRange: [0.75, 1.05], opacityRange: [0.3, 0.42], speedMult: 1.25, lobes: [4, 6], blurish: 0.12 },
];

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
function randomInRange([min, max]: readonly [number, number]): number {
  return randomBetween(min, max);
}

function generateClouds(): CloudParticle[] {
  const clouds: CloudParticle[] = [];
  LAYERS.forEach((layer, depth) => {
    for (let i = 0; i < layer.count; i++) {
      clouds.push({
        x: randomBetween(-0.15, 1.15),
        y: randomBetween(0.04, 0.55),
        scale: randomBetween(layer.scaleRange[0], layer.scaleRange[1]),
        opacity: randomBetween(layer.opacityRange[0], layer.opacityRange[1]),
        speed: layer.speedMult,
        direction: 0,
        depth,
        rotation: randomBetween(-8, 8),
        seed: Math.random() * 1000,
      });
    }
  });
  return clouds;
}

/** Deterministic-but-varied per-cloud lobe layout, derived from the cloud's own seed rather than
 * fresh Math.random() each render — so a cloud's own irregular shape stays stable across re-renders
 * while still differing from every other cloud (see CloudParticle.seed). */
function lobesForCloud(seed: number, lobeRange: readonly [number, number]): Array<{ dx: number; dy: number; r: number; o: number }> {
  const count = Math.round(lobeRange[0] + (seededFrac(seed, 0) * (lobeRange[1] - lobeRange[0])));
  const lobes: Array<{ dx: number; dy: number; r: number; o: number }> = [];
  for (let i = 0; i < count; i++) {
    const f1 = seededFrac(seed, i * 3 + 1);
    const f2 = seededFrac(seed, i * 3 + 2);
    const f3 = seededFrac(seed, i * 3 + 3);
    lobes.push({
      dx: (f1 - 0.5) * 1.7,
      dy: (f2 - 0.5) * 0.7,
      r: 0.45 + f3 * 0.55,
      o: 0.55 + seededFrac(seed, i * 3 + 4) * 0.45,
    });
  }
  return lobes;
}

/** A cheap, stable pseudo-random fraction derived from (seed, index) — good enough for "different
 * per cloud, same across re-renders," not for anything needing real statistical randomness. */
function seededFrac(seed: number, index: number): number {
  const v = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

interface CloudOverlayProps {
  active: boolean;
  /** A darker, denser sky — thunderstorm/lightning's own backdrop rather than an ordinary cloudy
   * day's lighter one. */
  dark?: boolean;
  windController: WindController;
}

/**
 * Soft, irregular cloud masses — each cloud is several overlapping soft-edged lobes (not a single
 * cartoon "☁" blob), across three depth layers whose speed comes from the shared WindController's
 * live sample times a small, layer-scaled atmospheric multiplier (see ATMOSPHERIC_SPEED_MULTIPLIER)
 * rather than any direct copy of leaf/wind velocity — clouds drift far slower than the wind that
 * nominally moves them, same as real atmosphere. Position/morph are pushed via `.setValue()` from a
 * single windController.subscribe callback (no per-cloud React state), consistent with every other
 * renderer in this feature; only a handful of Animated.Views total, well within this feature's own
 * performance requirement.
 */
export function CloudOverlay({ active, dark = false, windController }: CloudOverlayProps) {
  const [size, setSize] = useState<{ width: number; height: number }>(() => Dimensions.get('window'));
  const presence = useRef(new Animated.Value(0)).current;
  const clouds = useMemo(() => generateClouds(), []);

  const cloudNodes = useMemo(
    () =>
      clouds.map(() => ({
        translateX: new Animated.Value(0),
        morph: new Animated.Value(1),
      })),
    [clouds],
  );

  const sizeRef = useRef(size);
  sizeRef.current = size;
  // Each cloud's own drift position (px, independent of screen wrap math below) and morph clock.
  const stateRef = useRef(
    clouds.map((c) => ({
      xPx: 0, // resolved lazily once size is known, see effect below
      morphMs: randomBetween(0, 10000),
      morphPeriodMs: randomInRange(MORPH_PERIOD_MS),
      initialized: false,
    })),
  );

  useEffect(() => {
    Animated.timing(presence, {
      toValue: active ? 1 : 0,
      duration: PRESENCE_DURATION_MS,
      easing: active ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, presence]);

  useEffect(() => {
    const unsubscribe = windController.subscribe((wind, dtMs) => {
      const dt = dtMs / 1000;
      const { width, height } = sizeRef.current;
      if (width <= 0) return;
      const towardRad = (wind.directionDeg * Math.PI) / 180;
      const dirX = Math.cos(towardRad);

      clouds.forEach((cloud, i) => {
        const st = stateRef.current[i];
        if (!st.initialized) {
          st.xPx = cloud.x * width;
          st.initialized = true;
        }
        const layer = LAYERS[cloud.depth];
        const driftSpeed = Math.max(
          MIN_DRIFT_PX_PER_SEC,
          wind.speedKph * ATMOSPHERIC_SPEED_MULTIPLIER * layer.speedMult * cloud.speed,
        );
        st.xPx += dirX * driftSpeed * dt;

        const spanPx = width * 0.5 + width * cloud.scale;
        const minX = -spanPx;
        const maxX = width + spanPx;
        // Wrap around, not bounce — a cloud drifting off one edge re-enters from the other, far
        // enough off-screen that the wrap itself is never visible.
        if (st.xPx > maxX) st.xPx = minX;
        else if (st.xPx < minX) st.xPx = maxX;

        st.morphMs += dtMs;
        const morphT = (st.morphMs % st.morphPeriodMs) / st.morphPeriodMs;
        // A slow sine breathe — scale/opacity both derived from the same single morph value in the
        // render below, so this is the only per-frame math a cloud's morph needs.
        const morphValue = 0.92 + Math.sin(morphT * Math.PI * 2) * 0.08;

        const node = cloudNodes[i];
        node.translateX.setValue(st.xPx - cloud.x * width);
        node.morph.setValue(morphValue);
      });
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windController, clouds, cloudNodes]);

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: Animated.multiply(presence, dark ? 0.5 : 0.2) }]}
      >
        <LinearGradient
          colors={dark ? ['rgba(8,12,20,0.9)', 'rgba(8,12,20,0.35)'] : ['rgba(70,80,95,0.45)', 'rgba(70,80,95,0.04)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {clouds.map((cloud, i) => {
        const node = cloudNodes[i];
        const baseSize = size.width * 0.42 * cloud.scale;
        const lobes = lobesForCloud(cloud.seed, LAYERS[cloud.depth].lobes);
        const cloudOpacity = Animated.multiply(presence, cloud.opacity);
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: cloud.x * size.width - baseSize / 2,
              top: cloud.y * size.height - baseSize * 0.3,
              width: baseSize,
              height: baseSize * 0.62,
              opacity: cloudOpacity,
              transform: [{ translateX: node.translateX }, { scale: node.morph }, { rotate: `${cloud.rotation}deg` }],
            }}
          >
            <Svg width={baseSize} height={baseSize * 0.62} style={svgOverflowVisible}>
              <DefsAny>
                {/* One shared radial gradient per cloud, reused by every lobe — SVG's default
                    objectBoundingBox gradient units mean each Circle gets its own correctly-scaled
                    soft center→transparent-edge fade regardless of its own radius, which is what
                    actually reads as a soft irregular mass instead of a flat-edged circle (per this
                    feature's own "avoid cartoon-style clouds" / "soft edges" requirement). */}
                <RadialGradient id={`cloudGrad-${i}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={dark ? '#1c202a' : '#ffffff'} stopOpacity={1 - LAYERS[cloud.depth].blurish * 0.4} />
                  <Stop offset="0.55" stopColor={dark ? '#1c202a' : '#ffffff'} stopOpacity={(1 - LAYERS[cloud.depth].blurish * 0.4) * 0.65} />
                  <Stop offset="1" stopColor={dark ? '#1c202a' : '#ffffff'} stopOpacity={0} />
                </RadialGradient>
              </DefsAny>
              {lobes.map((lobe, li) => {
                const lobeSize = baseSize * lobe.r * 0.62;
                const cx = baseSize * 0.5 + lobe.dx * baseSize * 0.5;
                const cy = baseSize * 0.31 + lobe.dy * baseSize * 0.31;
                return <Circle key={li} cx={cx} cy={cy} r={lobeSize / 2} fill={`url(#cloudGrad-${i})`} opacity={lobe.o} />;
              })}
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}
