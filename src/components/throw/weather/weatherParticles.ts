import type { WeatherIntensity, WeatherQuality } from '../../../types/weather';

/** One particle's own fixed characteristics, shared by every falling/drifting-particle renderer
 * (rain, snow, wind's leaf-like drift) — everything here is chosen once (see
 * generateFallingParticles) and never changes for the particle's lifetime; only its *position* is
 * animated (native: shared per-layer Animated.loop clocks + Animated.modulo; web: a canvas
 * requestAnimationFrame loop), which is what keeps this cheap at higher particle counts — nothing
 * here ever becomes a React state update per frame. */
export interface FallingParticle {
  /** 0–1, fraction of the overlay's own width — converted to a real pixel x by whichever renderer
   * is using it, since only that renderer knows the actual container size. */
  x: number;
  length: number;
  thickness: number;
  /** Base opacity before a renderer's own config.opacity/the start-transition "presence" ramp are
   * applied. */
  opacity: number;
  /** 0 = furthest back (lightest, slowest), 2 = foreground (heaviest, fastest) — drives which of a
   * ParticleTuning's own per-layer arrays this particle's constants come from. */
  layer: 0 | 1 | 2;
  /** 0–1 starting point within its own fall loop, so particles sharing a layer (and therefore a
   * layer-wide fall duration) don't all fall in lockstep. */
  phase: number;
  /** 0–1 — when this particle "reveals" as the overlay's start transition ramps up (see
   * RainOverlay/SnowOverlay/WindOverlay's own `presence` value) — spread across the whole
   * population so density visibly builds up particle by particle rather than all fading in at once. */
  revealAt: number;
  /** How far a particle sways side-to-side, as a fraction of its own layer's base length — only
   * SnowOverlay actually uses this (see its own "drift sideways, don't just fall straight down"
   * requirement); 0 for rain/wind, where a particle's path is a straight line off the wind angle. */
  swayAmplitude: number;
  /** 0–1 phase offset for that sway, same "don't let particles sharing a layer move in lockstep"
   * reasoning as `phase` above, just for the sway cycle instead of the fall cycle. */
  swayPhase: number;
}

/** Per-layer look, back-to-front — distant particles read as thinner/fainter/shorter/slower,
 * foreground ones as closer: thicker, more opaque, longer, falling faster. This (not anything
 * overlay-specific) is what actually creates the depth/parallax effect. Each weather type that
 * falls/drifts (rain, snow, wind) defines its own tuning and hands it to generateFallingParticles. */
export interface ParticleTuning {
  layerSpeedMultiplier: readonly [number, number, number];
  layerBaseOpacity: readonly [number, number, number];
  layerBaseLength: readonly [number, number, number];
  layerBaseThickness: readonly [number, number, number];
  /** How many particles each layer gets, per quality tier, at "heavy" intensity — lighter
   * intensities thin this out further (see INTENSITY_COUNT_FACTOR). Kept modest even at "high":
   * this is a screen-space atmospheric layer, not a hero visual, and the map underneath has to stay
   * the thing that's actually readable. */
  qualityLayerCounts: Record<WeatherQuality, readonly [number, number, number]>;
  /** 0 for rain/wind (straight lines off the wind angle); a real fraction of a snowflake's own
   * length for snow, so it visibly sways rather than just falling straight down. */
  swayAmplitudeFactor?: number;
}

const INTENSITY_COUNT_FACTOR: Record<WeatherIntensity, number> = { light: 0.5, medium: 0.75, heavy: 1 };

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Builds the (fixed-for-its-lifetime) particle population for one overlay instance — called once
 * per mount/quality-or-intensity change, never per frame. Deliberately not deterministic/seeded:
 * nothing about this needs to match across renders, sessions, or platforms, and Math.random() keeps
 * it simple.
 */
export function generateFallingParticles(quality: WeatherQuality, intensity: WeatherIntensity, tuning: ParticleTuning): FallingParticle[] {
  const factor = INTENSITY_COUNT_FACTOR[intensity];
  const particles: FallingParticle[] = [];
  const layerCounts = tuning.qualityLayerCounts[quality];
  const total = layerCounts.reduce((sum, c) => sum + Math.max(1, Math.round(c * factor)), 0);
  const swayFactor = tuning.swayAmplitudeFactor ?? 0;
  let revealIndex = 0;
  for (let layer = 0; layer < 3; layer++) {
    const count = Math.max(1, Math.round(layerCounts[layer as 0 | 1 | 2] * factor));
    for (let i = 0; i < count; i++) {
      const length = tuning.layerBaseLength[layer as 0 | 1 | 2] * randomBetween(0.75, 1.3);
      particles.push({
        x: Math.random(),
        length,
        thickness: tuning.layerBaseThickness[layer as 0 | 1 | 2] * randomBetween(0.8, 1.25),
        opacity: tuning.layerBaseOpacity[layer as 0 | 1 | 2] * randomBetween(0.7, 1.15),
        layer: layer as 0 | 1 | 2,
        phase: Math.random(),
        revealAt: total > 1 ? revealIndex / (total - 1) : 0,
        swayAmplitude: swayFactor > 0 ? length * swayFactor * randomBetween(0.6, 1.4) : 0,
        swayPhase: Math.random(),
      });
      revealIndex++;
    }
  }
  return particles;
}
