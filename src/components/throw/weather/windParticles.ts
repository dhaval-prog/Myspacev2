import type { WeatherIntensity, WeatherQuality } from '../../../types/weather';

/** Wind's own particle shape — small leaf/dust-like flecks drifting mostly horizontally across the
 * screen, distinct enough from rain/snow's straight-down fall that reusing weatherParticles.ts's
 * own model (built around a vertical "travel the screen height" axis) would need more contortion
 * than just having its own small generator; sparse by design ("leaf-like particles", not a dense
 * atmospheric layer). */
export interface WindParticle {
  /** 0–1 starting vertical position, as a fraction of the overlay's own height. */
  y: number;
  size: number;
  opacity: number;
  /** Per-particle multiplier on the shared wind speed, so a gust doesn't move every particle at
   * identically the same pace. */
  speedFactor: number;
  /** 0–1 starting point within its own left-to-right (or right-to-left) crossing. */
  phase: number;
  /** How far this particle bobs vertically as it crosses, purely cosmetic (a leaf doesn't travel in
   * a dead-straight line). */
  swayAmplitude: number;
  swayPhase: number;
  /** Degrees this particle has rotated by the time it finishes one full crossing — a lazy tumble,
   * not a spin. */
  rotationDeg: number;
  /** 0–1 — when this particle "reveals" as the overlay's start transition ramps up (see
   * RainOverlay's own `presence`), spread across the population the same way. */
  revealAt: number;
}

const QUALITY_COUNT: Record<WeatherQuality, number> = { high: 16, medium: 10, low: 5 };
const INTENSITY_FACTOR: Record<WeatherIntensity, number> = { light: 0.55, medium: 0.8, heavy: 1 };

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function generateWindParticles(quality: WeatherQuality, intensity: WeatherIntensity): WindParticle[] {
  const count = Math.max(1, Math.round(QUALITY_COUNT[quality] * INTENSITY_FACTOR[intensity]));
  const particles: WindParticle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      y: Math.random(),
      size: randomBetween(5, 11),
      opacity: randomBetween(0.35, 0.75),
      speedFactor: randomBetween(0.7, 1.4),
      phase: Math.random(),
      swayAmplitude: randomBetween(8, 26),
      swayPhase: Math.random(),
      rotationDeg: randomBetween(120, 360),
      revealAt: count > 1 ? i / (count - 1) : 0,
    });
  }
  return particles;
}
