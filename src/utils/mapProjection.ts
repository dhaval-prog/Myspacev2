import type { LatLng } from './geo';

/** Equirectangular projection — standard `width = 2 * height` world map convention. */
export function project(point: LatLng, width: number, height: number): { x: number; y: number } {
  const x = ((point.longitude + 180) / 360) * width;
  const y = ((90 - point.latitude) / 180) * height;
  return { x, y };
}

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

export interface ProjectedPoint {
  x: number;
  y: number;
}

/**
 * Projects a flight path into screen segments, splitting wherever the path crosses the map's
 * left/right edge (the antimeridian) so each segment can be drawn as its own continuous stroke
 * instead of a line streaking across the whole map.
 */
export function projectPathSegments(points: LatLng[], width: number, height: number): ProjectedPoint[][] {
  const segments: ProjectedPoint[][] = [];
  let current: ProjectedPoint[] = [];
  let prevX: number | null = null;
  for (const p of points) {
    const { x, y } = project(p, width, height);
    if (prevX !== null && Math.abs(x - prevX) > width / 2) {
      if (current.length > 1) segments.push(current);
      current = [];
    }
    current.push({ x, y });
    prevX = x;
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

export interface PathPosition extends ProjectedPoint {
  /** Heading in degrees, 0 = pointing along +x (east), for rotating a plane glyph. */
  angleDeg: number;
}

/** The projected screen position (and heading) at progress `t` (0..1) along a flight path. */
export function pointAtProgress(points: LatLng[], width: number, height: number, t: number): PathPosition {
  const clampedT = Math.max(0, Math.min(1, t));
  const idxFloat = clampedT * (points.length - 1);
  const idx = Math.min(points.length - 2, Math.max(0, Math.floor(idxFloat)));
  const localT = idxFloat - idx;
  const a = project(points[idx], width, height);
  const b = project(points[idx + 1], width, height);

  let bx = b.x;
  if (Math.abs(bx - a.x) > width / 2) {
    bx = bx > a.x ? bx - width : bx + width;
  }
  const x = a.x + (bx - a.x) * localT;
  const y = a.y + (b.y - a.y) * localT;
  const angleRad = Math.atan2(b.y - a.y, bx - a.x);
  return { x: ((x % width) + width) % width, y, angleDeg: (angleRad * 180) / Math.PI };
}
