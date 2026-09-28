/**
 * The shared, live wind simulation every wind-aware renderer (leaves, clouds, rain's own lean)
 * subscribes to — plain TS, no React/Animated dependency of its own, so it's trivially unit
 * testable and reusable from either platform's renderer. One instance is created per WeatherOverlay
 * mount (see useWindController.ts) and driven by a single shared tick loop, rather than every
 * renderer running its own independent wind math — this is the "shared animation loop" the feature
 * itself asks for, and it's also just fewer rAF callbacks per frame.
 *
 * The model deliberately isn't a literal physics simulation — it's a cheap, good-enough
 * approximation of "real wind": a slowly-wandering base (a smoothed random walk toward a new
 * target every couple of seconds, the same shape Perlin/Simplex noise is usually reached for, done
 * here with a plain lerp since the *coordinate* being wandered is just two scalars) plus
 * occasional, randomly-timed gusts that ramp up, hold, and settle back down over roughly 1-3
 * seconds. Nothing here repeats on a fixed schedule — every interval is itself randomized within a
 * range, so the sequence of gusts is different every session (see this feature's own "no
 * repetitive loops" requirement).
 */

import type { WindConfig } from '../../../types/weather';

// Re-exported so existing imports of `WindConfig` from this file keep working — the canonical
// definition now lives in types/weather.ts alongside CloudParticle/AtmosphericEnvironment, since
// the same shape is meant to eventually drive leaves, rain, snow, dust, and clouds alike, not just
// this file's own simulation.
export type { WindConfig };

export interface WindSample {
  /** km/h, the fully-resolved current speed — base × wander × gust envelope. */
  speedKph: number;
  /** Degrees, "blowing toward" convention (0 = toward north, 90 = toward east) — ready to feed
   * straight into a sin/cos direction vector without renderers needing to know about the
   * meteorological "from" convention WindConfig.direction itself uses. */
  directionDeg: number;
  /** 1 at rest, rising toward roughly 1 + gustStrength at a gust's peak — the one number most
   * renderers actually want (their own base pace × this). */
  gustFactor: number;
  /** True for the whole ramp-up/hold/settle duration of an active gust — renderers that want an
   * on/off cue (e.g. "lift a leaf") rather than the continuous factor can use this instead. */
  gustActive: boolean;
}

// A full gust (ramp up + hold + settle back to baseline) takes roughly this long — matches the
// feature's own "the whole sequence should take approximately 1-3 seconds."
const GUST_RAMP_UP_MS = [280, 650] as const;
const GUST_HOLD_MS = [350, 850] as const;
const GUST_SETTLE_MS = [550, 1400] as const;
const GUST_INTERVAL_MS = [4000, 12000] as const;
// How much of WindConfig.gustStrength actually lands as extra speed at a gust's absolute peak.
const GUST_PEAK_MULTIPLIER = 1.0;

// The "wander" — a smoothed random walk, not real noise, but reads the same: pick a new target
// every couple of seconds and lerp toward it continuously, rather than jumping.
const WANDER_RETARGET_MS = [1400, 3200] as const;
// How far the wander can push speed (as a fraction of base) and direction (degrees) at its own
// full turbulence=1 — scaled down by WindConfig.turbulence for calmer conditions.
const WANDER_MAX_SPEED_FRACTION = 0.22;
const WANDER_MAX_DIRECTION_DEG = 16;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
function randomInRange([min, max]: readonly [number, number]): number {
  return randomBetween(min, max);
}
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

type GustPhase = 'idle' | 'rampUp' | 'hold' | 'settle';

export class WindSimulation {
  private config: WindConfig;
  private reduceMotion: boolean;

  private wanderSpeedTarget = 0;
  private wanderSpeedCurrent = 0;
  private wanderDirTarget = 0;
  private wanderDirCurrent = 0;
  private msUntilWanderRetarget = 0;

  private gustPhase: GustPhase = 'idle';
  private gustPhaseElapsedMs = 0;
  private gustPhaseDurationMs = 0;
  private msUntilNextGust: number;
  private gustEnvelope = 0; // 0..1, current position within the gust's own ramp/hold/settle

  constructor(config: WindConfig, reduceMotion = false) {
    this.config = config;
    this.reduceMotion = reduceMotion;
    this.msUntilWanderRetarget = randomInRange(WANDER_RETARGET_MS);
    this.msUntilNextGust = randomInRange(GUST_INTERVAL_MS);
  }

  setConfig(config: Partial<WindConfig>) {
    this.config = { ...this.config, ...config };
  }

  setReduceMotion(reduceMotion: boolean) {
    this.reduceMotion = reduceMotion;
  }

