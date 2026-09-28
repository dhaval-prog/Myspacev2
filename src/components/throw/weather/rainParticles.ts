import type { WeatherIntensity, WeatherQuality } from '../../../types/weather';

/** One raindrop's own fixed characteristics — everything here is chosen once (see
 * generateRainParticles) and never changes for the particle's lifetime; only its *position* is
 * animated (by RainOverlay.native.tsx's shared per-layer clocks, or by RainOverlay.web.tsx's own
 * canvas loop), which is exactly what keeps this cheap at higher particle counts (see either
 * renderer's own comment on why nothing here becomes a React state update per frame). */
export interface RainParticle {
  /** 0–1, fraction of the overlay's own width — converted to a real pixel x by whichever renderer
   * is using it, since only that renderer knows the actual container size. */
  x: number;
  length: number;
  thickness: number;
  /** Base opacity before RainConfig.opacity/the start-transition "presence" ramp are applied. */
  opacity: number;
  /** 0 = furthest back (lightest, slowest), 2 = foreground (heaviest, fastest) — drives which of
   * RAIN_LAYER_SPEED_MULTIPLIER/RAIN_LAYER_BASE_* this particle's layer-wide constants come from. */
  layer: 0 | 1 | 2;
  /** 0–1 starting point within its own fall loop, so particles sharing a layer (and therefore a
   * layer-wide fall duration) don't all fall in lockstep — see RainOverlay.native.tsx's use of
   * Animated.modulo for how this offsets a shared clock, or the web renderer's own per-frame `y`
   * math for the equivalent there. */
  phase: number;
  /** 0–1 — when this particle "reveals" as WeatherOverlay's start transition ramps up (see
   * RainOverlay's own `presence` value) — spread across the whole population so density visibly
   * builds up drop by drop rather than every drop fading in in lockstep. */
  revealAt: number;
}

// Back-to-front per-layer feel — distant rain is thinner/fainter/shorter/slower, foreground rain
// reads as closer: thicker, more opaque, longer streaks, falling faster. This is what actually
// creates the depth/parallax effect, not anything overlay-specific.
export const RAIN_LAYER_SPEED_MULTIPLIER: readonly [number, number, number] = [0.55, 0.8, 1.15];
export const RAIN_LAYER_BASE_OPACITY: readonly [number, number, number] = [0.32, 0.52, 0.78];
export const RAIN_LAYER_BASE_LENGTH: readonly [number, number, number] = [13, 20, 30];
export const RAIN_LAYER_BASE_THICKNESS: readonly [number, number, number] = [1, 1.3, 1.8];

// How many particles each layer gets, per quality tier — the ceiling this device/session renders
// at "heavy" intensity; lighter intensities thin this out further (see INTENSITY_COUNT_FACTOR).
// Kept modest even at "high": this is a screen-space atmospheric layer, not a hero visual, and the
// map underneath has to stay the thing that's actually readable.
const QUALITY_LAYER_COUNTS: Record<WeatherQuality, readonly [number, number, number]> = {
  high: [22, 18, 13],
  medium: [14, 12, 8],
  low: [7, 6, 4],
};
const INTENSITY_COUNT_FACTOR: Record<WeatherIntensity, number> = { light: 0.5, medium: 0.75, heavy: 1 };

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Builds the (fixed-for-its-lifetime) particle population for one RainOverlay instance — called
 * once per mount/quality-or-intensity change, never per frame. Deliberately not deterministic/
 * seeded: nothing about this needs to match across renders, sessions, or platforms, and
 * Math.random() keeps it simple.
 */
export function generateRainParticles(quality: WeatherQuality, intensity: WeatherIntensity): RainParticle[] {
  const factor = INTENSITY_COUNT_FACTOR[intensity];
  const particles: RainParticle[] = [];
  const layerCounts = QUALITY_LAYER_COUNTS[quality];
  const total = layerCounts.reduce((sum, c) => sum + Math.max(1, Math.round(c * factor)), 0);
  let revealIndex = 0;
  for (let layer = 0; layer < 3; layer++) {
    const count = Math.max(1, Math.round(layerCounts[layer as 0 | 1 | 2] * factor));
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random(),
        length: RAIN_LAYER_BASE_LENGTH[layer as 0 | 1 | 2] * randomBetween(0.75, 1.3),
        thickness: RAIN_LAYER_BASE_THICKNESS[layer as 0 | 1 | 2] * randomBetween(0.8, 1.25),
        opacity: RAIN_LAYER_BASE_OPACITY[layer as 0 | 1 | 2] * randomBetween(0.7, 1.15),
        layer: layer as 0 | 1 | 2,
        phase: Math.random(),
        revealAt: total > 1 ? revealIndex / (total - 1) : 0,
      });
      revealIndex++;
    }
  }
  return particles;
}
