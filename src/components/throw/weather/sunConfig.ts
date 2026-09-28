/**
 * The one shared "what does sunlight look like right now" model — consumed by both SunnyRenderer.tsx
 * (native) and weatherEngine.ts (web) so time-of-day behavior stays identical across platforms
 * instead of each reinventing its own bucketing. Deliberately not a continuous function of the
 * literal minute — four broad buckets (morning/midday/afternoon/evening) per this feature's own
 * spec, recomputed only when a renderer mounts/activates or a web engine call switches to 'sunny',
 * never per-frame.
 */
export interface SunConfig {
  /** 0–1 — overall strength of every sunlight effect (glow/rays/wash) at once. */
  intensity: number;
  /** Degrees — rough direction the light/rays lean, not a literal compass bearing. */
  angle: number;
  /** 0–1 — how high the sun reads as sitting; low = long low-angle golden light, high = overhead. */
  elevation: number;
  /** 0–1 — how warm/golden the color grading leans; low = a cooler midday white-gold. */
  warmth: number;
  /** Multiplier on the glow/ray radius — a low sun reads as a bigger, softer glow. */
  glowRadius: number;
}

const MORNING: SunConfig = { intensity: 0.5, angle: 35, elevation: 0.35, warmth: 0.75, glowRadius: 0.9 };
const MIDDAY: SunConfig = { intensity: 1, angle: 12, elevation: 0.95, warmth: 0.4, glowRadius: 1 };
const AFTERNOON: SunConfig = { intensity: 0.72, angle: 24, elevation: 0.55, warmth: 0.62, glowRadius: 0.96 };
// Also the fallback for the (automatic-mode-unreachable, manual-selection-only) night hours — a
// warm, low, soft glow reads better for a manually-picked "Sunny" after dark than a jarring
// undefined state would, without inventing a separate "golden hour" condition per explicit request.
const EVENING: SunConfig = { intensity: 0.42, angle: 42, elevation: 0.18, warmth: 0.92, glowRadius: 1.18 };

/** Local device hour (0–23) → the sunlight bucket for it. */
export function sunConfigForHour(hour: number): SunConfig {
  if (hour >= 5 && hour < 10) return MORNING;
  if (hour >= 10 && hour < 16) return MIDDAY;
  if (hour >= 16 && hour < 19) return AFTERNOON;
  return EVENING;
}
