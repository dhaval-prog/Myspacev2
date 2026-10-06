import {
  clusterPins,
  distanceKm,
  etaLabel,
  filterContacts,
  fitViewport,
  focusCamera,
  formatDistanceKm,
  isLive,
  latFromV,
  lonFromU,
  mercatorU,
  mercatorV,
} from '../friendsMapMath';

describe('mercator projection', () => {
  it('lonFromU/latFromV invert mercatorU/mercatorV', () => {
    expect(lonFromU(mercatorU(73.8567))).toBeCloseTo(73.8567, 6);
    expect(latFromV(mercatorV(18.5204))).toBeCloseTo(18.5204, 6);
  });
});

describe('distanceKm', () => {
  it('matches a known Pune-Mumbai distance (~120-150km)', () => {
    const pune = { latitude: 18.5204, longitude: 73.8567 };
    const mumbai = { latitude: 19.0596, longitude: 72.8295 };
    const d = distanceKm(pune, mumbai);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(160);
  });

  it('is zero for the same point', () => {
    const p = { latitude: 18.5, longitude: 73.8 };
    expect(distanceKm(p, p)).toBeCloseTo(0);
  });
});

describe('formatDistanceKm', () => {
  it('shows one decimal under 10km', () => {
    expect(formatDistanceKm(4.24)).toBe('4.2 km');
  });
  it('rounds and comma-groups at/above 10km', () => {
    expect(formatDistanceKm(1284.4)).toBe('1,284 km');
    expect(formatDistanceKm(10)).toBe('10 km');
  });
});

describe('etaLabel', () => {
  it('buckets by distance exactly like the handoff', () => {
    expect(etaLabel(5)).toBe('2 min');
    expect(etaLabel(14.9)).toBe('2 min');
    expect(etaLabel(100)).toBe(`${Math.round(4 + 100 / 20)} min`);
    expect(etaLabel(500)).toBe(`${Math.round(10 + 500 / 25)} min`);
  });
});

describe('isLive', () => {
  const now = Date.parse('2026-01-01T12:00:00Z');
  it('is live within the window', () => {
    expect(isLive(new Date(now - 60_000).toISOString(), now)).toBe(true);
  });
  it('is not live past the window', () => {
    expect(isLive(new Date(now - 6 * 60_000).toISOString(), now)).toBe(false);
  });
  it('is not live with no timestamp', () => {
    expect(isLive(null, now)).toBe(false);
    expect(isLive(undefined, now)).toBe(false);
  });
});

describe('clusterPins', () => {
  const near = [
    { id: 'a', lat: 18.52, lon: 73.85 },
    { id: 'b', lat: 18.521, lon: 73.851 },
  ];
  const far = { id: 'c', lat: 28.6, lon: 77.2 };

  it('merges pins within 48px at a low zoom', () => {
    const groups = clusterPins([...near, far], { zoom: 4 });
    expect(groups.length).toBe(2);
    const merged = groups.find((g) => g.items.length === 2);
    expect(merged?.items.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });

  it('does not merge at/above the cluster zoom threshold', () => {
    const groups = clusterPins([...near, far], { zoom: 13 });
    expect(groups.length).toBe(3);
  });

  it('never merges the selected pin into another group', () => {
    const groups = clusterPins(near, { zoom: 4, selectedId: 'a' });
    expect(groups.length).toBe(2);
  });

  it('can be disabled outright', () => {
    const groups = clusterPins(near, { zoom: 4, enabled: false });
    expect(groups.length).toBe(2);
  });
});

describe('fitViewport', () => {
  it('returns null for an empty list', () => {
    expect(fitViewport([])).toBeNull();
  });

  it('shrinks zoom as the bounding box grows', () => {
    const tight = fitViewport([
      { latitude: 18.52, longitude: 73.85 },
      { latitude: 18.521, longitude: 73.851 },
    ])!;
    const wide = fitViewport([
      { latitude: 18.52, longitude: 73.85 },
      { latitude: 28.6, longitude: 77.2 },
    ])!;
    expect(tight.zoom).toBeGreaterThan(wide.zoom);
  });

  it('clamps to MAX_ZOOM for a single point', () => {
    const r = fitViewport([{ latitude: 18.52, longitude: 73.85 }])!;
    expect(r.zoom).toBe(15);
  });
});

describe('focusCamera', () => {
  it('zooms in to at least 12 but never zooms out', () => {
    expect(focusCamera({ latitude: 18.52, longitude: 73.85 }, 8).zoom).toBe(12);
    expect(focusCamera({ latitude: 18.52, longitude: 73.85 }, 14).zoom).toBe(14);
  });

  it('shifts the camera center south of the pin, so the pin itself renders higher on screen (above true center, clear of the sheet below)', () => {
    const point = { latitude: 18.52, longitude: 73.85 };
    const { center } = focusCamera(point, 12);
    expect(center.latitude).toBeLessThan(point.latitude);
    expect(center.longitude).toBeCloseTo(point.longitude, 6);
  });
});

describe('filterContacts', () => {
  const contacts = [
    { name: 'Dhaval', city: 'Pune', area: 'Koregaon Park', live: true, distanceKm: 5 },
    { name: 'Meera', city: 'Kolkata', area: 'Salt Lake', live: false, distanceKm: 1500 },
  ];

  it('"all" returns everyone', () => {
    expect(filterContacts(contacts, { filter: 'all', query: '' }).length).toBe(2);
  });

  it('"live" keeps only live contacts', () => {
    expect(filterContacts(contacts, { filter: 'live', query: '' }).map((c) => c.name)).toEqual(['Dhaval']);
  });

  it('"nearby" keeps only contacts under the distance cutoff', () => {
    expect(filterContacts(contacts, { filter: 'nearby', query: '' }).map((c) => c.name)).toEqual(['Dhaval']);
  });

  it('search matches name, city or area case-insensitively', () => {
    expect(filterContacts(contacts, { filter: 'all', query: 'salt' }).map((c) => c.name)).toEqual(['Meera']);
    expect(filterContacts(contacts, { filter: 'all', query: 'PUNE' }).map((c) => c.name)).toEqual(['Dhaval']);
  });
});
