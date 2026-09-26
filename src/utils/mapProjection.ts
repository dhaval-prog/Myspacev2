import type { LatLng } from './geo';

function wrapLng(lng: number): number {
  let l = lng;
  while (l > 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}

function clampLat(lat: number): number {
  return Math.max(-85, Math.min(85, lat));
}

/** Shortest signed longitude delta from a to b (e.g. 170 -> -170 gives -20, not 340) — always the short way around. */
function shortestLngDelta(a: number, b: number): number {
  return wrapLng(b - a);
}

export interface FlightPathOptions {
  /** Number of sample points along the path. */
  samples?: number;
  /** 0..1 — how strongly the path bulges toward the nearer pole, mimicking a great-circle arc. */
  bow?: number;
}

/**
 * A stylized great-circle-ish path from `from` to `to`: always the shorter way around in
 * longitude, bowing toward whichever pole is nearer the midpoint latitude (the same reason a
 * real US-to-India flight arcs up over the pole rather than drawing a straight line on a flat
 * map). Not true spherical geometry — this is a cinematic approximation for the flight
 * animation, not a navigation tool.
 */
export function flightPath(from: LatLng, to: LatLng, options: FlightPathOptions = {}): LatLng[] {
  const samples = options.samples ?? 64;
  const bow = options.bow ?? 0.18;
  const deltaLng = shortestLngDelta(from.longitude, to.longitude);
  const totalDeltaLat = to.latitude - from.latitude;
  const midLat = (from.latitude + to.latitude) / 2;
  const poleSign = midLat >= 0 ? 1 : -1;
  const angularSpan = Math.hypot(totalDeltaLat, deltaLng);
  const bulge = Math.min(35, angularSpan * bow) * poleSign;

  const points: LatLng[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const arc = Math.sin(Math.PI * t) * bulge;
    const lat = clampLat(from.latitude + totalDeltaLat * t + arc);
    const lng = wrapLng(from.longitude + deltaLng * t);
    points.push({ latitude: lat, longitude: lng });
  }
  return points;
}

export interface FlightPosition {
  position: LatLng;
  /** Heading in degrees, 0 = due east, clockwise-positive — matches PaperPlane's own +x-at-0° orientation. */
  bearingDeg: number;
}

/**
 * The interpolated position (and heading) at progress `t` (0..1) along a flight path, in real
 * lat/lng — for driving a marker on an actual map (native `Marker.coordinate` / Leaflet
 * `latLngToContainerPoint`) rather than a hand-projected pixel position.
 */
export function latLngAtProgress(points: LatLng[], t: number): FlightPosition {
  const clampedT = Math.max(0, Math.min(1, t));
  const idxFloat = clampedT * (points.length - 1);
  const idx = Math.min(points.length - 2, Math.max(0, Math.floor(idxFloat)));
  const localT = idxFloat - idx;
  const a = points[idx];
  const b = points[idx + 1];
  const deltaLng = shortestLngDelta(a.longitude, b.longitude);
  const deltaLat = b.latitude - a.latitude;
  const latitude = a.latitude + deltaLat * localT;
  const longitude = wrapLng(a.longitude + deltaLng * localT);
  // Mirrors the old screen-space atan2(dy, dx) convention (dy inverted since north is "up"),
  // just computed straight from lat/lng deltas instead of via an intermediate pixel projection.
  const bearingDeg = (Math.atan2(-deltaLat, deltaLng) * 180) / Math.PI;
  return { position: { latitude, longitude }, bearingDeg };
}

/**
 * The flying plane's on-screen size for a given flight progress — large near departure, small on
 * approach, eased (not linear) so the shrink reads as a gradual depth cue rather than a mechanical
 * ramp. `points`/`t` already carry the real geography (see `latLngAtProgress`); this only adds the
 * "further along the path = farther away = smaller" illusion on top of that real position, shared
 * by both platforms' ThrowMap so the two don't drift apart.
 */
export function planeSizeForProgress(t: number, max: number, min: number): number {
  const c = Math.max(0, Math.min(1, t));
  const eased = c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2;
  return max + (min - max) * eased;
}

// How much of the flight's final stretch the plane spends dissolving — it should still read as
// "arriving" for most of the approach, then visibly fade to nothing right at the end rather than
// disappearing abruptly or landing with a separate effect.
const FADE_START = 0.82;

/**
 * The flying plane's opacity for a given flight progress — fully opaque until the final stretch,
 * then eased down to 0 by t = 1, so it shrinks (see `planeSizeForProgress`) and dissolves into
 * the destination rather than landing on it.
 */
export function planeOpacityForProgress(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  if (c < FADE_START) return 1;
  const local = (c - FADE_START) / (1 - FADE_START);
  return 1 - local;
}

// ~0.0002° is roughly 20m at the equator — close enough to call "the same location" for grouping
// purposes (city-level Throw data, not survey-grade GPS).
const COINCIDENT_PIN_EPSILON_DEG = 0.0002;
// How far apart (in degrees) coincident pins fan out once spread — small enough to still read as
// "the same place", large enough that two map markers at typical city-zoom levels don't overlap.
const COINCIDENT_PIN_OFFSET_DEG = 0.00035;

/**
 * Nudges pins that share (near-enough) the same coordinates into a small fan-out pattern, so two
 * people at the same real-world location both render as visible, separately-tappable map markers
 * instead of one exactly covering the other. Pins that don't share a location with anything else
 * pass through unchanged. Generic over any pin shape with a latitude/longitude, so both the web
 * (screen-projected) and native (geo `Marker`) maps benefit from the same fix without either
 * needing pixel-space logic of its own — geo-space offsets here become the right screen-space
 * offsets once each map projects/renders them.
 */
export function spreadCoincidentPins<T extends { latitude: number; longitude: number }>(pins: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const p of pins) {
    const key = `${Math.round(p.latitude / COINCIDENT_PIN_EPSILON_DEG)},${Math.round(p.longitude / COINCIDENT_PIN_EPSILON_DEG)}`;
    const existing = groups.get(key);
    if (existing) existing.push(p);
    else groups.set(key, [p]);
  }
  const result: T[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    // Keeps the fan-out visually circular regardless of latitude — a degree of longitude covers
    // less real (and screen) distance the further from the equator you go.
    const lngScale = Math.max(0.15, Math.cos((group[0].latitude * Math.PI) / 180));
    group.forEach((pin, i) => {
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
      result.push({
        ...pin,
        latitude: pin.latitude + COINCIDENT_PIN_OFFSET_DEG * Math.sin(angle),
        longitude: pin.longitude + (COINCIDENT_PIN_OFFSET_DEG * Math.cos(angle)) / lngScale,
      });
    });
  }
  return result;
}