  /** Advances the simulation by dtMs (clamped so a long tab-hidden gap doesn't fast-forward
   * through several gusts at once) and returns the resulting sample. */
  tick(dtMs: number): WindSample {
    const dt = clamp(dtMs, 0, 250);
    const turbulence = this.reduceMotion ? 0 : this.config.turbulence;

    // --- Wander ---
    this.msUntilWanderRetarget -= dt;
    if (this.msUntilWanderRetarget <= 0) {
      this.msUntilWanderRetarget = randomInRange(WANDER_RETARGET_MS);
      this.wanderSpeedTarget = randomBetween(-1, 1) * WANDER_MAX_SPEED_FRACTION * turbulence;
      this.wanderDirTarget = randomBetween(-1, 1) * WANDER_MAX_DIRECTION_DEG * turbulence;
    }
    // Lerp rate tuned so a retarget (every 1.4-3.2s) is reached smoothly well within that window —
    // this is what makes the wander read as continuous drift rather than a series of snaps.
    const wanderLerpRate = 1 - Math.pow(0.001, dt / 1000);
    this.wanderSpeedCurrent = lerp(this.wanderSpeedCurrent, this.wanderSpeedTarget, wanderLerpRate);
    this.wanderDirCurrent = lerp(this.wanderDirCurrent, this.wanderDirTarget, wanderLerpRate);

    // --- Gusts ---
    if (!this.reduceMotion) {
      this.tickGust(dt);
    } else {
      this.gustPhase = 'idle';
      this.gustEnvelope = 0;
    }

    const gustFactor = 1 + this.gustEnvelope * this.config.gustStrength * GUST_PEAK_MULTIPLIER;
    const speedKph = Math.max(0, this.config.speed * (1 + this.wanderSpeedCurrent) * gustFactor);
    // Meteorological "from" → "toward" (+180°), plus the wander's own small heading fluctuation —
    // gusts nudge direction a little too (real gusts rarely blow from exactly the prevailing
    // heading), scaled by how deep into the gust we are.
    const gustDirKick = this.gustEnvelope * (this.config.turbulence * 10);
    const directionDeg = (this.config.direction + 180 + this.wanderDirCurrent + gustDirKick + 360) % 360;

    return { speedKph, directionDeg, gustFactor, gustActive: this.gustPhase !== 'idle' };
  }

  private tickGust(dt: number) {
    if (this.gustPhase === 'idle') {
      this.msUntilNextGust -= dt;
      if (this.msUntilNextGust <= 0) {
        this.gustPhase = 'rampUp';
        this.gustPhaseElapsedMs = 0;
        this.gustPhaseDurationMs = randomInRange(GUST_RAMP_UP_MS);
      }
      return;
    }

    this.gustPhaseElapsedMs += dt;
    const t = clamp(this.gustPhaseElapsedMs / Math.max(1, this.gustPhaseDurationMs), 0, 1);

    if (this.gustPhase === 'rampUp') {
      this.gustEnvelope = easeOutCubic(t);
      if (t >= 1) {
        this.gustPhase = 'hold';
        this.gustPhaseElapsedMs = 0;
        this.gustPhaseDurationMs = randomInRange(GUST_HOLD_MS);
      }
    } else if (this.gustPhase === 'hold') {
      this.gustEnvelope = 1;
      if (t >= 1) {
        this.gustPhase = 'settle';
        this.gustPhaseElapsedMs = 0;
        this.gustPhaseDurationMs = randomInRange(GUST_SETTLE_MS);
      }
    } else if (this.gustPhase === 'settle') {
      this.gustEnvelope = 1 - easeInCubic(t);
      if (t >= 1) {
        this.gustPhase = 'idle';
        this.gustEnvelope = 0;
        this.msUntilNextGust = randomInRange(GUST_INTERVAL_MS);
      }
    }
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
function easeInCubic(t: number): number {
  return t * t * t;
}

/**
 * A tiny pub-sub around one WindSimulation — every wind-aware renderer subscribes here instead of
 * running its own rAF loop, so one shared tick drives all of them (see this file's own doc
 * comment). Framework-agnostic; useWindController.ts is what actually schedules `tick` via
 * requestAnimationFrame and wires in React's own lifecycle/AppState/reduceMotion concerns.
 */
export class WindController {
  private sim: WindSimulation;
  private listeners = new Set<(sample: WindSample, dtMs: number) => void>();
  private lastSample: WindSample;

  constructor(config: WindConfig, reduceMotion = false) {
    this.sim = new WindSimulation(config, reduceMotion);
    this.lastSample = { speedKph: config.speed, directionDeg: (config.direction + 180) % 360, gustFactor: 1, gustActive: false };
  }

  setConfig(config: Partial<WindConfig>) {
    this.sim.setConfig(config);
  }
  setReduceMotion(reduceMotion: boolean) {
    this.sim.setReduceMotion(reduceMotion);
  }
  getSample(): WindSample {
    return this.lastSample;
  }
  subscribe(fn: (sample: WindSample, dtMs: number) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  /** Called once per frame by useWindController's own rAF loop. */
  tick(dtMs: number) {
    this.lastSample = this.sim.tick(dtMs);
    this.listeners.forEach((fn) => fn(this.lastSample, dtMs));
  }
}
