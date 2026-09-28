import { WindController, WindSimulation } from '../windController';

const CONFIG = { speed: 20, direction: 90, gustStrength: 0.5, turbulence: 0.5 };

describe('WindSimulation', () => {
  it('resolves speed/direction from a config with zero turbulence/gustStrength as a stable baseline', () => {
    const sim = new WindSimulation({ speed: 20, direction: 90, gustStrength: 0, turbulence: 0 });
    const sample = sim.tick(16);
    expect(sample.speedKph).toBeCloseTo(20, 0);
    // "From" 90 (east) becomes "toward" 270 (west): (90 + 180) % 360.
    expect(sample.directionDeg).toBeCloseTo(270, 0);
    expect(sample.gustFactor).toBe(1);
    expect(sample.gustActive).toBe(false);
  });

  it('never returns a negative speed even under strong opposing turbulence/gusts', () => {
    const sim = new WindSimulation({ speed: 1, direction: 0, gustStrength: 1, turbulence: 1 });
    for (let i = 0; i < 500; i++) {
      const sample = sim.tick(50);
      expect(sample.speedKph).toBeGreaterThanOrEqual(0);
    }
  });

  it('produces varying speed samples over time (organic wander), not a constant value', () => {
    const sim = new WindSimulation(CONFIG);
    const speeds = new Set<number>();
    for (let i = 0; i < 400; i++) {
      speeds.add(Math.round(sim.tick(50).speedKph * 100));
    }
    expect(speeds.size).toBeGreaterThan(5);
  });

  it('eventually enters a gust (gustActive true) within a bounded number of ticks', () => {
    const sim = new WindSimulation(CONFIG);
    let sawGust = false;
    for (let i = 0; i < 3000 && !sawGust; i++) {
      if (sim.tick(50).gustActive) sawGust = true;
    }
    expect(sawGust).toBe(true);
  });

  it('a full gust ramps above baseline and settles back down, never snapping instantly', () => {
    const sim = new WindSimulation(CONFIG);
    let peak = 1;
    let sawSettleBelowPeak = false;
    let sawGust = false;
    for (let i = 0; i < 6000; i++) {
      const sample = sim.tick(50);
      if (sample.gustActive) {
        sawGust = true;
        peak = Math.max(peak, sample.gustFactor);
      } else if (sawGust && peak > 1.05) {
        sawSettleBelowPeak = true;
        break;
      }
    }
    expect(sawGust).toBe(true);
    expect(peak).toBeGreaterThan(1.05);
    expect(sawSettleBelowPeak).toBe(true);
  });

  it('clamps a large dt (e.g. after a backgrounded gap) instead of applying it in one jump', () => {
    const sim = new WindSimulation(CONFIG);
    // A huge dt should behave the same as the internal clamp ceiling — this mostly asserts it
    // doesn't throw/produce NaN/Infinity from an unclamped huge delta.
    const sample = sim.tick(60000);
    expect(Number.isFinite(sample.speedKph)).toBe(true);
    expect(Number.isFinite(sample.directionDeg)).toBe(true);
  });

  it('reduceMotion suppresses gusts and turbulence (gustFactor stays at 1, speed stays close to baseline)', () => {
    const sim = new WindSimulation(CONFIG, true);
    for (let i = 0; i < 2000; i++) {
      const sample = sim.tick(50);
      expect(sample.gustFactor).toBe(1);
      expect(sample.gustActive).toBe(false);
      expect(sample.speedKph).toBeCloseTo(CONFIG.speed, 0);
    }
  });
});

describe('WindController', () => {
  it('notifies subscribers on every tick with a sample and dt', () => {
    const controller = new WindController(CONFIG);
    const calls: Array<[number, number]> = [];
    const unsubscribe = controller.subscribe((sample, dtMs) => calls.push([sample.speedKph, dtMs]));
    controller.tick(16);
    controller.tick(32);
    expect(calls.length).toBe(2);
    expect(calls[0][1]).toBe(16);
    expect(calls[1][1]).toBe(32);
    unsubscribe();
    controller.tick(16);
    expect(calls.length).toBe(2);
  });

  it('getSample returns the most recent tick result even without a subscriber', () => {
    const controller = new WindController(CONFIG);
    controller.tick(16);
    const sample = controller.getSample();
    expect(Number.isFinite(sample.speedKph)).toBe(true);
  });

  it('setConfig updates future samples without needing a new instance', () => {
    const controller = new WindController({ speed: 5, direction: 0, gustStrength: 0, turbulence: 0 });
    controller.tick(16);
    const before = controller.getSample().speedKph;
    controller.setConfig({ speed: 50 });
    controller.tick(16);
    const after = controller.getSample().speedKph;
    expect(after).toBeGreaterThan(before);
  });
});
