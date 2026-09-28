import { generateWindParticles } from '../windParticles';

describe('generateWindParticles', () => {
  it('every particle stays within its documented ranges', () => {
    const particles = generateWindParticles('high', 'heavy');
    expect(particles.length).toBeGreaterThan(0);
    for (const p of particles) {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(1);
      expect(p.phase).toBeGreaterThanOrEqual(0);
      expect(p.phase).toBeLessThan(1);
      expect(p.revealAt).toBeGreaterThanOrEqual(0);
      expect(p.revealAt).toBeLessThanOrEqual(1);
      expect(p.size).toBeGreaterThan(0);
      expect(p.opacity).toBeGreaterThan(0);
      expect(p.speedFactor).toBeGreaterThan(0);
      expect(p.rotationDeg).toBeGreaterThan(0);
    }
  });

  it('heavier intensity produces at least as many particles as lighter, for the same quality', () => {
    const light = generateWindParticles('high', 'light').length;
    const heavy = generateWindParticles('high', 'heavy').length;
    expect(light).toBeLessThanOrEqual(heavy);
  });

  it('higher quality produces at least as many particles as lower, for the same intensity', () => {
    const low = generateWindParticles('low', 'heavy').length;
    const high = generateWindParticles('high', 'heavy').length;
    expect(low).toBeLessThanOrEqual(high);
  });
});
