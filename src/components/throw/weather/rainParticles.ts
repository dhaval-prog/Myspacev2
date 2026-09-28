import type { WeatherIntensity, WeatherQuality } from '../../../types/weather';
import { generateFallingParticles, type FallingParticle, type ParticleTuning } from './weatherParticles';

export type RainParticle = FallingParticle;

// Back-to-front per-layer feel — distant rain is thinner/fainter/shorter/slower, foreground rain
// reads as closer: thicker, more opaque, longer streaks, falling faster. This is what actually
// creates the depth/parallax effect.
export const RAIN_LAYER_SPEED_MULTIPLIER: readonly [number, number, number] = [0.55, 0.8, 1.15];

const RAIN_TUNING: ParticleTuning = {
  layerSpeedMultiplier: RAIN_LAYER_SPEED_MULTIPLIER,
  layerBaseOpacity: [0.32, 0.52, 0.78],
  layerBaseLength: [13, 20, 30],
  layerBaseThickness: [1, 1.3, 1.8],
  // Kept modest even at "high": this is a screen-space atmospheric layer, not a hero visual, and
  // the map underneath has to stay the thing that's actually readable.
  qualityLayerCounts: { high: [22, 18, 13], medium: [14, 12, 8], low: [7, 6, 4] },
};

/** Rain's own particle population — a thin RAIN_TUNING wrapper over the shared
 * generateFallingParticles engine (see weatherParticles.ts), which SnowOverlay/WindOverlay reuse
 * with their own tuning instead of duplicating this generation logic. */
export function generateRainParticles(quality: WeatherQuality, intensity: WeatherIntensity): RainParticle[] {
  return generateFallingParticles(quality, intensity, RAIN_TUNING);
}
