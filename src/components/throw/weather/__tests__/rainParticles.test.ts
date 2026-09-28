import { generateRainParticles } from '../rainParticles';

describe('generateRainParticles', () => {
  it('produces particles across all three depth layers', () => {
    const particles = generateRainParticles('high', 'heavy');
    const layers = new Set(particles.map((p) => p.layer));
    expect(layers).toEqual(new Set([0, 1, 2]));
  });

  it('every particle stays within its documented ranges', () => {
    const particles = generateRainParticles('high', 'heavy');
    for (const p of particles) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(1);
      expect(p.phase).toBeGreaterThanOrEqual(0);
      expect(p.phase).toBeLessThan(1);
      expect(p.revealAt).toBeGreaterThanOrEqual(0);
      expect(p.revealAt).toBeLessThanOrEqual(1);
      expect(p.length).toBeGreaterThan(0);
      expect(p.thickness).toBeGreaterThan(0);
      expect(p.opacity).toBeGreaterThan(0);
    }
  });

  it('heavier intensity produces at least as many particles as lighter, for the same quality', () => {
    const light = generateRainParticles('high', 'light');
    const medium = generateRainParticles('high', 'medium');
    const heavy = generateRainParticles('high', 'heavy');
    expect(light.length).toBeLessThanOrEqual(medium.length);
    expect(medium.length).toBeLessThanOrEqual(heavy.length);
  });

  it('higher quality produces at least as many particles as lower, for the same intensity', () => {
    const low = generateRainParticles('low', 'heavy');
    const medium = generateRainParticles('medium', 'heavy');
    const high = generateRainParticles('high', 'heavy');
    expect(low.length).toBeLessThanOrEqual(medium.length);
    expect(medium.length).toBeLessThanOrEqual(high.length);
  });
});
